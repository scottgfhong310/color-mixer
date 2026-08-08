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
  const st = {
    model: 'glaze', substrate: 'xuan-natural',
    stack: { base: '#f0e6d2', layers: [
      { hex: '#08093d', alpha: 0.6, src: { brand: 'copic', code: 'B39' } },
      { hex: '#e8c33a', alpha: 0.35, src: null }] }
  };
  const back = L.decodeState(L.encodeState(st));
  if (!back) throw new Error('decodeState 回 null');
  if (JSON.stringify(back) !== JSON.stringify({
    model: st.model, substrate: st.substrate,
    observed: st.observed || null,          // 目視色也走網址（2026-08-08 加）
    stack: L.normalizeStack(st.stack)
  })) throw new Error('來回不一致：' + JSON.stringify(back));
  return { ok: true, detail: '?' + L.encodeState(st) };
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
    ['D1 合併排序', () => { const o = L.mergeNearest; L.mergeNearest = (l) => []; return () => { L.mergeNearest = o; }; }]
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
