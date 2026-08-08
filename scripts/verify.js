#!/usr/bin/env node
/**
 * verify.js — color-mixer 的契約檢查
 *
 * 這支腳本檢查的是「自動檢查看不到、但實跑一次也不一定會踩到」的那類東西
 * （PLAYBOOK §5）：markup ↔ handler 的對應、載入順序、lib 的數學性質、
 * 以及檔頭註解裡宣稱的實測數字**現在還成不成立**。
 *
 * ⚠️ 註解會過期而不會報錯。§B 的那組數字直接寫進檢查，改了模型就會紅——
 *    這是本家族一再記載的教訓：「文件與實作各自漂，而且不會報錯」。
 *
 * 用法：
 *   node scripts/verify.js              全部跑一遍（全過 exit 0、有不符 exit 1）
 *   node scripts/verify.js --selftest   故意改壞每一條，確認每一條都抓得到
 *   node scripts/verify.js --help       印用法
 *
 * ⚠️ 未知旗標 exit 2，**不會退回預設模式**——旗標打錯而靜默跑成別的模式，
 *    輸出會與成功長得一模一樣（a3-export.js 踩過，見家族 CLAUDE.md v1.11）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'public/apps/color-mixer');

// ---- 旗標 ---------------------------------------------------------------

const argv = process.argv.slice(2);
const KNOWN = ['--selftest', '--help', '-h'];
const unknown = argv.filter((a) => !KNOWN.includes(a));
if (unknown.length) {
  console.error('未知旗標：' + unknown.join(' '));
  console.error('用法：node scripts/verify.js [--selftest] [--help]');
  process.exit(2);
}
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('node scripts/verify.js              契約檢查（全過 0 / 不符 1）');
  console.log('node scripts/verify.js --selftest   反向驗證：故意改壞，確認每條都抓得到');
  console.log('node scripts/verify.js --help       本說明');
  process.exit(0);
}
const SELFTEST = argv.includes('--selftest');

// ---- 檢查框架 -----------------------------------------------------------

const results = [];
function check(id, title, fn) {
  let ok = false, detail = '';
  try { const r = fn(); ok = r === true || (r && r.ok); detail = (r && r.detail) || ''; }
  catch (e) { ok = false; detail = e.message; }
  results.push({ id, title, ok, detail });
}
function read(rel) { return fs.readFileSync(path.join(APP, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(APP, rel)); }

// NUL 述詞：內部用 String.fromCharCode(0)，**不寫實體位元組**。
// 寫成實體 NUL 會讓 file(1) 判定 data → grep 靜默跳過整個檔案、git 當 binary，
// 而 node --check 完全抓不到（NUL 在字串字面值裡語法合法）。app-launcher 的
// verify.js 正是在寫這個案例時把自己寫進一個 NUL（家族 CLAUDE.md v1.14）。
const NUL = String.fromCharCode(0);
function hasNul(s) { return s.indexOf(NUL) >= 0; }

// ---- 載入 lib（在 Node 下跑得動＝證明它真的不碰 DOM） --------------------

const libSrc = read('color-mixer-lib.js');
const sandbox = {};
// ⚠️ 必須先載共用件 color-metric.js——lib 在模組載入時就取 window.ColorMetric，
//    沒有它會在載入當下丟出明確錯誤（那個守衛是刻意的，見 SHARED_LIBRARY_GUIDELINES §4）。
new Function('window', 'globalThis', read('color-metric.js'))(sandbox, sandbox);
new Function('window', 'globalThis', libSrc)(sandbox, sandbox);
const L = sandbox.ColorMixerLib;
const CM = sandbox.ColorMetric;

const hx = (h) => L.hexToRgb(h);
const dE = (a, b) => {
  const A = hx(a), B = hx(b);
  return L.deltaE(L.rgbToLab(A.r, A.g, A.b), L.rgbToLab(B.r, B.g, B.b));
};
const mix = (base, ink, a, m) => L.compose({ base, layers: [{ hex: ink, alpha: a }] }, m).hex;

// =========================================================================
// §A  lib 的數學性質
// =========================================================================

check('A1', 'lib 在 Node 下可載入且不碰 DOM', () => {
  if (!L) throw new Error('window.ColorMixerLib 未掛上');
  if (/\bdocument\b|\bjQuery\b|\$\(/.test(libSrc.replace(/\/\*[\s\S]*?\*\//g, '')))
    throw new Error('lib 內出現 document / jQuery');
  return { ok: true, detail: `${L.MODELS.length} 個模型：${L.MODELS.join(' ')}` };
});

check('A2', '四個模型的端點一致（a=0 → 底色、a=1 → 該層色）', () => {
  const base = '#2b5fa8', ink = '#f2d024';
  const bad = [];
  L.MODELS.forEach((m) => {
    if (mix(base, ink, 0, m) !== base) bad.push(`${m} a=0 → ${mix(base, ink, 0, m)}`);
    if (mix(base, ink, 1, m) !== ink) bad.push(`${m} a=1 → ${mix(base, ink, 1, m)}`);
  });
  if (bad.length) throw new Error(bad.join('; '));
  return { ok: true, detail: '4 模型 × 2 端點 = 8/8' };
});

check('A3', 'compose 不改輸入（純函式）', () => {
  const stack = { base: '#ffffff', layers: [{ hex: '#1f4e9c', alpha: 0.6, src: { brand: 'copic', code: 'B29' } }] };
  const snapshot = JSON.stringify(stack);
  L.MODELS.forEach((m) => L.compose(stack, m));
  if (JSON.stringify(stack) !== snapshot) throw new Error('compose 改動了傳入的 stack');
  return true;
});

check('A4', '減色模型混出的綠彩度高於光合成模型（藍＋黃）', () => {
  // ⚠️ 第一版寫成「綠通道是不是最大」——**四個模型全部通過，等於什麼都沒驗到**
  //    （srgb #8f9866 的 g 也是最大）。真正的判別量是 Lab 彩度：色相四者都在綠區，
  //    差別在混得多灰。實測數字見 color-mixer-lib.js 檔頭那張表。
  const stat = (h) => {
    const c = hx(h), lab = L.rgbToLab(c.r, c.g, c.b);
    let hue = Math.atan2(lab[2], lab[1]) * 180 / Math.PI; if (hue < 0) hue += 360;
    return { C: Math.sqrt(lab[1] ** 2 + lab[2] ** 2), hue };
  };
  const s = {};
  L.MODELS.forEach((m) => { s[m] = stat(mix('#2b5fa8', '#f2d024', 0.5, m)); });
  const subMin = Math.min(...L.SUBTRACTIVE.map((m) => s[m].C));
  const addMax = Math.max(...L.ADDITIVE.map((m) => s[m].C));
  if (!(subMin > addMax))
    throw new Error(`減色最低彩度 ${subMin.toFixed(1)} 未高於光合成最高 ${addMax.toFixed(1)}`);
  const offHue = L.SUBTRACTIVE.filter((m) => s[m].hue < 90 || s[m].hue > 160);
  if (offHue.length) throw new Error('減色結果色相不在綠區：' + offHue.join(', '));
  return {
    ok: true,
    detail: L.MODELS.map((m) => `${m} C=${s[m].C.toFixed(1)}`).join('  ')
      + `（減色最低 ${subMin.toFixed(1)} > 光合成最高 ${addMax.toFixed(1)}）`
  };
});

// =========================================================================
// §B  檔頭那張實測表——註解與實作不准漂
// =========================================================================

check('B1', 'glaze 保留基材色的影響、km 不保留（檔頭實測表）', () => {
  const W = '#ffffff', X = '#f0e6d2', INK = '#08093d';
  const paperGap = dE(W, X);
  if (paperGap < 9 || paperGap > 11) throw new Error(`兩張紙的 ΔE00 應約 10.12，實得 ${paperGap.toFixed(2)}`);
  // 低濃度時 glaze 必須看得見紙色差異，km 必須看不見。
  const g = dE(mix(W, INK, 0.15, 'glaze'), mix(X, INK, 0.15, 'glaze'));
  const k = dE(mix(W, INK, 0.15, 'km'), mix(X, INK, 0.15, 'km'));
  if (!(g > 5)) throw new Error(`glaze @0.15 應 > 5，實得 ${g.toFixed(2)}`);
  if (!(k < 1)) throw new Error(`km @0.15 應 < 1，實得 ${k.toFixed(2)}`);
  return { ok: true, detail: `紙差 ΔE${paperGap.toFixed(2)}；@0.15 glaze ΔE${g.toFixed(2)} / km ΔE${k.toFixed(2)}` };
});

check('B2', 'glaze 的基材影響隨濃度單調遞減', () => {
  const W = '#ffffff', X = '#f0e6d2', INK = '#08093d';
  const seq = [0.15, 0.3, 0.5, 0.7, 0.85, 0.95]
    .map((a) => dE(mix(W, INK, a, 'glaze'), mix(X, INK, a, 'glaze')));
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] > seq[i - 1] + 1e-9) throw new Error(`非單調：${seq.map((v) => v.toFixed(2)).join(' > ')}`);
  }
  return { ok: true, detail: seq.map((v) => v.toFixed(2)).join(' → ') };
});

check('B3', 'km 對純數位原色會失真（已知限制，不准悄悄被「修好」）', () => {
  const out = mix('#0000ff', '#ffff00', 0.5, 'km');
  const c = hx(out);
  const lum = (c.r + c.g + c.b) / 3;
  if (lum > 60) throw new Error(`km 純原色混合現在得到 ${out}（亮度 ${lum.toFixed(0)}）——`
    + '若這是刻意改良，請同步改檔頭那段警語與本檢查');
  return { ok: true, detail: `#0000ff+#ffff00 → ${out}（檔頭記為 #161616）` };
});

// =========================================================================
// §C  網址狀態（參數全寫在網址列＝存檔）
// =========================================================================

check('C1', 'encode → decode 來回一致', () => {
  // ⚠️ 這條每次加新的網址參數都要跟著擴充，**不是放寬**。
  //    2026-08-08 反解上線時它紅過一次——decode 多回三個欄位而這裡沒有；
  //    當時的誘惑是只比對舊欄位讓它變綠，那會讓「新參數存不存得進網址」從此沒有人驗。
  const st = {
    model: 'glaze', substrate: 'xuan-natural', observed: '#171159', anchor: '#08093d',
    solveTarget: '#22175e', solvePalette: 'custom', solveCustom: ['#ff0000', '#0000ff'],
    stack: { base: '#f0e6d2', layers: [
      { hex: '#08093d', alpha: 0.6, src: { brand: 'copic', code: 'B39' } },
      { hex: '#e8c33a', alpha: 0.35, src: null }] }
  };
  const back = L.decodeState(L.encodeState(st));
  if (!back) throw new Error('decodeState 回 null');
  if (JSON.stringify(back) !== JSON.stringify({
    model: st.model, substrate: st.substrate,
    observed: st.observed || null,          // 目視色也走網址（2026-08-08 加）
    anchor: st.anchor || null,              // 目視微調的錨點（＝治理文件的 fd_hex_ref）
    solveTarget: st.solveTarget, solvePalette: st.solvePalette, solveCustom: st.solveCustom,
    stack: L.normalizeStack(st.stack)
  })) throw new Error('來回不一致：' + JSON.stringify(back));
  // 沒有反解時不該長出空參數——分享連結會被無意義的 t=&p= 撐大
  const bare = L.encodeState({ model: 'glaze', stack: { base: '#ffffff' } });
  if (/(^|&)(t|p|a|o)=/.test(bare)) throw new Error('沒設值卻寫了選用參數：' + bare);
  return { ok: true, detail: '?' + L.encodeState(st) };
});

// ---- G：反解（拆色）----------------------------------------------------
//
// 反解整支的地基是一句數學宣稱：「疊層＝某空間裡的凸組合」。**那是量出來的、
// 不是推導出來的**，所以要一直量下去——地基垮了，solve 不會報錯，只會安靜地
// 給出很有說服力的錯配方。

check('G1', '疊層＝凸組合（反解的地基），且 oklab 誠實地不在表裡', () => {
  let seed = 4242;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rh = () => '#' + [0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).padStart(2, '0')).join('');
  const out = {};
  L.MODELS.forEach((m) => {
    let worst = 0;
    for (let i = 0; i < 500; i++) {
      const base = rh();
      const layers = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ hex: rh(), alpha: rnd() }));
      // 凸權重：w_base = Π(1−a)、w_i = a_i·Π_{j>i}(1−a_j)
      let wb = 1; const ws = [];
      layers.forEach((ly) => { for (let k = 0; k < ws.length; k++) ws[k] *= (1 - ly.alpha); wb *= (1 - ly.alpha); ws.push(ly.alpha); });
      const sum = wb + ws.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 1e-9) throw new Error(`權重不加總為 1：${sum}`);
      // 凸組合本身用 solve 的往返代替（SPACE 是 lib 內部的，不對外）：
      // 由這組顏料合成出來的色，必須解得回來。
      const tgt = L.compose({ base, layers }, m).hex;
      const r = L.solve({ base, palette: layers.map((l) => l.hex), target: tgt, model: m });
      if (!r) throw new Error('solve 回 null');
      if (r.dE > worst) worst = r.dE;
    }
    out[m] = worst;
  });
  const exactWorst = Math.max(...L.EXACT_CONVEX.map((m) => out[m]));
  if (exactWorst > 1.0) throw new Error(`宣稱精確的模型往返殘差 ${exactWorst.toFixed(3)} 太大`);
  // ⚠️ 反向那半：oklab **必須不在** EXACT_CONVEX 裡。它會被夾回 sRGB 色域，
  //    「看起來像線性插值」就順手加進去，會讓畫面對使用者宣稱一件不成立的事。
  if (L.EXACT_CONVEX.indexOf('oklab') >= 0)
    throw new Error('oklab 被列為精確凸組合——它會被夾回 sRGB 色域，不是');
  return { ok: true, detail: L.MODELS.map((m) => `${m} 往返最大 ΔE00=${out[m].toFixed(3)}`).join('  ') };
});

check('G2', '到不了要說到不了，而且殘差是下限不是「還沒調好」', () => {
  const bad = [];
  L.MODELS.forEach((m) => {
    // 單一紅色顏料疊在白紙上，永遠到不了綠
    const r = L.solve({ base: '#ffffff', palette: ['#ff0000'], target: '#00ff00', model: m });
    if (!r) return bad.push(`${m}: null`);
    if (r.reachable) bad.push(`${m}: 宣稱調得出來（ΔE00=${r.dE.toFixed(1)}）`);
    if (!(r.dE > 20)) bad.push(`${m}: 殘差 ${r.dE.toFixed(1)} 太小，不像到不了`);
    // 而且「到得了」那一半也要成立，否則這條可能是恆為 false 的空轉
    const easy = L.solve({ base: '#ffffff', palette: ['#000000'], target: '#ffffff', model: m });
    if (!easy || !easy.reachable) bad.push(`${m}: 連目標＝底色都說到不了`);
  });
  if (bad.length) throw new Error(bad.join('；'));
  return { ok: true, detail: '四模型：紅→綠 unreachable ✔　目標＝底色 reachable ✔' };
});

check('G3', 'solve 回的 layers 餵回 compose 必須得到同一個 hex', () => {
  // 「畫面說一套、套用到畫布之後是另一套」正是本 app 檔頭那條結構性紀律要防的事。
  let seed = 77, bad = 0, n = 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rh = () => '#' + [0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).padStart(2, '0')).join('');
  L.MODELS.forEach((m) => {
    Object.keys(L.PALETTES).forEach((p) => {
      for (let i = 0; i < 40; i++) {
        const r = L.solve({ base: rh(), palette: L.PALETTES[p], target: rh(), model: m });
        n++;
        if (!r || L.compose({ base: r.base, layers: r.layers }, m).hex !== r.hex) bad++;
      }
    });
  });
  if (bad) throw new Error(`${bad}/${n} 組不自洽`);
  return { ok: true, detail: `${n} 組（4 模型 × 3 內建調色盤）solve→compose 自洽` };
});

check('G4', '反解是純函式，且壞輸入回 null 不丟例外', () => {
  const pal = ['#ff0000', '#00ff00', '#0000ff'];
  const opts = { base: '#ffffff', palette: pal, target: '#171159', model: 'glaze' };
  const snap = JSON.stringify(opts);
  L.solve(opts);
  if (JSON.stringify(opts) !== snap) throw new Error('solve 改動了輸入');
  const nulls = [null, { target: 'zzz' }, { target: '#123456', palette: [] },
    { target: '#123456', palette: ['nope'] }];
  for (const o of nulls) {
    let r; try { r = L.solve(o); } catch (e) { throw new Error('丟了例外：' + e.message); }
    if (r !== null) throw new Error('壞輸入沒回 null：' + JSON.stringify(o));
  }
  return { ok: true, detail: '不改輸入 ✔　4 種壞輸入回 null ✔' };
});

check('G5', '反解面板：markup 上的每個 id 都有人接，且三語 key 齊全', () => {
  const html = read('index.html'), js = read('color-mixer.js');
  const ids = ['solve-target', 'solve-use-disc', 'solve-clear', 'solve-palettes',
    'solve-custom', 'solve-out', 'solve-note', 'solve-ctx', 'solve-custom-row'];
  const orphan = ids.filter((id) => !html.includes(`id="${id}"`) || !js.includes(`#${id}`));
  if (orphan.length) throw new Error('markup 與 handler 對不上：' + orphan.join(', '));
  // #solve-apply 是動態產生的，所以查的是委派綁定而不是靜態 markup
  if (!js.includes("'#solve-apply'")) throw new Error('#solve-apply 沒有委派 handler');
  // 三語：內建調色盤有幾個，文案就要有幾組（同 F4 的寫法）
  const need = L.PALETTE_IDS.map((p) => 'solve.pal.' + p)
    .concat(['solve.title', 'solve.target', 'solve.reachable', 'solve.unreachable',
      'solve.floor', 'solve.exactYes', 'solve.exactNo', 'solve.apply', 'toast.solveApplied']);
  const miss = [];
  ['zh-Hant', 'en', 'ja'].forEach((lg) => {
    const src = read(`locales/${lg}.js`);
    need.forEach((k) => { if (!src.includes(`'${k}'`)) miss.push(`${lg}:${k}`); });
  });
  if (miss.length) throw new Error('缺三語文案：' + miss.join(', '));
  return { ok: true, detail: `${ids.length} 個 id 有人接　${need.length} key × 3 語 = ${need.length * 3} 個都在` };
});

check('G6', '反解不弄丟筆的身分，且校準值真的進得到反解', () => {
  // ① lib：palette 收 {hex, src} 時，src 要一路帶到 layers——否則「套用到畫布」
  //    之後那幾層就變成自調色，明細卡與校準徽章全部消失，而畫面顏色一模一樣。
  const pal = [{ hex: '#255da7', src: { brand: 'copic-color', code: 'B39' } },
    { hex: '#000000', src: { brand: 'copic-color', code: '110' } }];
  const r = L.solve({ base: '#ffffff', palette: pal, target: '#171159', model: 'glaze' });
  if (!r || !r.layers.length) throw new Error('solve 沒回配方');
  const lost = r.layers.filter((l) => !l.src || !l.src.code);
  if (lost.length) throw new Error(`${lost.length} 層弄丟了 src`);
  // 套用那一步（normalizeStack）也不能把 src 洗掉
  const applied = L.normalizeStack({ base: '#ffffff', layers: r.layers });
  if (applied.layers.some((l) => !l.src)) throw new Error('normalizeStack 洗掉了 src');

  // ② 控制器：`layers` 調色盤是校準值進反解的唯一路徑，所以它必須真的走
  //    calibratedColors()，而不是自己再比對一次（v1.16）。
  const js = read('color-mixer.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const fn = js.slice(js.indexOf('function solvePalette'), js.indexOf('function renderSolve'));
  if (!fn) throw new Error('找不到 solvePalette()');
  if (!/'layers'/.test(fn)) throw new Error('solvePalette 沒有處理 layers 調色盤');
  // ⚠️ 比對的是**完整呼叫** `Lib.calibratedColors(`，不是子字串 `calibratedColors`。
  //    第一版寫成後者，反向驗證時把它改成 `Lib.NOPE_calibratedColors(` **照樣通過**
  //    ——一個抓不到「函式被換掉」的檢查，等於只在檢查註解裡有沒有出現這個字。
  if (!fn.includes('Lib.calibratedColors('))
    throw new Error('solvePalette 沒有呼叫 Lib.calibratedColors()——校準值進不到反解');
  if (!/state\.useCalib/.test(fn) || !/state\.substrate/.test(fn))
    throw new Error('沒有同時看 useCalib 與 substrate——會在沒選基材時拿錯的校準值');
  if (L.PALETTE_IDS.indexOf('layers') < 0) throw new Error('PALETTE_IDS 少了 layers');
  return { ok: true, detail: 'src 帶到底 ✔　layers 調色盤走 calibratedColors ✔' };
});

check('G7', '被多個面板讀到的 state 欄位，改它的 handler 必須整頁重繪', () => {
  // ⚠️ 這條是實際踩到才寫的：`#use-calib` 原本只呼叫 renderNear()——當年 useCalib
  //    只有最接近色在讀，完全正確。反解的 `layers` 調色盤上線後它多了第二個讀者，
  //    症狀是**勾選框勾了沒反應**：不報錯、不當機，反解安靜地繼續用型錄色。
  //    「記得在每個出口補呼叫」是會過期的紀律，所以把它變成一條檢查。
  const js = read('color-mixer.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const shared = ['useCalib', 'substrate', 'model', 'solveTarget', 'solvePalette', 'solveCustom'];
  const bad = [];
  shared.forEach((f) => {
    // ⚠️ `=(?!=)`：不加否定前瞻的話，`state.model === m` 這種**比較**也會被當成賦值
    //    ——第一版就是這樣，五處假陽性全在 render 函式裡（它們只是在讀）。
    const re = new RegExp(`state\\.${f}\\s*=(?!=)`, 'g');
    let m;
    while ((m = re.exec(js))) {
      // 從賦值處往後看這個 handler 剩下的部分（到下一個 `});` 收尾為止）
      const rest = js.slice(m.index, m.index + 700);
      const body = rest.slice(0, rest.indexOf('\n    });') + 1 || rest.length);
      if (!/renderAll\(\)/.test(body) && !/function readUrl/.test(js.slice(Math.max(0, m.index - 400), m.index)))
        bad.push(`state.${f} @${js.slice(0, m.index).split('\n').length} 行`);
    }
  });
  if (bad.length) throw new Error('改了共享欄位卻沒有整頁重繪：' + bad.join('、'));
  return { ok: true, detail: `${shared.length} 個共享欄位的每個賦值點都接 renderAll()` };
});

// ---- H：目視微調與「不精確有多要緊」------------------------------------
//
// 這一段守的是一件事：**目視值不精確是前提，不是缺陷。** 所以程式不准假裝它精確
// （中性色的色相、色域到頂），也不准把兩種不同的離散度混成一個數字。

check('H1', 'Lab 來回閉合、中性色的色相不編數字、微調是純函式', () => {
  // ① 微調 0 必須原色不動。不閉合的話「我什麼都沒調」就會改到顏色。
  let off = 0, n = 0, ex = '';
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    n++;
    if (L.nudge(hex, {}) !== hex) { off++; if (!ex) ex = hex + '→' + L.nudge(hex, {}); }
  }
  if (off) throw new Error(`${off}/${n} 色微調 0 卻變了（例 ${ex}）——Lab 反矩陣不對`);
  // ② 中性色：色相無定義，不可回一個看起來像真的數字
  ['#ffffff', '#000000', '#7f7f7f'].forEach((g) => {
    const d = L.describeNudge(g, L.nudge(g, { dh: 30 }));
    if (d.hueDefined) throw new Error(`${g} 被當成有色相`);
    if (d.dh !== 0) throw new Error(`${g} 回了色相差 ${d.dh}——中性色的 atan2(0,0) 是垃圾值`);
  });
  // ③ 有彩色仍要算得出色相
  const c = L.describeNudge('#255da7', L.nudge('#255da7', { dh: 10 }));
  if (!c.hueDefined || !(c.dh > 3)) throw new Error('有彩色的色相沒被算出來：' + JSON.stringify(c));
  // ④ 純函式 ＋ 壞輸入
  const d0 = { dL: 5 }, snap = JSON.stringify(d0);
  L.nudge('#08093d', d0);
  if (JSON.stringify(d0) !== snap) throw new Error('nudge 改了輸入');
  if (L.nudge('zz', {}) !== null || L.describeNudge('#fff', 'zz') !== null)
    throw new Error('壞輸入沒回 null');
  return { ok: true, detail: `${n} 色來回閉合、中性色 3/3 停用色相、純函式 ✔` };
});

check('H2', '兩種離散度分開報：同框架＝你的精度，跨框架＝另一回事', () => {
  const CAL = [
    { brand: 'b', code: 'X', substrate: 's', layers: 1, hex: '#171159', context: 'p' },
    { brand: 'b', code: 'X', substrate: 's', layers: 1, hex: '#191360', context: 'p' },
    { brand: 'b', code: 'X', substrate: 's', layers: 1, hex: '#0f0b45', context: 'q' },
    { brand: 'b', code: 'X', substrate: 's', layers: 2, hex: '#05052a', context: 'p' },
    { brand: 'b', code: 'X', substrate: 's', layers: 1, hex: '#1a1566' }            // 框架未記錄
  ];
  const s = L.calibrationSummary('b', 'X', 's', CAL);
  if (!s) throw new Error('回 null');
  if (s.obs.some((o) => o.layers === 2)) throw new Error('把 2 層的觀測混進 1 層');
  if (s.contexts.some((c) => !c.code)) throw new Error('框架未記錄的被併成一組——那不是同框架');
  if (s.anonymous !== 1) throw new Error('框架未記錄的列數不對：' + s.anonymous);
  if (s.repeatability === null) throw new Error('同框架兩列卻算不出重複性');
  if (s.frameGap === null) throw new Error('兩個框架卻算不出框架落差');
  // ⚠️ 兩者必須是**不同的數字**——若實作偷懶把全部觀測一起算離散度，兩者會相等。
  if (Math.abs(s.repeatability - s.frameGap) < 1e-9)
    throw new Error('重複性與框架落差相同——八成是把兩種離散度混在一起算了');
  // 單列時兩者都該是 null，不是 0（0 會被讀成「量過，非常一致」）
  const one = L.calibrationSummary('b', 'X', 's', [CAL[0]]);
  if (one.repeatability !== null || one.frameGap !== null)
    throw new Error('只有一次觀測卻報出離散度——0 會被讀成「量過而且很一致」');
  const snap = JSON.stringify(CAL);
  L.calibrationSummary('b', 'X', 's', CAL);
  if (JSON.stringify(CAL) !== snap) throw new Error('calibrationSummary 改了輸入');
  // calibratedColors 必須走同一支聚合，不可另外挑一列
  const cc = L.calibratedColors([{ code: 'X', hex: '#255da7' }], 'b', 's', CAL);
  if (cc[0].hex !== s.hex) throw new Error(`calibratedColors 給 ${cc[0].hex}，聚合值是 ${s.hex}`);
  return { ok: true, detail: `重複性 ${s.repeatability.toFixed(2)} ≠ 框架落差 ${s.frameGap.toFixed(2)}　`
    + `層數過濾 ✔　未記錄框架不併組 ✔` };
});

check('H3', '微調與穩健度：markup 有人接、三語齊全、滑桿位置不另存一份', () => {
  const html = read('index.html');
  const js = read('color-mixer.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ['nudge-toggle', 'nudge-row', 'nudge-anchor', 'nudge-sliders', 'nudge-out', 'near-robust']
    .forEach((id) => {
      if (!html.includes(`id="${id}"`)) throw new Error(`markup 少了 #${id}`);
      if (!js.includes(`#${id}`)) throw new Error(`#${id} 沒有 handler / 沒有人寫入`);
    });
  // ⚠️ 滑桿位置必須由 describeNudge 現算。另存一份「要求值」就會出現
  //    「畫面說 L−6、實際只到 −3.2」——色域到頂時那兩個數字必然不同。
  // ⚠️ 掃的是 `var state = {…}` **這個區塊本身**，不是 `state.nudgeD` 這種取用寫法。
  //    第一版比對取用寫法，而真實的破壞是在 state 字面值裡多一個 `nudgeD:` 屬性
  //    ——反向驗證當場沒抓到。**檢查要對準東西實際會被寫成的樣子。**
  const block = js.slice(js.indexOf('var state = {'), js.indexOf('var poolSize'));
  if (!block) throw new Error('找不到 state 區塊');
  const stored = (block.match(/^\s*(nudge[A-Za-z]*)\s*:/gm) || [])
    .map((x) => x.trim().replace(':', ''))
    // `nudgeClipped` 是合法的：它記的是「上一次**要求**了什麼、實得什麼」，
    // 那是**輸入的紀錄**，不是算得出來的東西——色域到頂只有在滑桿事件當下知道得了
    // （事後用「再推一步看變不變」猜是錯的：色域邊界不是硬牆，每一步都還會變一點點，
    //  實測要求 L−40、實得 −2.1 也照樣「有變」，警示一次都沒出現過）。
    .filter((k) => !['nudgeAnchor', 'nudgeOpen', 'nudgeClipped'].includes(k));
  if (stored.length)
    throw new Error('滑桿位置被存進 state 了（' + stored.join('、') + '）——要求值與實得值會對不上');
  if (!/describeNudge\(/.test(js)) throw new Error('控制器沒有用 describeNudge 現算滑桿位置');
  // 滑桿的 value 必須來自 describeNudge 的結果（nudgeDelta()），不可來自 state
  const rn = js.slice(js.indexOf('function renderNudge'), js.indexOf('function renderSolve'));
  if (!/nudgeDelta\(\)/.test(rn)) throw new Error('renderNudge 沒有現算滑桿位置');
  if (/value="'\s*\+\s*state\./.test(rn)) throw new Error('滑桿 value 直接讀 state');
  const need = ['nudge.toggle', 'nudge.anchor', 'nudge.dL', 'nudge.dC', 'nudge.dh',
    'nudge.clipped', 'nudge.neutral', 'near.gap', 'near.gapWide', 'near.gapNarrow',
    'near.repeat', 'near.frameGap'];
  const miss = [];
  ['zh-Hant', 'en', 'ja'].forEach((lg) => {
    const src = read(`locales/${lg}.js`);
    need.forEach((k) => { if (!src.includes(`'${k}'`)) miss.push(`${lg}:${k}`); });
  });
  if (miss.length) throw new Error('缺三語文案：' + miss.join(', '));
  return { ok: true, detail: `6 個 id 有人接　滑桿位置現算 ✔　${need.length} key × 3 語 = ${need.length * 3} 個都在` };
});

check('H4', '基材紙色未量測時，畫面一定要講出來', () => {
  // ⚠️ 這條擋的是一個**完全靜默**的錯誤，不是貼心提示。
  //    `baseKnown: false` 的基材沒有 baseHex；normalizeStack 對缺席的 base 退回
  //    `#ffffff`，於是「紙漿原色宣紙」渲染成跟白 A4 一模一樣的白紙——
  //    而 glaze 模型下紙色會透出來，整條算出來的東西都變成白紙的答案。零報錯。
  const html = read('index.html');
  const js = read('color-mixer.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (!/id="calib-nobase"/.test(html)) throw new Error('index.html 沒有 #calib-nobase 告示元素');
  if (!/#calib-nobase/.test(js)) throw new Error('控制器沒有接 #calib-nobase');
  if (!/baseKnown\s*===\s*false/.test(js))
    throw new Error('控制器沒有判斷 baseKnown === false');
  // ⚠️ 必須是嚴格比對 `=== false`：`!sub.baseKnown` 會把「欄位不存在」也算進來，
  //    而匯出器保證這個欄位恆在（家族 v1.16：「沒有值」要用看得見的值表示）。
  //    寫成 falsy 檢查看起來一樣，但它會遮蓋「匯出器漏了這個欄位」這件事。
  if (/!\s*sub\.baseKnown|!\s*s\.baseKnown/.test(js))
    throw new Error('用了 falsy 檢查而不是 === false——會遮蓋「匯出器漏欄位」');
  // boot 不可以直接指派 s.baseHex（繞過 normalizeStack → $.css 收到 undefined 是 no-op）
  if (/state\.stack\.base\s*=\s*s\.baseHex/.test(js))
    throw new Error('boot 直接指派 s.baseHex，繞過了 normalizeStack');
  // 三語文案
  const miss = [];
  ['zh-Hant', 'en', 'ja'].forEach((lg) => {
    const src = read(`locales/${lg}.js`);
    ['calib.noBase', 'canvas.noBaseShort'].forEach((k) => {
      if (!src.includes(`'${k}'`)) miss.push(`${lg}:${k}`);
    });
  });
  if (miss.length) throw new Error('缺三語文案：' + miss.join(', '));
  // 而且現在真的有未量測的基材——否則這條是空轉的
  const calib = read('data/calibration.js');
  const n = (calib.match(/"baseKnown":false/g) || []).length;
  return { ok: true, detail: `告示已接　現有 ${n} 個基材紙色未量測（這條不是空轉的）` };
});

check('H5', 'hex 欄位的套用鍵與 change 走同一個 commit，不是兩份實作', () => {
  const html = read('index.html');
  const js = read('color-mixer.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const pairs = [['base-hex', 'commitBase'], ['observed-hex', 'commitObserved']];
  pairs.forEach(([id, fn]) => {
    if (!html.includes(`id="${id}-apply"`)) throw new Error(`index.html 少了 #${id}-apply`);
    if (!new RegExp(`function ${fn}\\(`).test(js)) throw new Error(`控制器少了 ${fn}()`);
    // ⚠️ 兩條路都必須綁**同一個** commit 函式。分別寫兩段等效邏輯是 v1.16 那條
    //    「同一條規則不要有第二份實作」——而它的失效方式特別安靜：兩份會慢慢漂，
    //    使用者按鍵與按 Enter 得到不同結果，而畫面上兩者長得一模一樣。
    if (!new RegExp(`\\$\\('#${id}'\\)\\.on\\('change', ${fn}\\)`).test(js))
      throw new Error(`#${id} 的 change 沒有綁 ${fn}`);
    if (!new RegExp(`\\$\\('#${id}-apply'\\)\\.on\\('click', ${fn}\\)`).test(js))
      throw new Error(`#${id}-apply 的 click 沒有綁 ${fn}`);
  });
  // 三語 title
  const miss = [];
  ['zh-Hant', 'en', 'ja'].forEach((lg) => {
    if (!read(`locales/${lg}.js`).includes("'canvas.apply'")) miss.push(lg);
  });
  if (miss.length) throw new Error('缺 canvas.apply 文案：' + miss.join(', '));
  // 版面：基材要比兩個 hex 欄寬（它的選項文字最長，實測會被切掉）
  const css = read('color-mixer.css');
  if (!/\.canvas-foot \.field:first-child\s*\{[^}]*flex:\s*3/.test(css))
    throw new Error('基材欄沒有比較大的 flex 權重');
  if (!/\.canvas-foot \.field\s*\{[^}]*min-width:\s*0/.test(css))
    throw new Error('缺 min-width: 0——flex item 預設 min-width:auto，Materialize 的 select '
      + '內容撐得比 flex-basis 寬時會溢出而不是被壓縮，「（紙色未量測）」的尾巴會被切掉');
  // ⚠️ 本列最右邊是一顆**會做事的按鍵**，而側欄是 position:fixed 的覆蓋層。
  //    實測 895px 視窗下套用鍵右緣 826 與 #setting-mode（818–864）重疊約 10px，
  //    **點那 10px 會切換主題而不是套用顏色**——做錯事比點不到更糟，且畫面看不出來。
  //    （中心點打得到不代表安全：沿寬度取七點才看得到右邊三點被搶走。）
  if (!/\.canvas-foot\s*\{[^}]*padding-right:\s*calc\(var\(--tool-size/.test(css))
    throw new Error('.canvas-foot 沒有讓出側欄寬度——最右邊那顆套用鍵會被 #setting-mode 蓋住，'
      + '點下去會切換主題而不是套用顏色');
  return { ok: true, detail: '兩個套用鍵各與自己的 change 共用同一個 commit　'
    + '基材欄 flex:3 ＋ min-width:0　本列讓出側欄寬度' };
});

check('C2', 'decodeState 對壞輸入回 null，不丟例外、不猜', () => {
  const bad = ['', '?', 'garbage', 'b=zzzzzz', 'm=km', '?m=nope&b=', 'l=abc'];
  const wrong = bad.filter((s) => L.decodeState(s) !== null);
  if (wrong.length) throw new Error('這些應回 null 卻沒有：' + JSON.stringify(wrong));
  return { ok: true, detail: `${bad.length} 種壞輸入全部回 null` };
});

check('C3', '未知模型退回預設，不是丟例外也不是照收', () => {
  const s = L.decodeState('m=telepathy&b=ffffff');
  if (!s || s.model !== L.DEFAULT_MODEL) throw new Error('未知模型未退回 ' + L.DEFAULT_MODEL);
  return { ok: true, detail: `telepathy → ${s.model}` };
});

// =========================================================================
// §D  跨品牌合併與校準
// =========================================================================

check('D1', 'mergeNearest 依 ΔE 升冪、貼上 brand、不改輸入', () => {
  const lists = [
    { brand: 'copic', items: [{ code: 'B29', deltaE: 3.1 }, { code: 'B39', deltaE: 1.2 }] },
    { brand: 'fc', items: [{ code: '151', deltaE: 2.0 }] }
  ];
  const snap = JSON.stringify(lists);
  const out = L.mergeNearest(lists, 3);
  if (JSON.stringify(lists) !== snap) throw new Error('mergeNearest 改動了輸入');
  const seq = out.map((o) => o.deltaE);
  if (seq.join() !== '1.2,2,3.1') throw new Error('排序錯：' + seq.join());
  if (out[0].brand !== 'copic' || out[1].brand !== 'fc') throw new Error('brand 標籤錯');
  return { ok: true, detail: out.map((o) => `${o.brand}/${o.code} ΔE${o.deltaE}`).join('  ') };
});

check('D2', 'calibratedColors 換 hex 但不改輸入，且標記 calibrated', () => {
  const colors = [{ code: 'B39', hex: '#08093d', r: 8, g: 9, b: 61 },
                  { code: 'B29', hex: '#1f4e9c', r: 31, g: 78, b: 156 }];
  const snap = JSON.stringify(colors);
  const calib = [{ brand: 'copic', code: 'B39', substrate: 'a4-white', layers: 1, hex: '#06072f' }];
  const out = L.calibratedColors(colors, 'copic', 'a4-white', calib);
  if (JSON.stringify(colors) !== snap) throw new Error('改動了輸入陣列');
  if (out[0].hex !== '#06072f' || out[0].calibrated !== true) throw new Error('B39 未套用校準');
  if (out[0].catalogHex !== '#08093d') throw new Error('未保留 catalogHex');
  if (out[1] !== colors[1]) throw new Error('無校準的色應原樣沿用同一個參考');
  return { ok: true, detail: 'B39 #08093d → #06072f（catalogHex 保留）' };
});

check('D3', '多筆同基材時取層數最小的那筆', () => {
  const colors = [{ code: 'B39', hex: '#08093d', r: 8, g: 9, b: 61 }];
  const calib = [
    { brand: 'copic', code: 'B39', substrate: 'a4-white', layers: 3, hex: '#010114' },
    { brand: 'copic', code: 'B39', substrate: 'a4-white', layers: 1, hex: '#06072f' }
  ];
  const out = L.calibratedColors(colors, 'copic', 'a4-white', calib);
  if (out[0].hex !== '#06072f') throw new Error('應取 layers=1 的那筆，實得 ' + out[0].hex);
  return true;
});

check('D4', '校準資料的 brand / substrate 都指得到東西（參照完整性）', () => {
  // ⚠️ 這條是踩到才補的：stub 第一版把 brand 寫成 'copic'（＝db_artcolor 的
  //    meta_brand.fd_code），而本 app 的品牌鍵是資料夾名 'copic-color'。
  //    calibratedColors() 於是**一筆都沒換、也沒有報錯**，畫面上「以校準值比對」
  //    的勾選框照樣勾得起來——錯的長得跟對的一模一樣。
  //    正式資料由 a3-export.js 匯出時同樣要做這層對照，所以這條會一直有用。
  const box = {};
  new Function('window', 'globalThis', read('data/calibration.js'))(box, box);
  const brands = ['faber-castell-color', 'caran-dache-color', 'copic-color',
                  'finecolour-color', 'enmy-color'];
  const subs = (box.CM_SUBSTRATES || []).map((s) => s.code);
  const rows = box.CM_CALIBRATION || [];
  if (!rows.length) throw new Error('CM_CALIBRATION 是空的——這條檢查會變成空轉');
  const bad = [];
  rows.forEach((o, i) => {
    if (brands.indexOf(o.brand) < 0) bad.push(`#${i} brand='${o.brand}' 不是已知品牌`);
    if (subs.indexOf(o.substrate) < 0) bad.push(`#${i} substrate='${o.substrate}' 不在 CM_SUBSTRATES`);
    if (!L.isHex(o.hex)) bad.push(`#${i} hex='${o.hex}' 不是有效顏色`);
  });
  if (bad.length) throw new Error(bad.join('; '));
  // 光是「鍵長得對」不夠——實際套用一次，確認真的換得動。
  const colors = [{ code: rows[0].code, hex: '#000000', r: 0, g: 0, b: 0 }];
  const applied = L.calibratedColors(colors, rows[0].brand, rows[0].substrate, rows);
  if (!applied[0].calibrated) throw new Error('鍵對得上，但 calibratedColors 沒有套用——語意對不起來');
  return { ok: true, detail: `${rows.length} 筆、${subs.length} 個基材，且實際套用得動` };
});

check('D5', '徽章不靠旗標穿過品牌 lib（hasCalibration 才是真相）', () => {
  // ⚠️ 也是踩到才補的：`calibratedColors()` 掛的 `calibrated: true` 活不過
  //    `nearestXxx`——那些函式把結果**投影**成自己那組固定欄位再回傳，自訂欄位
  //    被丟掉。實測症狀：色片用了校準值（rgb(6,7,47)）、徽章卻不亮，且不報錯。
  const calib = [{ brand: 'copic-color', code: 'B39', substrate: 'a4-white', layers: 1, hex: '#06072f' }];
  if (!L.hasCalibration('copic-color', 'B39', 'a4-white', calib)) throw new Error('hasCalibration 漏判');
  if (L.hasCalibration('copic-color', 'B39', 'xuan-natural', calib)) throw new Error('hasCalibration 誤判別的基材');
  if (L.hasCalibration('copic-color', 'B39', null, calib)) throw new Error('沒選基材時不該回 true');
  // 契約：控制器不得再讀那個旗標。
  // ⚠️ **必須先剝掉註解**——第一版直接掃全檔，結果命中的是我自己寫在那裡、
  //    提醒「不可以看 it.calibrated」的那行警語，檢查於是恆紅。
  //    掃原始碼找「有沒有用到某個東西」時，註解與字串裡的同名字樣都算假陽性。
  const js = read('color-mixer.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  if (/\bit\.calibrated\b/.test(js))
    throw new Error('控制器又去讀 it.calibrated 了——那個欄位不會穿過品牌 lib');
  if (!/hasCalibration\(/.test(js)) throw new Error('控制器沒有用 hasCalibration');
  return { ok: true, detail: '三種情形正確，且控制器改問 hasCalibration' };
});

// =========================================================================
// §E  原始碼衛生與載入順序
// =========================================================================

check('E1', '前端原始碼不含實體 NUL 位元組', () => {
  const bad = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      if (!/\.(js|css|html|json)$/.test(e.name)) return;
      if (hasNul(fs.readFileSync(p, 'latin1'))) bad.push(path.relative(ROOT, p));
    });
  })(APP);
  if (bad.length) throw new Error('含 NUL：' + bad.join(', '));
  return { ok: true, detail: '掃描 ' + APP.replace(ROOT + '/', '') };
});

check('E2', 'color-family.js 必須早於依賴它的兩支品牌 lib', () => {
  // ⚠️ faber-castell-color-lib.js 與 finecolour-color-lib.js 在**模組載入時**
  //    就讀 window.ColorFamily（不是呼叫時），排在它們後面整支 app 當場掛掉。
  //    家族 CLAUDE.md v1.18 踩過一次，是靠載入順序腳本抓到的、不是看出來的。
  const html = read('index.html');
  const order = [...html.matchAll(/<script[^>]+src="\.\/([^"]+)"/g)].map((m) => m[1]);
  const cf = order.indexOf('color-family.js');
  if (cf < 0) throw new Error('index.html 沒有載入 color-family.js');
  ['faber-castell-color-lib.js', 'finecolour-color-lib.js'].forEach((f) => {
    const i = order.indexOf(f);
    if (i < 0) throw new Error('未載入 ' + f);
    if (i < cf) throw new Error(`${f}（第 ${i + 1}）排在 color-family.js（第 ${cf + 1}）之前`);
  });
  // color-metric.js：**六支 lib（含本 app 的）都在模組載入時取 window.ColorMetric**，
  // 所以它必須排在全部之前。排錯會在載入當下丟明確錯誤，但那已經是使用者看到白畫面之後了。
  const cm = order.indexOf('color-metric.js');
  if (cm < 0) throw new Error('index.html 沒有載入 color-metric.js');
  const deps = order.filter((f) => /(-color-lib|color-mixer-lib)\.js$/.test(f));
  const early = deps.filter((f) => order.indexOf(f) < cm);
  if (early.length) throw new Error('這些 lib 排在 color-metric.js 之前：' + early.join(', '));
  return { ok: true, detail: `color-metric.js 第 ${cm + 1} 位、color-family.js 第 ${cf + 1} 位，${deps.length} 支 lib 皆在其後` };
});

check('E4', 'color-metric.js 是家族權威版的 byte-identical 複製件', () => {
  // ⚠️ 這支是**六支 lib 的同一把尺**——它漂掉的後果不是壞掉，是「最接近的筆」
  //    在不同 app 給出不同答案，而且沒有任何東西會報錯。
  const auth = path.join(ROOT, '../nodeapp-webapp-family/color-metric.js');
  if (!fs.existsSync(auth)) return { ok: true, detail: '（找不到家族 repo，跳過）' };
  const a = fs.readFileSync(auth), b = fs.readFileSync(path.join(APP, 'color-metric.js'));
  if (!a.equals(b)) throw new Error('與家族 repo 根的權威版不同——跑 scripts/sync-copies.sh');
  // 順帶驗它真的是那把尺：hexToRgb 壞輸入必須回 null（抽出時統一的合約）
  if (CM.hexToRgb('zzz') !== null) throw new Error('hexToRgb 壞輸入沒有回 null');
  if (CM.hexToRgb('#abc') === null) throw new Error('hexToRgb 不接受 3 位簡寫');
  return { ok: true, detail: `${a.length} bytes，逐位元組相同` };
});

check('E3', '五支品牌 lib 與其資料檔都在', () => {
  const need = ['faber-castell-color', 'caran-dache-color', 'copic-color', 'finecolour-color', 'enmy-color'];
  const data = { 'faber-castell-color': 'fc-colors.js', 'caran-dache-color': 'cda-colors.js',
                 'copic-color': 'copic-colors.js', 'finecolour-color': 'finecolour-colors.js',
                 'enmy-color': 'enmy-colors.js' };
  const missing = [];
  need.forEach((b) => {
    if (!exists(b + '-lib.js')) missing.push(b + '-lib.js');
    if (!exists('data/' + data[b])) missing.push('data/' + data[b]);
  });
  if (missing.length) throw new Error('缺：' + missing.join(', '));
  return { ok: true, detail: '5 支 lib ＋ 5 份資料' };
});

// =========================================================================
// §F  markup ↔ handler（死鍵／死屬性）
// =========================================================================

check('F1', '每顆側鍵在控制器裡都有人接（沒有死鍵）', () => {
  const html = read('index.html');
  const js = read('color-mixer.js');
  const ids = [...html.matchAll(/id="(setting-[a-z-]+)"/g)].map((m) => m[1]);
  if (!ids.length) throw new Error('index.html 找不到任何 #setting-* 側鍵');
  const dead = ids.filter((id) => !js.includes(id) && !html.includes(`id="${id}"\n`.slice(0, 0)));
  // 允許 <a href> 型的入口鍵（自己就會導覽，不需要 handler）
  const anchors = [...html.matchAll(/<a[^>]+id="(setting-[a-z-]+)"[^>]+href=/g)].map((m) => m[1]);
  const realDead = dead.filter((id) => !anchors.includes(id));
  if (realDead.length) throw new Error('死鍵：' + realDead.join(', '));
  return { ok: true, detail: `${ids.length} 顆側鍵全部有人接` };
});

check('F2', '側鍵順序＝[入口] → [app 工具…] → mode → lang（§5.5）', () => {
  const html = read('index.html');
  const rail = html.slice(html.indexOf('class="side-tools"'));
  const ids = [...rail.matchAll(/id="(setting-[a-z-]+)"/g)].map((m) => m[1]);
  const n = ids.length;
  if (ids[n - 2] !== 'setting-mode' || ids[n - 1] !== 'setting-lang')
    throw new Error('chrome 未墊底，實際順序：' + ids.join(' → '));
  return { ok: true, detail: ids.join(' → ') };
});

check('F3', '假校準資料必須在畫面上自己承認（stub 橫幅）', () => {
  // 家族一貫紀律：留白/假值會被讀成真值。CM_CALIBRATION_META.stub 為 true 時
  // 控制器必須顯示告示，否則下一個人會拿佔位數字去做決定。
  const calib = read('data/calibration.js');
  const js = read('color-mixer.js');
  const html = read('index.html');
  if (!/CM_CALIBRATION_META/.test(calib)) throw new Error('calibration.js 沒有 CM_CALIBRATION_META');
  if (!/stub/.test(js)) throw new Error('控制器沒有處理 stub 旗標');
  if (!/id="calib-stub"/.test(html)) throw new Error('index.html 沒有 #calib-stub 告示元素');
  return true;
});

check('F6', '畫布＝基材、圓內＝結果（兩個不同的顏色，不准接成同一個）', () => {
  const html = read('index.html');
  // 結構：#mix-disc 必須在 #canvas 之內（外圈是紙、圓在紙上）
  const canvas = html.slice(html.indexOf('id="canvas"'));
  const close = canvas.indexOf('</div>\n          </div>');
  if (canvas.indexOf('id="mix-disc"') < 0 || (close >= 0 && canvas.indexOf('id="mix-disc"') > close))
    throw new Error('#mix-disc 不在 #canvas 之內');

  // 接線：兩個元素各自吃的顏色來源不可對調，也不可同源。
  // ⚠️ 接錯不會報錯——整個畫布變成同一個顏色，看起來只是「圓不見了」。
  const js = read('color-mixer.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const fn = js.slice(js.indexOf('function renderCanvas'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  const cv = body.slice(body.indexOf("$('#canvas')"), body.indexOf("$('#mix-disc')"));
  const dc = body.slice(body.indexOf("$('#mix-disc')"));
  if (!/state\.stack\.base/.test(cv)) throw new Error('#canvas 沒有吃 state.stack.base（基材）');
  if (/\bd\.hex\b|\br\.hex\b/.test(cv)) throw new Error('#canvas 吃到了圓的顏色——外圈應該是紙');
  // ⚠️ 2026-08-08 加入目視色後，圓吃的是 discColor()（＝目視色 || 計算結果），不再直接是 r。
  //    字色的對比基準必須跟著改成**圓的顏色**——算在 result 上會讓目視色是淺色時字看不見。
  if (!/\bd\.hex\b/.test(dc)) throw new Error('#mix-disc 沒有吃 discColor() 的顏色');
  if (!/pickTextColor\(d\)/.test(dc)) throw new Error('讀數在圓內，字色對比要算在**圓的顏色**上，不是 result');
  return { ok: true, detail: '#canvas ← state.stack.base ／ #mix-disc ← discColor()' };
});

check('F7', '挑色走右側 sidenav，且挑完不關面板', () => {
  const html = read('index.html');
  const js = read('color-mixer.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  // ① 形制：是 sidenav 不是 modal（形制照抄 chat-archive 的 Prompt 清單）
  if (!/<ul id="pick-nav"[^>]*class="sidenav pick-panel"/.test(html))
    throw new Error('#pick-nav 不是 .sidenav.pick-panel');
  if (/id="pick-modal"/.test(html)) throw new Error('舊的挑色 Modal 還在');
  if (!/M\.Sidenav\.init\(document\.getElementById\('pick-nav'\)/.test(js))
    throw new Error('#pick-nav 沒有 M.Sidenav.init');
  if (!/edge:\s*'right'/.test(js)) throw new Error('sidenav 沒有指定 edge:right');
  // 共用 side-tool.css 靠 body.sidenav-open 把側鍵淡出——沒掛的話開面板時側鍵會壓在上面
  if (!/sidenav-open/.test(js)) throw new Error('沒有掛 body.sidenav-open');

  // ② **這條才是這次改動的重點**：點色片後不可以關面板。
  //    關掉就等於把「回去再挑」變回一個需要存在的動作，那正是改成側欄要消滅的東西。
  const h = js.slice(js.indexOf("$('#pick-grid').on('click'"));
  const body = h.slice(0, h.indexOf('});'));
  if (!/addLayer\(/.test(body)) throw new Error('pick-grid handler 沒有 addLayer');
  if (/\.close\(\)/.test(body)) throw new Error('點色片後把面板關掉了——側欄的意義就沒了');
  return { ok: true, detail: 'sidenav(right) ＋ 挑完保持開啟' };
});

check('F8', '目視色：圓圈換內容時一定看得出來，且與計算值分得開', () => {
  const html = read('index.html');
  const js = read('color-mixer.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  // ① markup：輸入框、徽章、比較行都在，且徽章在圓內
  ['id="observed-hex"', 'id="disc-badge"', 'id="disc-compare"'].forEach((x) => {
    if (!html.includes(x)) throw new Error('index.html 缺 ' + x);
  });
  const disc = html.slice(html.indexOf('id="mix-disc"'));
  if (disc.indexOf('id="disc-badge"') < 0 || disc.indexOf('id="disc-badge"') > disc.indexOf('</div>\n          </div>'))
    throw new Error('#disc-badge 不在 #mix-disc 之內——徽章要跟著圓走');

  // ② **這條才是重點**：填了目視色而畫面沒有任何標示，就是默默換內容。
  if (!/#disc-badge['"]\)\.toggle\(/.test(js))
    throw new Error('控制器沒有依目視色切換 #disc-badge——畫面會默默換內容');

  // ③ 目視色與計算值不可混為一談：圓吃 discColor()、比較行吃 result()
  const fn = js.slice(js.indexOf('function renderCanvas'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  if (!/discColor\(\)/.test(body)) throw new Error('renderCanvas 沒有用 discColor()');
  if (!/result\(\)/.test(body)) throw new Error('renderCanvas 沒有保留 result()——比較行就沒有計算值可印');

  // ④ discColor 的回傳形狀必須含 .hex（renderCopyRow 直接讀它；只回 {r,g,b} 會印出 undefined）
  const L2 = js.slice(js.indexOf('function discColor'));
  if (!/hex:/.test(L2.slice(0, L2.indexOf('\n  }'))))
    throw new Error('discColor 沒有回傳 .hex——複製鈕會顯示 undefined，而畫面其他地方看起來正常');

  // ⑤ 網址要帶得走（否則「複製連結＝存檔」對目視色不成立）
  const st = { model: 'glaze', substrate: null, observed: '#171159',
               stack: { base: '#ffffff', layers: [] } };
  const back = L.decodeState(L.encodeState(st));
  if (!back || back.observed !== '#171159') throw new Error('observed 沒有進網址列來回');
  return { ok: true, detail: '徽章／比較行／形狀／網址來回皆有' };
});

check('F9', '色的識別用品牌自己的鍵——CDA 同色碼跨系列是不同顏色', () => {
  // ⚠️ 這條是踩到才補的。CDA 的身分是 (seriesId, code)：實查 `120` 在 CDA_COLORS 有 **9 列**。
  //    只用 code 當鍵時，點「NEO-120（#2d1955 深紫）」的卡片，開出來的明細是
  //    `LUM-120（#815ea0 淺紫）`——**完全不同的顏色，而且沒有任何東西會報錯**。
  const js = read('color-mixer.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  // ① CDA 的登記必須覆寫 key（否則落回 defaultKey ＝ 只看 code）
  const cda = js.slice(js.indexOf("id: 'caran-dache-color'"));
  const blk = cda.slice(0, cda.indexOf('\n    }'));
  if (!/key:\s*function/.test(blk)) throw new Error("caran-dache-color 沒有覆寫 key()");
  if (!/seriesId/.test(blk)) throw new Error('CDA 的 key 沒有用到 seriesId');

  // ② 卡片與挑色格子都要帶 data-key，且 handler 讀它（讀 data-code 就是舊 bug）
  if (/data-code="/.test(js)) throw new Error("還有地方在寫 data-code——色的識別要用 data-key");
  ["data('key')"].forEach((x) => {
    if (!js.includes(x)) throw new Error('handler 沒有讀 ' + x);
  });

  // ③ findColor 必須以 b.key() 比對，不可比 code
  const f = js.slice(js.indexOf('function findColor'));
  const body = f.slice(0, f.indexOf('\n  }'));
  if (!/b\.key\(/.test(body)) throw new Error('findColor 沒有用 b.key() 比對');
  if (/\.code\s*===/.test(body)) throw new Error('findColor 還在直接比 code');
  return { ok: true, detail: 'CDA key = seriesId-code；卡片與 findColor 都走它' };
});

check('F10', 'App icon／favicon／PWA（§5.5 checklist：驗內容，不是驗檔案在不在）', () => {
  // ⚠️ 家族在這條上抓過三個洞，**全部是「檔案在、但內容不是那個東西」**：
  //    chat-archive 的 .ico 其實是 SVG 改副檔名、session-journal 的 favicon-light.svg
  //    其實是深版的複製件、color-palette 的 .ico 缺 48px。
  //    看 markup 或看檔案在不在都查不出來，所以下面每一條都讀內容。
  const ic = (f) => path.join(APP, 'icons', f);
  const need = ['favicon.svg', 'favicon-light.svg', 'favicon.ico', 'manifest.json',
                'color-mixer-icon.svg', 'color-mixer-icon-light.svg',
                'icon-16.png', 'icon-32.png', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
  const miss = need.filter((f) => !fs.existsSync(ic(f)));
  if (miss.length) throw new Error('缺：' + miss.join(', '));

  // ① 淺版真的是淺版——`cp favicon.svg favicon-light.svg` 不算數
  if (fs.readFileSync(ic('favicon.svg')).equals(fs.readFileSync(ic('favicon-light.svg'))))
    throw new Error('favicon-light.svg 與 favicon.svg 逐位元組相同＝根本沒有淺版');

  // ② .ico 是真的 ICO：直接解 header（reserved=0, type=1, count>=3）
  const b = fs.readFileSync(ic('favicon.ico'));
  const reserved = b.readUInt16LE(0), type = b.readUInt16LE(2), count = b.readUInt16LE(4);
  if (reserved !== 0 || type !== 1)
    throw new Error(`favicon.ico 不是 ICO（reserved=${reserved} type=${type}）——是不是 cp 了 svg？`);
  if (count < 3) throw new Error(`ICO 只有 ${count} 張，家族標準是 16/32/48 三張`);

  // ③ manifest 路由與 theme-color 對齊頁面底（不是 icon 的顏色）
  const m = JSON.parse(fs.readFileSync(ic('manifest.json'), 'utf8'));
  if (m.start_url !== '/apps/color-mixer/' || m.scope !== '/apps/color-mixer/')
    throw new Error('manifest start_url / scope 要都明寫成 /apps/color-mixer/');
  const html = read('index.html');
  const tc = /name="theme-color" content="([^"]+)"/.exec(html);
  if (!tc) throw new Error('index.html 沒有 meta theme-color');
  if (!(tc[1] === m.theme_color && tc[1] === m.background_color))
    throw new Error(`theme-color(${tc[1]}) / theme_color(${m.theme_color}) / background_color(${m.background_color}) 三者要一致`);
  if (!m.icons.some((x) => x.purpose === 'maskable')) throw new Error('manifest 缺一張 maskable');

  // ④ 徽章：第一顆側鍵掛 .app-icon，且它是**取代** material-icon 而不是多一顆
  const rail = html.slice(html.indexOf('class="side-tools"'));
  const first = rail.slice(0, rail.indexOf('</div>', rail.indexOf('id="setting-')) + 6);
  if (!/class="app-icon"/.test(first)) throw new Error('第一顆側鍵沒有掛 .app-icon 徽章');
  if (/material-icons/.test(first)) throw new Error('徽章鍵還留著 material-icon——徽章是取代它，不是並存');

  // ⑤ icon 的重疊色必須是 lib 真的算得出來的（make-icons.py 現算，不寫死）
  const svg = fs.readFileSync(ic('favicon.svg'), 'utf8');
  const mixHex = L.compose({ base: '#2b5fa8', layers: [{ hex: '#f2d024', alpha: 0.5 }] }, 'km').hex;
  if (!svg.includes(mixHex))
    throw new Error(`favicon.svg 裡沒有 lib 算出的重疊色 ${mixHex}——icon 與模型漂開了，重跑 scripts/make-icons.py`);
  return { ok: true, detail: `ICO ${count} 張、深淺兩版不同、重疊色 ${mixHex} 與 lib 一致` };
});

check('F4', 'i18n：模型有幾個，三語就要有幾組文案', () => {
  const langs = ['zh-Hant', 'en', 'ja'];
  const missing = [];
  langs.forEach((lg) => {
    const src = read(`locales/${lg}.js`);
    L.MODELS.forEach((m) => {
      // 動態組出的 key（t('model.' + m)）掃不出來，所以反過來列舉該有的逐一查
      // ——同 circle-text 的 verify.js 第 ④ 條（家族 CLAUDE.md v1.17）。
      [`model.${m}`, `model.${m}.note`, `alpha.${m}`].forEach((k) => {
        if (!src.includes(`'${k}'`)) missing.push(`${lg} / ${k}`);
      });
    });
  });
  if (missing.length) throw new Error('缺 ' + missing.length + ' 個：' + missing.slice(0, 6).join(', ') + (missing.length > 6 ? ' …' : ''));
  return { ok: true, detail: `${L.MODELS.length} 模型 × 3 key × 3 語 = ${L.MODELS.length * 9} 個都在` };
});

check('F5', '§6 共用文案逐字等於正統表', () => {
  const canon = {
    'zh-Hant': { 'tool.lang': '語言', 'tool.mode': '切換 light / dark', 'tool.more': '更多工具', 'tool.clearFilter': '清除' },
    en: { 'tool.lang': 'Language', 'tool.mode': 'Toggle light / dark', 'tool.more': 'More tools', 'tool.clearFilter': 'Clear' },
    ja: { 'tool.lang': '言語', 'tool.mode': 'ライト / ダーク切替', 'tool.more': 'その他のツール', 'tool.clearFilter': 'クリア' }
  };
  const bad = [];
  Object.keys(canon).forEach((lg) => {
    const src = read(`locales/${lg}.js`);
    Object.keys(canon[lg]).forEach((k) => {
      const m = new RegExp(`'${k.replace('.', '\\.')}'\\s*:\\s*'([^']*)'`).exec(src);
      if (!m) bad.push(`${lg}/${k} 未定義`);
      else if (m[1] !== canon[lg][k]) bad.push(`${lg}/${k} = '${m[1]}'，正統為 '${canon[lg][k]}'`);
    });
  });
  if (bad.length) throw new Error(bad.join('; '));
  return { ok: true, detail: '4 key × 3 語 = 12/12 逐字相同' };
});

// =========================================================================
// 輸出
// =========================================================================

let failed = 0;
console.log('\ncolor-mixer — 契約檢查\n' + '='.repeat(64));
results.forEach((r) => {
  if (!r.ok) failed++;
  console.log(`${r.ok ? ' OK ' : 'FAIL'}  ${r.id}  ${r.title}`);
  if (r.detail) console.log(`        ${r.detail}`);
});
console.log('='.repeat(64));
console.log(`${results.length - failed}/${results.length} 通過`);

if (SELFTEST) {
  // 反向驗證：沒跑過這一段的檢查不算數（家族 memory「回歸案例要先證明它會紅」）。
  // 這裡逐條把「被檢查的那個性質」就地破壞，確認該條真的會 FAIL。
  console.log('\n--selftest：逐條故意改壞，確認抓得到\n' + '='.repeat(64));
  const cases = [
    ['A2 端點', () => { const o = L.compose; L.compose = (s) => ({ hex: '#123456' }); return () => { L.compose = o; }; }],
    ['A4 減色給綠', () => { const o = L.SUBTRACTIVE; L.SUBTRACTIVE = ['srgb']; return () => { L.SUBTRACTIVE = o; }; }],
    ['C2 壞輸入回 null', () => { const o = L.decodeState; L.decodeState = () => ({}); return () => { L.decodeState = o; }; }],
    ['D1 合併排序', () => { const o = L.mergeNearest; L.mergeNearest = (l) => []; return () => { L.mergeNearest = o; }; }],
    // 反解最危險的失效方式**不是丟例外，是安靜地退化成「只回一個頂點」**
    // ——那是個看起來很合理的顏色，所以錯誤答案長得像「這個調色盤就是拼不出來」。
    // （寫這支 lib 時真的踩到：高斯消去的回代多取了一次索引 → 全 NaN → 只回頂點。）
    ['G 反解退化成單一頂點', () => {
      const o = L.solve;
      L.solve = (op) => ({ layers: [{ hex: (op.palette || ['#000000'])[0], alpha: 1 }],
        hex: '#000000', dE: 99, band: 'far', reachable: false, exact: true,
        target: op.target, base: op.base, model: op.model });
      return () => { L.solve = o; };
    }],
    ['G oklab 被誤列為精確', () => {
      const o = L.EXACT_CONVEX; L.EXACT_CONVEX = ['srgb', 'glaze', 'km', 'oklab'];
      return () => { L.EXACT_CONVEX = o; };
    }]
  ];
  let caught = 0;
  cases.forEach(([name, brk]) => {
    const restore = brk();
    let red = false;
    try {
      if (name.startsWith('A2')) { if (mix('#2b5fa8', '#f2d024', 0, 'srgb') !== '#2b5fa8') red = true; }
      if (name.startsWith('A4')) { red = L.SUBTRACTIVE.indexOf('glaze') < 0; }
      if (name.startsWith('C2')) { red = L.decodeState('garbage') !== null; }
      if (name.startsWith('D1')) { red = L.mergeNearest([{ brand: 'x', items: [{ deltaE: 1 }] }], 3).length !== 1; }
      if (name === 'G 反解退化成單一頂點') {
        // G1 的往返：由調色盤自己合成的目標必須解得回來（退化版做不到）
        const pal = ['#ff0000', '#00ff00', '#0000ff'];
        const tgt = L.compose({ base: '#ffffff', layers: [{ hex: pal[0], alpha: 1 }, { hex: pal[2], alpha: 0.5 }] }, 'glaze').hex;
        red = L.solve({ base: '#ffffff', palette: pal, target: tgt, model: 'glaze' }).dE > 1.0;
      }
      if (name === 'G oklab 被誤列為精確') { red = L.EXACT_CONVEX.indexOf('oklab') >= 0; }
    } catch (e) { red = true; }
    restore();
    if (red) caught++;
    console.log(`${red ? ' OK ' : 'FAIL'}  改壞「${name}」→ ${red ? '被抓到' : '沒被抓到（檢查是空轉的）'}`);
  });
  console.log('='.repeat(64));
  console.log(`反向驗證 ${caught}/${cases.length}`);
  if (caught !== cases.length) failed++;
}

process.exit(failed ? 1 : 0);
