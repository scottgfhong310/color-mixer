/**
 * color-mixer-lib — 調色盤的純核心
 *
 * IIFE → window.ColorMixerLib。零依賴、不碰 DOM、不用 fetch（資料是靜態 registry）。
 * 控制器（color-mixer.js）才碰 DOM。
 *
 * ── 這支 lib 在回答什麼 ────────────────────────────────────────────────
 * 一次調色＝一個 **stack**：一個底色（畫布／基材），上面疊若干半透明顏料層。
 *
 *   Stack = {
 *     base:   '#f0e6d2',                                  // 畫布底色（＝基材的紙色）
 *     layers: [ { hex:'#1f4e9c', alpha:0.6,               // alpha 語意見下
 *                 src:{ brand:'copic', code:'B39' } },    // 來自家族色；自調色為 null
 *               { hex:'#e8c33a', alpha:0.35, src:null } ]
 *   }
 *
 * `compose(stack, model)` 把它算成一個結果色。**純函式、不改輸入**
 * （DATA_OBJECT_GUIDELINES）；控制器不保存結果，畫面與每個出口各自重算，
 * 所以「畫面與輸出不一致」這個 bug 類別在結構上不存在（同 circle-text、v1.17）。
 *
 * ── 四個混色模型：它們回答的不是同一個問題 ────────────────────────────
 * 「兩個顏色疊起來會變成什麼」沒有唯一答案。四個模型分成兩組：
 *
 *   ▸ 光的疊加（additive compositing）——問「螢幕上長怎樣」
 *   'srgb'   直接在 sRGB 位元組上線性插值。**這就是瀏覽器的行為**
 *            （CSS `rgba()`／canvas `globalAlpha`）。它不是顏料——而且它連光
 *            都不算對（在 gamma 編碼值上插值）。
 *   'oklab'  兩色轉 OKLab 後插值再轉回。修掉上面那個 gamma 錯誤，明度變化感知均勻。
 *            ⚠️ **但它不會讓中段「不發灰」**——互補色之間走直線會穿過中性軸，
 *            實測反而比 sRGB 更灰（見下面那組彩度）。仍是光的疊加。
 *
 *   ▸ 減色（subtractive）——問「顏料會怎樣」
 *   'glaze'  **罩染**：在光學密度 −log(R) 上插值，等價於 R = R下^(1−a) · R墨^a
 *            （Beer-Lambert）。這是**透明墨層蓋在基材上**的標準模型——麥克筆、
 *            透明水彩、照相染料都是這個行為。
 *   'km'     **調色盤混合**：單常數 Kubelka-Munk，把線性反射率反推成 K/S
 *            （吸收/散射比），依濃度加權相加再解回。這是**兩坨顏料混在一起**。
 *
 * ⚠️ **`glaze` 與 `km` 不可互換，差別在紙色會不會透出來**（2026-08-07 實測）：
 *    同一支 COPIC B39（`#08093d`）疊在白紙 `#ffffff` 與宣紙 `#f0e6d2` 上——
 *    兩張紙本身相差 ΔE00 **10.12**，而算出來的結果差：
 *
 *      alpha    0.15   0.30   0.50   0.70   0.85   0.95
 *      glaze    7.65   5.47   2.56   1.22   0.64   0.25   ← 隨濃度遞減，物理上對
 *      km       0.35   0.20   0.22   0.00   0.00   0.00   ← 紙色**完全消失**
 *
 *    這不是 km 的實作 bug，是**模型能力的界線**：單常數 K-M 描述的是「混合物」，
 *    它假設無限厚的不透光層，本來就沒有「透光看見基材」這回事（要有的話得用
 *    有厚度的 K-M ＋ Saunderson 修正，那需要每個顏料的散射係數——我們沒有）。
 *    **所以「同一支筆在不同紙上」這個問題只有 glaze／srgb／oklab 答得出來**，
 *    而那正是本 app 的校準功能在問的問題，故 `glaze` 是預設值。
 *
 * ⚠️ **`km` 對「純數位原色」會失真**：`#0000ff` ＋ `#ffff00` 各半，km 給
 *    `#161616`（近乎全黑）——通道值為 0 時 K/S 爆掉。同一組 glaze 給 `#474747`
 *    （灰，退化得優雅但也不是綠）。**真實顏料的 hex 沒有這個問題。**
 *
 * ── 減色模型的價值：藍 `#2b5fa8` ＋ 黃 `#f2d024` 各半（2026-08-07 實測） ──
 *    判別量**不是色相，是彩度**——四個模型的色相都落在綠區，差別在混得多灰：
 *
 *      model    hex        L     C(Lab 彩度)   hue
 *      srgb     #8f9866   61.0      27.9      115°
 *      oklab    #8d9c89   62.7      12.2      138°   ← 最灰，見上面那條警語
 *      glaze    #6b8e51   55.1      37.1      130°
 *      km       #3d7833   45.2      46.3      137°   ← 彩度與藍色輸入相當
 *      （輸入自己：藍 C=45.1、黃 C=79.6）
 *
 *    **兩個減色模型的彩度都高於兩個光合成模型**，這才是「顏料會混出綠」那句話
 *    可驗證的形式。`scripts/verify.js` 的 A4 條就是照這個判準寫的——
 *    第一版寫成「綠通道是不是最大」，四個模型全部通過，**等於什麼都沒驗到**。
 *
 * ⚠️ **glaze／km 都是近似，不是真值**。真正的 K-M 需要每個顏料實測的 K 與 S
 *    光譜曲線；我們手上只有一個 sRGB hex（而且它本身多半來自型錄印刷品——
 *    COPIC 官方自述「印刷色 ≠ 墨水」）。由 hex 反推等於假設「三個通道各自獨立」，
 *    這不真。**畫面上一律標「近似」，不要讓它看起來像量出來的。**
 *
 * ⚠️ **同一個 alpha 滑桿在四個模型下語意不同**，這是真實差異、不是實作瑕疵：
 *      srgb / oklab → **覆蓋率**（這一層蓋掉下層多少）
 *      glaze        → **墨層厚度／濃度**（光穿過幾次）
 *      km           → **濃度**（這一層的顏料佔混合物多少比例）
 *    四者兩端點一致（0＝只有下層、1＝只有這一層，已實測），中間的性格不同。
 *    UI 要講出來——不講的話，使用者換個模型看到數字變了會以為是 bug。
 *
 * ── 色彩度量核心：共用件 color-metric.js ────────────────────────────────
 * hexToRgb / rgbToHsl / rgbToLab / deltaE / deltaEBand / relLuminance /
 * contrastRatio / pickTextColor **已於 2026-08-08 抽成家族共用件**
 * （權威版在家族 repo 根）。六支 lib 從此共用同一把尺——本 app 第一版時
 * 寫著「刻意不混進第一版」，那筆帳已經結了。
 * ⚠️ 抽出時實查發現「六份逐字相同」**當時已經不成立**：四個函式分兩派，
 *    其中 `hexToRgb` 是真的行為差異（一派壞輸入回 null、一派永不回 null）。
 *    細節與統一後的合約見共用件檔頭。
 * ⚠️ `<script src="color-metric.js">` 必須排在本檔之前（verify.js E2／E4 擋著）。
 *
 * ── 為什麼沒有 nearestAcross ──────────────────────────────────────────
 * 本 lib **不自己算最接近色**，只提供 `mergeNearest`。因為五個品牌的比對器
 * 各有各的規矩：`nearestFC` 預設只比 `ag`（Black Edition 是另一條產品線，
 * 不能拿來回答「該拿哪支筆」）、`nearestCDA` 排除 PSTC（與 PSTP 同一份調色盤）、
 * COPIC／Finecolour 排除無色調和筆、Finecolour 預設只比 marker 色號空間、
 * ENMY 遇到收錄不明的套組會**忽略該過濾條件而不是回空陣列**。
 * 在這裡重寫一份等於「同一條規則有第二份實作」（v1.16）——那五支才是規則的家。
 *
 * API：
 *   FOLDER · MODELS · DEFAULT_MODEL · MAX_LAYERS
 *   compose(stack, model) → { hex, r, g, b, steps:[hex…] }   逐層合成（純函式）
 *   over(dst, src, alpha, model) → {r,g,b}                    單層合成（浮點，未取整）
 *   normalizeStack(raw) → Stack                               補預設值、夾範圍（不改輸入）
 *   encodeState(state) → 'm=…&b=…&o=…&l=…'                    網址列＝存檔（無前導 ?）
 *       state = { model, substrate, observed, stack }。`observed` 是**目視色**——
 *       使用者看到的顏色，不參與合成，故是 state 的同層欄位而不是 stack 的一部分。
 *   decodeState(qs) → state | null                            壞字串回 null，不丟例外
 *   mergeNearest(lists, n) → [{ brand, code, name, hex, deltaE, band, … }]
 *   substrateOf(code, substrates) → Substrate | null
 *   hasCalibration(brand, code, substrate, calib) → boolean   要標記徽章時問這支，見其註解
 *   calibrationFor(brand, code, calib) → Obs[]                某支筆的所有校準紀錄
 *   calibratedColors(colors, brand, substrateCode, calib) → Color[]
 *       把有校準紀錄的色的 hex 換成校準值（**不改輸入**，回新陣列）；無紀錄者原樣留下
 *   hexToRgb · rgbToHex · rgbToHsl · rgbToLab · deltaE(ΔE00) · deltaEBand
 *   relLuminance · contrastRatio · pickTextColor · formatRgb
 *   buildCss(stack, model, result) → string                   把這次調色輸出成一段 CSS
 *   cssFilename() → 'color-mixer.css'
 */
(function (global) {
  'use strict';
  // ---- 色彩度量核心：家族共用件 color-metric.js（權威版在家族 repo 根）------
  //
  // 這一段（hexToRgb／relLuminance／contrastRatio／pickTextColor／rgbToHsl／
  // rgbToLab／deltaE／deltaEBand）原本在六支 lib 裡各有一份「號稱逐字相同」的複製。
  // 2026-08-08 實查發現其中四個函式已分成兩派（詳見共用件檔頭），故抽出。
  // 下面保留同名的薄包裝，**本檔的 Public API 與所有呼叫端一行都不必改**。
  //
  // ⚠️ 載入順序是硬條件：本檔在**模組載入時**就取 window.ColorMetric，
  //    <script src="color-metric.js"> 必須排在本檔之前。
  if (!global.ColorMetric) {
    throw new Error('color-mixer-lib.js 需要共用件 color-metric.js，' +
      '且 <script> 必須排在本檔之前（見 SHARED_LIBRARY_GUIDELINES §4）');
  }
  var CM = global.ColorMetric;


  var FOLDER = 'color-mixer';
  var MODELS = ['srgb', 'oklab', 'glaze', 'km'];
  // 預設是 glaze：本 app 的核心情境是「墨／顏料罩染在紙上」，而只有它與兩個
  // 光合成模型表達得出紙色的影響（見檔頭的實測表）。
  var DEFAULT_MODEL = 'glaze';
  var ADDITIVE = ['srgb', 'oklab'];      // 光的疊加
  var SUBTRACTIVE = ['glaze', 'km'];     // 減色（近似）
  var MAX_LAYERS = 8;

  // ---- 小工具 -----------------------------------------------------------

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function clamp01(v) { return clamp(v, 0, 1); }
  function isHex(s) { return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || '')); }

  // ---- 色彩度量：全部委派給共用件 color-metric.js（見上方守衛） ----------

  function hexToRgb(hex) { return CM.hexToRgb(hex); }
  function relLuminance(r, g, b) { return CM.relLuminance(r, g, b); }
  function contrastRatio(r, g, b, fgIsWhite) { return CM.contrastRatio(r, g, b, fgIsWhite); }
  function pickTextColor(color) { return CM.pickTextColor(color); }
  function rgbToHsl(r, g, b) { return CM.rgbToHsl(r, g, b); }
  function rgbToLab(r, g, b) { return CM.rgbToLab(r, g, b); }
  function deltaE(labA, labB) { return CM.deltaE(labA, labB); }
  function deltaEBand(dE) { return CM.deltaEBand(dE); }

  // ---- 以上為家族共用的那把尺；以下是本 app 自己的東西 --------------------

  function rgbToHex(c) {
    function h(v) { var s = Math.round(clamp(v, 0, 255)).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }
  function formatRgb(c) {
    return 'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')';
  }

  // sRGB 位元組 ↔ 線性光（0..1）。rgbToLab 內也有一份同樣的 lin()，那份是逐字複製
  // 家族共用的尺、不可動；這兩支是本 app 混色用的，故另立。
  function toLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function toSrgb(v) {
    v = clamp01(v);
    return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  }

  // ---- 模型一：sRGB 直接插值（＝瀏覽器 rgba() / globalAlpha） -------------

  function overSrgb(d, s, a) {
    return { r: s.r * a + d.r * (1 - a), g: s.g * a + d.g * (1 - a), b: s.b * a + d.b * (1 - a) };
  }

  // ---- 模型二：OKLab 插值（Björn Ottosson 2020） -------------------------

  function linToOklab(R, G, B) {
    var l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
    var m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
    var s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
    var l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_];
  }
  function oklabToLin(L, A, B) {
    var l_ = L + 0.3963377774 * A + 0.2158037573 * B;
    var m_ = L - 0.1055613458 * A - 0.0638541728 * B;
    var s_ = L - 0.0894841775 * A - 1.2914855480 * B;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [ 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function overOklab(d, s, a) {
    var A = linToOklab(toLinear(d.r), toLinear(d.g), toLinear(d.b));
    var B = linToOklab(toLinear(s.r), toLinear(s.g), toLinear(s.b));
    var m = oklabToLin(A[0] + (B[0] - A[0]) * a, A[1] + (B[1] - A[1]) * a, A[2] + (B[2] - A[2]) * a);
    return { r: toSrgb(m[0]), g: toSrgb(m[1]), b: toSrgb(m[2]) };
  }

  // ---- 兩個減色模型共用的下限 ---------------------------------------------

  /**
   * ⚠️ **R 的下限是有實質後果的、不是防呆**：反射率 R→0 時，K/S→∞、
   * log R→−∞，任何一個純黑通道都會把整個結果拉死。夾在 0.004 相當於
   * 「最深的顏料仍反射 0.4% 的光」——真實顏料本來就不會全吸收，
   * 但這個值是**我們挑的，不是量出來的**。改它會改變所有深色的混合結果。
   * 兩個減色模型共用同一個值，比較才是在同一個前提下。
   */
  var R_MIN = 0.004;

  // ---- 模型三：罩染 / 密度空間（Beer-Lambert；本 app 預設） ----------------

  /**
   * R_result = R_下^(1−a) · R_墨^a，等價於在光學密度 −log(R) 上線性插值。
   *
   * 這是透明墨層蓋在基材上的標準模型：光穿過墨層 → 打到紙 → 再穿出來，
   * 每穿一次乘一次透射率，所以是**相乘**而不是相加。因此紙色會透出來，
   * 而且影響隨墨層加厚而遞減——這正是實際觀察到的行為（見檔頭實測表）。
   *
   * R 同樣要夾下限：R=0 在對數空間是 −∞。用與 km 相同的 R_MIN，
   * 兩個減色模型才是同一個前提下的比較。
   */
  function overGlaze(d, s, a) {
    var out = {};
    ['r', 'g', 'b'].forEach(function (k) {
      var Rd = Math.max(toLinear(d[k]), R_MIN);
      var Rs = Math.max(toLinear(s[k]), R_MIN);
      out[k] = toSrgb(Math.pow(Rd, 1 - a) * Math.pow(Rs, a));
    });
    return out;
  }

  // ---- 模型四：單常數 Kubelka-Munk（調色盤混合，減色近似） ----------------

  /**
   * K/S = (1−R)² / 2R，其中 R 是反射率。混合時各成分的 K/S 依濃度加權相加，
   * 再解回 R = 1 + K/S − √((K/S)² + 2·K/S)。
   *
   * ⚠️ 此模型下**底色是被當成「另一坨顏料」一起混的**，不是被透光看見的基材
   *    ——所以紙色不會透出來（檔頭實測表）。這是模型的定義如此，不是實作走味。
   */
  function ks(R) { R = clamp(R, R_MIN, 1); return (1 - R) * (1 - R) / (2 * R); }
  function unks(x) { x = Math.max(x, 0); return 1 + x - Math.sqrt(x * x + 2 * x); }

  function overKm(d, s, a) {
    var out = {};
    ['r', 'g', 'b'].forEach(function (k) {
      var mixed = ks(toLinear(d[k])) * (1 - a) + ks(toLinear(s[k])) * a;
      out[k] = toSrgb(unks(mixed));
    });
    return out;
  }

  // ---- 合成 -------------------------------------------------------------

  function over(dst, src, alpha, model) {
    var a = clamp01(alpha);
    if (model === 'srgb') return overSrgb(dst, src, a);
    if (model === 'oklab') return overOklab(dst, src, a);
    if (model === 'km') return overKm(dst, src, a);
    return overGlaze(dst, src, a);
  }

  /**
   * 逐層合成。**不改輸入**：每一層都由上一層的浮點結果算出，只在輸出時取整
   * ——逐層取整會累積捨入誤差，八層下來肉眼看得出來。
   * `steps[i]` ＝ 疊完第 i 層之後的顏色（steps[0] 是底色），供 UI 逐層預覽。
   */
  function compose(stack, model) {
    var st = normalizeStack(stack);
    var m = MODELS.indexOf(model) >= 0 ? model : DEFAULT_MODEL;
    var cur = hexToRgb(st.base);
    cur = { r: cur.r, g: cur.g, b: cur.b };
    var steps = [rgbToHex(cur)];
    st.layers.forEach(function (ly) {
      cur = over(cur, hexToRgb(ly.hex), ly.alpha, m);
      steps.push(rgbToHex(cur));
    });
    return {
      hex: rgbToHex(cur),
      r: Math.round(clamp(cur.r, 0, 255)),
      g: Math.round(clamp(cur.g, 0, 255)),
      b: Math.round(clamp(cur.b, 0, 255)),
      steps: steps
    };
  }

  /** 補預設、夾範圍、丟掉壞層。**回新物件，不改輸入。** */
  function normalizeStack(raw) {
    var r = raw || {};
    var base = isHex(r.base) ? ('#' + String(r.base).replace('#', '').toLowerCase()) : '#ffffff';
    if (base.length === 4) base = hexNorm(base);
    var layers = (Array.isArray(r.layers) ? r.layers : [])
      .filter(function (l) { return l && isHex(l.hex); })
      .slice(0, MAX_LAYERS)
      .map(function (l) {
        return {
          hex: hexNorm(l.hex),
          alpha: clamp01(typeof l.alpha === 'number' ? l.alpha : 1),
          src: (l.src && l.src.brand && l.src.code)
            ? { brand: String(l.src.brand), code: String(l.src.code) } : null
        };
      });
    return { base: base, layers: layers };
  }
  function hexNorm(hex) {
    var h = String(hex || '').replace('#', '').toLowerCase();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return '#' + h;
  }

  // ---- 網址狀態（參數全寫在網址列＝複製連結就是存檔，同 circle-text） ------

  /**
   * 格式：`m=<model>&b=<hex6>&s=<substrate>&l=<layer>_<layer>…`
   *   layer ＝ `<hex6>.<alpha 0-100>` 或 `<hex6>.<alpha>.<brand>~<code>`
   * 刻意不用 JSON＋base64：網址要看得懂、手改得動、diff 得出來。
   */
  function encodeState(state) {
    var s = state || {};
    var st = normalizeStack(s.stack);
    var parts = [];
    parts.push('m=' + (MODELS.indexOf(s.model) >= 0 ? s.model : DEFAULT_MODEL));
    parts.push('b=' + st.base.slice(1));
    // 目視色：**使用者看到的**顏色，不是算出來的。它與 stack 無關（不參與合成），
    // 所以是 state 的同層欄位而不是 stack 的一部分——把觀測值混進配方裡，
    // 日後就分不出「這個 hex 是算的還是看的」。
    if (isHex(s.observed)) parts.push('o=' + hexNorm(s.observed).slice(1));
    if (s.substrate) parts.push('s=' + encodeURIComponent(s.substrate));
    if (st.layers.length) {
      parts.push('l=' + st.layers.map(function (l) {
        var t = l.hex.slice(1) + '.' + Math.round(l.alpha * 100);
        if (l.src) t += '.' + l.src.brand + '~' + l.src.code;
        return encodeURIComponent(t);
      }).join('_'));
    }
    return parts.join('&');
  }

  /** 壞字串一律回 null（不丟例外、不猜）——呼叫端據此退回預設值並說明。 */
  function decodeState(qs) {
    var s = String(qs == null ? '' : qs).replace(/^[?#]/, '');
    if (!s) return null;
    var q = {};
    s.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i < 0 ? kv : kv.slice(0, i);
      var v = i < 0 ? '' : kv.slice(i + 1);
      try { q[k] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { q[k] = v; }
    });
    if (!isHex(q.b)) return null;
    var layers = [];
    if (q.l) {
      q.l.split('_').forEach(function (t) {
        var p = t.split('.');
        if (!isHex(p[0])) return;
        var a = parseInt(p[1], 10);
        var src = null;
        if (p[2] && p[2].indexOf('~') > 0) {
          var sp = p[2].split('~');
          src = { brand: sp[0], code: sp.slice(1).join('~') };
        }
        layers.push({ hex: hexNorm(p[0]), alpha: clamp01(isNaN(a) ? 1 : a / 100), src: src });
      });
    }
    return {
      model: MODELS.indexOf(q.m) >= 0 ? q.m : DEFAULT_MODEL,
      substrate: q.s || null,
      observed: isHex(q.o) ? hexNorm(q.o) : null,
      stack: normalizeStack({ base: q.b, layers: layers })
    };
  }

  // ---- 跨品牌最接近色：只合併，不重寫各品牌的規矩（見檔頭） ---------------

  /**
   * lists = [{ brand:'copic', items:[{code,name,hex,deltaE,band,…}] }, …]
   * 各 items 由該品牌自己的 nearestXxx 產生（規矩、排除項、預設範圍都在那邊）。
   * 這裡只做三件事：貼上 brand 標籤、依 ΔE 升冪合併、取前 n。**不改輸入。**
   */
  function mergeNearest(lists, n) {
    var out = [];
    (lists || []).forEach(function (L) {
      if (!L || !L.items) return;
      L.items.forEach(function (it) {
        var o = { brand: L.brand };
        for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) o[k] = it[k];
        out.push(o);
      });
    });
    out.sort(function (a, b) { return a.deltaE - b.deltaE; });
    return out.slice(0, n || 12);
  }

  // ---- 校準（資料由 db_artcolor 匯出；本 app 唯讀） -----------------------

  function substrateOf(code, substrates) {
    var list = substrates || global.CM_SUBSTRATES || [];
    for (var i = 0; i < list.length; i++) if (list[i].code === code) return list[i];
    return null;
  }

  /**
   * 某支筆在某個基材上有沒有校準紀錄。
   *
   * ⚠️ **這支存在的理由是「旗標活不過別人的函式」**：`calibratedColors()` 會在
   *    換過 hex 的色物件上掛 `calibrated: true`，但五個品牌的 `nearestXxx`
   *    是**投影**成自己那組固定欄位再回傳的（`{code,name,hex,cssVar,deltaE,band}`），
   *    自訂欄位一律被丟掉——結果是色票用了校準值、徽章卻不會亮，而且不會報錯。
   *    呼叫端要標記時**問這支**，不要依賴那個旗標穿過別人的程式碼。
   */
  function hasCalibration(brand, code, substrateCode, calib) {
    if (!substrateCode) return false;
    return (calib || global.CM_CALIBRATION || []).some(function (o) {
      return o.brand === brand && String(o.code) === String(code) && o.substrate === substrateCode;
    });
  }

  /** 某支筆的所有校準紀錄（不分基材）；依基材、層數排。**回新陣列。** */
  function calibrationFor(brand, code, calib) {
    return (calib || global.CM_CALIBRATION || [])
      .filter(function (o) { return o.brand === brand && o.code === code; })
      .slice()
      .sort(function (a, b) {
        return a.substrate < b.substrate ? -1 : a.substrate > b.substrate ? 1
             : (a.layers || 1) - (b.layers || 1);
      });
  }

  /**
   * 把某品牌色清單裡「在這個基材上有校準紀錄」的色，hex 換成校準值。
   * **不改輸入**：有紀錄的產生新物件，其餘原樣沿用（同一個參考，省記憶體也免誤改）。
   * 多筆同 (brand, code, substrate) 時取層數最小的那筆——一層是最常見的下筆方式。
   */
  function calibratedColors(colors, brand, substrateCode, calib) {
    var src = calib || global.CM_CALIBRATION || [];
    if (!substrateCode) return (colors || []).slice();
    var map = {};
    src.forEach(function (o) {
      if (o.brand !== brand || o.substrate !== substrateCode || !isHex(o.hex)) return;
      var prev = map[o.code];
      if (!prev || (o.layers || 1) < (prev.layers || 1)) map[o.code] = o;
    });
    return (colors || []).map(function (c) {
      var o = map[c.code];
      if (!o) return c;
      var rgb = hexToRgb(o.hex);
      var n = {};
      for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) n[k] = c[k];
      n.hex = hexNorm(o.hex); n.r = rgb.r; n.g = rgb.g; n.b = rgb.b;
      n.calibrated = true;                    // 呼叫端據此在結果上標記，別讓校準值假裝是型錄值
      n.catalogHex = c.hex;
      return n;
    });
  }

  // ---- CSS 輸出 ---------------------------------------------------------

  var MODEL_NOTE = {
    srgb:  'sRGB alpha compositing (what the browser does; not how paint behaves)',
    oklab: 'OKLab interpolation (perceptually even; still additive, not subtractive)',
    glaze: 'Beer-Lambert glaze in density space — APPROXIMATE (substrate shows through)',
    km:    'single-constant Kubelka-Munk palette mix — APPROXIMATE (substrate does NOT show through)'
  };

  /**
   * 輸出這次調色的 CSS。**把配方也寫進註解**——只給一個 hex，日後沒有人知道
   * 它是怎麼來的；配方在註解裡，這段 CSS 就能回頭貼進網址列重現。
   */
  function buildCss(stack, model, result) {
    var st = normalizeStack(stack);
    var m = MODELS.indexOf(model) >= 0 ? model : DEFAULT_MODEL;
    var res = result || compose(st, m);
    var L = [];
    L.push('/* color-mixer — ' + m + ' */');
    L.push('/* model: ' + MODEL_NOTE[m] + ' */');
    L.push('/* base:  ' + st.base + ' */');
    st.layers.forEach(function (ly, i) {
      L.push('/* layer' + (i + 1) + ': ' + ly.hex + ' @ ' + Math.round(ly.alpha * 100) + '%'
        + (ly.src ? '  (' + ly.src.brand + ' ' + ly.src.code + ')' : '') + ' */');
    });
    L.push('/* recipe: ?' + encodeState({ stack: st, model: m }) + ' */');
    L.push(':root {');
    L.push('  --mix-base: ' + st.base + ';');
    st.layers.forEach(function (ly, i) { L.push('  --mix-layer-' + (i + 1) + ': ' + ly.hex + ';'); });
    L.push('  --mix-result: ' + res.hex + ';');
    L.push('}');
    L.push('.mix-result { background: var(--mix-result); color: ' + pickTextColor(res) + '; }');
    return L.join('\n') + '\n';
  }

  function cssFilename() { return 'color-mixer.css'; }

  // ---- 匯出 -------------------------------------------------------------

  global.ColorMixerLib = {
    FOLDER: FOLDER, MODELS: MODELS, DEFAULT_MODEL: DEFAULT_MODEL, MAX_LAYERS: MAX_LAYERS,
    ADDITIVE: ADDITIVE, SUBTRACTIVE: SUBTRACTIVE, MODEL_NOTE: MODEL_NOTE, R_MIN: R_MIN,
    compose: compose, over: over, normalizeStack: normalizeStack,
    encodeState: encodeState, decodeState: decodeState,
    mergeNearest: mergeNearest,
    substrateOf: substrateOf, calibrationFor: calibrationFor, calibratedColors: calibratedColors,
    hasCalibration: hasCalibration,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgbToHsl: rgbToHsl, rgbToLab: rgbToLab,
    deltaE: deltaE, deltaEBand: deltaEBand,
    relLuminance: relLuminance, contrastRatio: contrastRatio, pickTextColor: pickTextColor,
    formatRgb: formatRgb, isHex: isHex,
    buildCss: buildCss, cssFilename: cssFilename
  };

})(typeof window !== 'undefined' ? window : globalThis);
