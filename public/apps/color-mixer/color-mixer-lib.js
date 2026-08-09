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
 *   solve({base, palette, target, model, maxLayers})          **反解／拆色**
 *       → { layers, hex, dE, band, reachable, exact, … } | null
 *       給目標色，回「用這組顏料怎麼疊最接近」。四個模型的疊層都是「某空間裡的
 *       凸組合」，故這是凸問題——有唯一最佳解，而且**到不了時能證明到不了**。
 *       ⚠️ `reachable` 為 false 時 `dE` 就是**做不到的下限**，不是暫時沒調好。
 *   PALETTES（rgb／cmy／cmyk）· PALETTE_IDS · EXACT_CONVEX
 *   paintTable(stack, model, n) → [hex…]                     **筆刷的顏色表**
 *       t[n] ＝ 同一處塗了 n 筆之後的顏色（t[0] 是紙色、**t[1] 恆等於圓圈的結果色**）。
 *       控制器只數「塗過幾次」再查表——**合成邏輯不可以長在繪圖迴圈裡**（DESIGN §4.1／§6）。
 *   normalizeStack(raw) → Stack                               補預設值、夾範圍（不改輸入）
 *   encodeState(state) → 'm=…&b=…&o=…&a=…&t=…&p=…&l=…'        網址列＝存檔（無前導 ?）
 *       state = { model, substrate, observed, anchor, solveTarget, solvePalette,
 *                 solveCustom, stack }。
 *       `observed` 是**目視色**——使用者看到的顏色，不參與合成，故是 state 的同層欄位
 *       而不是 stack 的一部分。`solve*` 三個是反解的參數，同理不進 stack。
 *   decodeState(qs) → state | null                            壞字串回 null，不丟例外
 *   mergeNearest(lists, n) → [{ brand, code, name, hex, deltaE, band, … }]
 *   substrateOf(code, substrates) → Substrate | null
 *   hasCalibration(brand, code, substrate, calib) → boolean   要標記徽章時問這支，見其註解
 *   calibrationFor(brand, code, calib) → Obs[]                某支筆的所有校準紀錄
 *   calibrationSummary(brand, code, substrate, calib)         **多列觀測的聚合**
 *       → { n, hex, obs, contexts, repeatability, frameGap } | null
 *       ⚠️ 一組 (筆,基材,層數) 可以有多列（目視值取決於光線／螢幕／觀察者，
 *          「有唯一真值」不成立）。`repeatability`（同框架）與 `frameGap`（跨框架）
 *          是**兩件不同的事**，不可混談——只有前者是「觀察者自己的精度」。
 *   nudge(anchorHex, {dL,dC,dh}) → hex                        從錨點用「深/鮮/色相」調色
 *   describeNudge(anchorHex, hex) → { dL, dC, dh, hueDefined }
 *       ⚠️ 呼叫端要顯示**這支算出來的值**，不是滑桿的值——色域到頂時兩者不同。
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

  /**
   * ---- 四個模型的單一定義：每個模型 ＝ 一組「進出某個空間」的座標轉換 ----
   *
   * 四個模型的差別**只在於「在哪個空間裡做線性插值」**：
   *
   *   | 模型  | 空間            | 疊一層 = 在該空間裡走 alpha 的比例 |
   *   |-------|-----------------|------------------------------------|
   *   | srgb  | sRGB 位元組     | ＝瀏覽器的 rgba() / globalAlpha    |
   *   | oklab | OKLab           | 感知均勻的漸層                     |
   *   | glaze | log 反射率      | Beer-Lambert 光學密度              |
   *   | km    | K/S             | 單常數 Kubelka-Munk                |
   *
   * 所以 `over()` 只寫一次、由 `fwd/inv` 導出，**模型本身沒有第二份實作**（v1.16）。
   * 反解 `solve()` 吃的也是同一張表——否則求解器會是模型的第二份實作，
   * 而那正是「畫面說一套、拆色說另一套」的來源。
   *
   * ⚠️ 這是 2026-08-08 由四支獨立的 `overXxx()` 收斂而來。**收斂前先量過**：
   *    `pow(Rd,1−a)·pow(Rs,a)` 與 `exp((1−a)·logRd + a·logRs)` 數學上相同、
   *    浮點上不同。800,000 組單層合成實測——**取整後的 hex 零組不同**，
   *    未取整最大差 4e-11（要翻轉一個位階需要 0.5）。
   */
  var SPACE = {};

  // ---- 模型一：sRGB 直接插值（＝瀏覽器 rgba() / globalAlpha） -------------

  SPACE.srgb = {
    fwd: function (c) { return [c.r, c.g, c.b]; },
    inv: function (v) { return { r: v[0], g: v[1], b: v[2] }; }
  };

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
  SPACE.oklab = {
    fwd: function (c) { return linToOklab(toLinear(c.r), toLinear(c.g), toLinear(c.b)); },
    inv: function (v) {
      var m = oklabToLin(v[0], v[1], v[2]);
      return { r: toSrgb(m[0]), g: toSrgb(m[1]), b: toSrgb(m[2]) };
    }
  };

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
  SPACE.glaze = {
    fwd: function (c) {
      return ['r', 'g', 'b'].map(function (k) { return Math.log(Math.max(toLinear(c[k]), R_MIN)); });
    },
    inv: function (v) {
      return { r: toSrgb(Math.exp(v[0])), g: toSrgb(Math.exp(v[1])), b: toSrgb(Math.exp(v[2])) };
    }
  };

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

  SPACE.km = {
    fwd: function (c) {
      return ['r', 'g', 'b'].map(function (k) { return ks(toLinear(c[k])); });
    },
    inv: function (v) {
      return { r: toSrgb(unks(v[0])), g: toSrgb(unks(v[1])), b: toSrgb(unks(v[2])) };
    }
  };

  // ---- 合成 -------------------------------------------------------------

  function spaceOf(model) { return SPACE[model] || SPACE[DEFAULT_MODEL]; }

  function over(dst, src, alpha, model) {
    var a = clamp01(alpha), S = spaceOf(model);
    var d = S.fwd(dst), s = S.fwd(src);
    return S.inv([d[0] + (s[0] - d[0]) * a,
                  d[1] + (s[1] - d[1]) * a,
                  d[2] + (s[2] - d[2]) * a]);
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

  // ---- 筆刷：把「塗了幾次」對應到顏色 --------------------------------------

  /**
   * 筆刷的顏色表：`t[n]` ＝ 在同一處**塗了 n 筆**之後的顏色（`t[0]` 是基材紙色）。
   *
   * 一筆 ＝ 把整個顏料堆疊，往「當下已經在那裡的那個顏色」上再蓋一次：
   *     t[0] = base
   *     t[n] = compose({ base: t[n−1], layers }, model)
   *
   * ⚠️ **這支存在的理由是「合成邏輯不可以長在繪圖迴圈裡」**（DESIGN §4.1／§6）。
   *    控制器只維護一個「這個像素被塗過幾次」的整數緩衝區，畫的時候**查表**；
   *    合成永遠只發生在這裡、用的是同一個 `compose`。於是：
   *      · 換模型／換基材／改顏料層 → 重算這張表 → 同一批筆觸立刻改頭換面，
   *        **模型差異在重疊處直接看得見**（實測塗兩筆：srgb #4877b5 vs km #2963ad）。
   *      · **`t[1]` 恆等於圓圈的結果色**（四個模型實測相符，verify.js I1 擋著）——
   *        「一筆 ＝ 圓圈那個顏色」是使用者唯一需要記住的心智模型。
   *
   * ⚠️ **不要改用 canvas 的 `globalAlpha` 疊**：那是瀏覽器的 alpha 合成，
   *    等於**永遠只有 `srgb` 一個模型**，而畫面上還寫著現在選的是「罩染」。
   *    它不會報錯，只會安靜地讓四個模型看起來一模一樣。
   *
   * n 預設 12：實測 5–6 筆後逐筆 ΔE00 < 0.5、已趨近顏料本身（km 更快，3 筆）。
   * **純函式，不改輸入。** 壞輸入回 null。
   */
  function paintTable(stack, model, n) {
    var st = normalizeStack(stack);
    var m = MODELS.indexOf(model) >= 0 ? model : DEFAULT_MODEL;
    var max = Math.max(1, Math.min(typeof n === 'number' ? n : 12, 64));
    var out = [st.base];
    for (var i = 1; i <= max; i++) {
      out.push(compose({ base: out[i - 1], layers: st.layers }, m).hex);
    }
    return out;
  }

  // ---- 目視微調：用「深一點／鮮一點」的語言描述一個顏色 --------------------

  /**
   * Lab → sRGB。共用件 `color-metric.js` 只有正向的 `rgbToLab`，這裡是它的反向。
   *
   * ⚠️ **用的必須是 `rgbToLab` 那個四位數矩陣的精確反矩陣**，不是別處抄來的
   *    「標準 sRGB 反矩陣」——後者對應的是未捨入的原始矩陣，來回會有肉眼看不見
   *    但足以讓 hex 差一階的殘差，而那會讓「微調 0 就該回到原色」這件事不成立。
   * ⚠️ **刻意留在本 app、不放進共用件**：目前只有這裡需要它。共用件多一個函式
   *    就是多 17 份複製要同步（SHARED_LIBRARY_GUIDELINES §4）——**第二個消費端
   *    出現時再抽**，那是家族一路記著的順序。
   */
  function labToRgb(L, A, B) {
    var fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
    function finv(t) { var c = t * t * t; return c > 0.008856 ? c : (t - 16 / 116) / 7.787; }
    var X = finv(fx) * 0.95047, Y = finv(fy), Z = finv(fz) * 1.08883;
    var r = 3.2406254773 * X - 1.5372079722 * Y - 0.4986285987 * Z;
    var g = -0.9689307147 * X + 1.8757560609 * Y + 0.0415175238 * Z;
    var b = 0.0557101204 * X - 0.2040210506 * Y + 1.0569959423 * Z;
    function enc(v) {
      v = clamp01(v);
      return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
    }
    return { r: enc(r), g: enc(g), b: enc(b) };
  }

  /**
   * 從一個**錨點**出發，用三個方向調出一個顏色。
   *
   * 這是照著人講顏色的方式做的：使用者的原話是「接近 `#08093D` **但較深**」、
   * 「接近 `#08093D` **但較亮些**」——那不是一個 hex，是**一個錨點加一個方向**。
   * 所以三根滑桿就是 Lab 的 LCh 三軸：明度 L\*、彩度 C\*、色相 h°，
   * 分別對應「深／淺」「鮮／濁」「偏哪個色」。
   *
   * ⚠️ 它改善的是**輸入方式**（把「說出這是什麼顏色」換成「調到看起來像」），
   *    **不是消除光線與螢幕的誤差**——那是拿螢幕比紙，跨介質，抵消不了。
   *    只有「螢幕比螢幕」的兩塊色才會抵消。
   *
   * d = { dL, dC, dh }（缺的當 0）。**純函式。** 壞錨點回 null。
   */
  function nudge(anchorHex, d) {
    if (!isHex(anchorHex)) return null;
    var c = hexToRgb(hexNorm(anchorHex));
    var lab = rgbToLab(c.r, c.g, c.b);
    var C = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
    var h = Math.atan2(lab[2], lab[1]);
    var o = d || {};
    var L2 = clamp(lab[0] + (o.dL || 0), 0, 100);
    var C2 = Math.max(0, C + (o.dC || 0));
    var h2 = h + (o.dh || 0) * Math.PI / 180;
    return rgbToHex(labToRgb(L2, C2 * Math.cos(h2), C2 * Math.sin(h2)));
  }

  /**
   * `nudge` 的反向：這個顏色相對錨點，是深了幾分、鮮了幾分、偏了幾度。
   *
   * ⚠️ **呼叫端要顯示的是這支算出來的值，不是滑桿的值。** 兩者常常不一樣，原因有二，
   *    而**兩個都該讓使用者看見**（同 circle-text 恆顯示「實際每字弧長」那條）：
   *      ① **色域到頂**：`#08093d` 要求 L−6 只給得出 −3.2，因為它已經貼著 sRGB 邊界。
   *      ② **中性色的色相無定義**：C≈0 時 h 是 atan2(0,0) 的產物，
   *         灰色轉一下色相會回報 `dh = −63.2` 這種垃圾值。
   *    ② 已在這裡擋掉（回 `hueDefined:false`、`dh:0`）；① 交給呼叫端比對後標示。
   */
  var NEUTRAL_C = 1.0;               // Lab 彩度低於此就當中性色，色相無意義

  function describeNudge(anchorHex, hex) {
    if (!isHex(anchorHex) || !isHex(hex)) return null;
    function lch(x) {
      var c = hexToRgb(hexNorm(x)), l = rgbToLab(c.r, c.g, c.b);
      var h = Math.atan2(l[2], l[1]) * 180 / Math.PI;
      return { L: l[0], C: Math.sqrt(l[1] * l[1] + l[2] * l[2]), h: h < 0 ? h + 360 : h };
    }
    var a = lch(anchorHex), b = lch(hex);
    var hueDefined = a.C >= NEUTRAL_C && b.C >= NEUTRAL_C;
    var dh = 0;
    if (hueDefined) {
      dh = b.h - a.h;
      while (dh > 180) dh -= 360;
      while (dh < -180) dh += 360;    // 色相是環狀的：359° → 1° 是 +2 不是 −358
    }
    return { dL: b.L - a.L, dC: b.C - a.C, dh: dh, hueDefined: hueDefined };
  }

  // ---- 反解（拆色）：給目標色，回「怎麼疊才最接近」-------------------------

  /**
   * 內建調色盤。**預設是 `rgb`**——不是因為減色情境下三原色顏料物理上正確
   * （疊起來只會發濁），而是因為它是**三根滑桿、心裡有數**；而且實測在預設模型
   * 下它剛好也最準（DESIGN §3.6 的實測表）。`cmy` 留著是為了讓「少一個 K」
   * 這件事**看得見**，不是為了推薦它。
   */
  var PALETTES = {
    rgb: ['#ff0000', '#00ff00', '#0000ff'],
    cmy: ['#00ffff', '#ff00ff', '#ffff00'],
    cmyk: ['#00ffff', '#ff00ff', '#ffff00', '#000000']
  };
  /**
   * `layers` ＝ **畫布上現有的顏料層**當基底。它回答的是最實用的那個問題——
   * 「我手上就這幾支筆，濃度該調多少」——而且是**校準值唯一真正進得到反解的路徑**：
   * 層帶著 `src`（brand＋code），控制器據此把型錄色換成該基材上的實測色。
   * ⚠️ 它的內容由控制器決定（lib 不碰 DOM 也不知道畫布狀態），故只出現在
   *    PALETTE_IDS，**不在 PALETTES**。
   */
  var PALETTE_IDS = ['rgb', 'cmy', 'cmyk', 'layers', 'custom'];

  /**
   * 「疊層＝凸組合」**精確成立**的模型。這是**量出來的、不是推導出來的**：
   * 各 4,000 組隨機堆疊比對 compose 與凸組合，這三個最大 ΔE00 = 0.0000，
   * 而 `oklab` 是 1.46（反向 3.06）——因為它的逐層結果會被夾回 sRGB 色域。
   * ⚠️ 日後新增模型時，**要先量再決定它進不進這張表**，不要照著「看起來像線性插值」放進來。
   */
  var EXACT_CONVEX = ['srgb', 'glaze', 'km'];

  /**
   * 凸權重 → 逐層 alpha。
   *
   * 疊 n 層之後在該模型的空間裡 V = Σ w·V_i，其中
   *   w_base = Π(1−a_i)、w_i = a_i·Π_{j>i}(1−a_j)，且 Σw = 1（見 solve 的註解）。
   * 反過來：第 i 層**之前還剩下的空間** ＝ w_base + Σ_{k≤i} w_k，故 a_i = w_i / 它。
   * 因為分母恆 ≥ 分子，結果天生落在 [0,1]，不必夾。
   */
  function weightsToAlphas(wBase, ws) {
    var out = [], rem = wBase;
    for (var i = 0; i < ws.length; i++) {
      rem += ws[i];
      out.push(rem > 1e-12 ? ws[i] / rem : 0);
    }
    return out;
  }

  /** 小型高斯消去（最多 3×3）。奇異回 null。 */
  function solveLinear(A, b) {
    var n = b.length, i, j, k, p, f;
    var M = A.map(function (row, r) { return row.concat([b[r]]); });
    for (k = 0; k < n; k++) {
      p = k;
      for (i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      if (Math.abs(M[p][k]) < 1e-14) return null;
      var t = M[k]; M[k] = M[p]; M[p] = t;
      for (i = 0; i < n; i++) {
        if (i === k) continue;
        f = M[i][k] / M[k][k];
        for (j = k; j <= n; j++) M[i][j] -= f * M[k][j];
      }
    }
    // 消去完成後 M 是對角的，第 r 列的對角元就是 `M[r][r]`；
    // ⚠️ 在下面的 callback 裡 `row` **已經是** `M[r]`，所以對角元是 `row[r]`——
    //    寫成 `row[r][r]` 等於 `M[r][r][r]`，在一個數字上取索引得 undefined → 整條 NaN。
    //    而 NaN 通不過 `> -1e-9`、也通不過 `dist < best.dist`，於是求解器**只會回單一頂點**：
    //    一個看起來很合理的顏色，所以錯誤答案長得像「這個調色盤就是拼不出來」，不像 bug。
    //    （寫這支時就是這樣錯的，靠往返測試抓到。）
    return M.map(function (row, r) { return row[n] / row[r]; });
  }

  /**
   * 目標點到「頂點凸包」的最近點。頂點數少（≤ MAX_LAYERS+1），
   * 故直接列舉所有子面（Carathéodory：三維只需 ≤4 個頂點），各解無約束最小平方、
   * 取重心座標全非負者。回 { dist, w:[…] }。
   */
  function closestInHull(target, verts) {
    var n = verts.length, best = null, mask, i, d;
    for (mask = 1; mask < (1 << n); mask++) {
      var idx = [];
      for (i = 0; i < n; i++) if (mask & (1 << i)) idx.push(i);
      if (idx.length > 4) continue;
      var P = idx.map(function (ix) { return verts[ix]; }), k = P.length, lam;
      if (k === 1) {
        lam = [1];
      } else {
        var o = P[k - 1], m = k - 1, A = [], rhs = [];
        for (d = 0; d < 3; d++) {
          A.push(P.slice(0, m).map(function (q) { return q[d] - o[d]; }));
          rhs.push(target[d] - o[d]);
        }
        var N = [], r = [];
        for (i = 0; i < m; i++) {
          N.push([]);
          for (var j = 0; j < m; j++) {
            var s = 0;
            for (d = 0; d < 3; d++) s += A[d][i] * A[d][j];
            N[i].push(s + (i === j ? 1e-12 : 0));
          }
          var t2 = 0;
          for (d = 0; d < 3; d++) t2 += A[d][i] * rhs[d];
          r.push(t2);
        }
        var x = solveLinear(N, r);
        if (!x) continue;
        var sum = 0;
        for (i = 0; i < x.length; i++) sum += x[i];
        lam = x.concat([1 - sum]);
      }
      var bad = false;
      for (i = 0; i < lam.length; i++) if (!(lam[i] > -1e-9)) bad = true;  // NaN 也算 bad
      if (bad) continue;
      var p = [0, 1, 2].map(function (dd) {
        var acc = 0;
        for (var q = 0; q < P.length; q++) acc += lam[q] * P[q][dd];
        return acc;
      });
      var dist = Math.sqrt((p[0] - target[0]) * (p[0] - target[0]) +
                           (p[1] - target[1]) * (p[1] - target[1]) +
                           (p[2] - target[2]) * (p[2] - target[2]));
      if (!best || dist < best.dist) {
        var full = [];
        for (i = 0; i < n; i++) full.push(0);
        idx.forEach(function (ix, q) { full[ix] = lam[q]; });
        best = { dist: dist, w: full };
      }
    }
    return best;
  }

  /**
   * 反解：給基材底色、一組可用顏料、一個目標色，回「怎麼疊最接近」。
   *
   * **為什麼解得動**——四個模型的逐層疊加都是「某個空間裡的**凸組合**」：
   *
   *     V_out = w_base·V_base + Σ w_i·V_i
   *     w_base = Π(1−a_i)、w_i = a_i·Π_{j>i}(1−a_j)、Σw = 1、w ≥ 0
   *
   * 所以「這個調色盤調得出哪些顏色」＝ 這些點在該空間裡的**凸包**；反解就是
   * 「求目標到凸包的最近點」——凸問題，有唯一最佳解，**不必試誤，而且能證明到不了**。
   *
   * ⚠️ srgb／glaze／km **精確成立**（各 4,000 組隨機堆疊實測，最大 ΔE00 = 0.0000）；
   *    **`oklab` 不成立**——它的逐層結果會被夾回 sRGB 色域，實測最大偏 1.46
   *    （反向 3.06）。故 `exact` 對 oklab 回 false，`reachable` 也不該全信。
   *
   * ⚠️ **空間裡的最近點不等於 ΔE00 最近**。凸包回答的是「可不可達」（可達＝距離 0，
   *    這一點三個模型是精確的）；不可達時的「最近」必須改用 ΔE00 再微調一次，
   *    否則報出來的殘差不是真正的最小值——而殘差是這個功能唯一的產出。
   *
   * opts = { base, palette:[hex|{hex,src}], target, model, maxLayers }
   * 回 { layers:[{hex,alpha,src}], hex, dE, band, reachable, exact, palette }
   *    ——`layers` 可直接餵給 compose()。無解（調色盤空／目標壞）回 null。
   * **純函式，不改輸入。**
   */
  function solve(opts) {
    var o = opts || {};
    if (!isHex(o.target)) return null;
    var model = MODELS.indexOf(o.model) >= 0 ? o.model : DEFAULT_MODEL;
    var base = isHex(o.base) ? hexNorm(o.base) : '#ffffff';
    var cap = Math.min(typeof o.maxLayers === 'number' ? o.maxLayers : MAX_LAYERS, MAX_LAYERS);
    var seen = {}, pal = [];
    (Array.isArray(o.palette) ? o.palette : []).forEach(function (p) {
      var hex = (p && typeof p === 'object') ? p.hex : p;
      if (!isHex(hex)) return;
      var h = hexNorm(hex);
      if (seen[h] || pal.length >= cap) return;      // 同一個顏色收兩次只會讓解不唯一
      seen[h] = 1;
      pal.push({ hex: h, src: (p && p.src) ? p.src : null });
    });
    if (!pal.length) return null;

    var target = hexNorm(o.target);
    var S = spaceOf(model);
    var verts = [S.fwd(hexToRgb(base))].concat(pal.map(function (p) { return S.fwd(hexToRgb(p.hex)); }));
    var hull = closestInHull(S.fwd(hexToRgb(target)), verts);
    if (!hull) return null;

    // ⚠️ **微調前不剔除權重為 0 的顏料**——剔了就再也加不回來。
    //    凸包給的是「該空間裡的最近點」，而該空間的歐氏距離**不是** ΔE00：km 尤其嚴重
    //    （通道近 0 時 K/S 衝到 124，一個座標軸的尺度是另一個的百倍）。實測有四組
    //    km 的解把某支顏料整個丟掉、殘差 2.4–11.3；整組留著讓微調自己決定要不要用，
    //    同一批就全部收斂到 ΔE00 < 1。空配方留到最後再濾。
    var alphas = weightsToAlphas(hull.w[0], hull.w.slice(1));

    var tLab = rgbToLab(hexToRgb(target).r, hexToRgb(target).g, hexToRgb(target).b);
    var pool = pal;
    function score(a) {
      var c = compose({ base: base, layers: pool.map(function (p, k) { return { hex: p.hex, alpha: a[k] }; }) }, model);
      return deltaE(rgbToLab(c.r, c.g, c.b), tLab);
    }
    /**
     * 由一個起點做模式搜尋，最小化**真正的 ΔE00**（不是空間裡的歐氏距離）。
     *
     * ⚠️ 除了單軸的 ±step，還要試**成對移動**（一支加、另一支減）。只走單軸會卡在
     *    「兩支顏料互相取代」那條對角的谷裡——實測 km 有一組因此停在 ΔE00 2.37，
     *    加了成對移動之後同一組收斂到 <1。這種卡住不會有任何徵兆：它回一個合理的
     *    配方與一個看起來還行的殘差。
     */
    function descend(start) {
      var a = start.slice(), d = score(a), step = 0.25, guard = 0, i2, j2, sgn, trial, d2;
      while (step > 1e-4 && guard++ < 400) {
        var moved = false;
        for (i2 = 0; i2 < a.length; i2++) {
          for (sgn = 0; sgn < 2; sgn++) {
            trial = a.slice();
            trial[i2] = clamp01(trial[i2] + (sgn ? -step : step));
            d2 = score(trial);
            if (d2 < d - 1e-9) { a = trial; d = d2; moved = true; }
          }
        }
        for (i2 = 0; i2 < a.length; i2++) {
          for (j2 = 0; j2 < a.length; j2++) {
            if (i2 === j2) continue;
            trial = a.slice();
            trial[i2] = clamp01(trial[i2] + step);
            trial[j2] = clamp01(trial[j2] - step);
            d2 = score(trial);
            if (d2 < d - 1e-9) { a = trial; d = d2; moved = true; }
          }
        }
        if (!moved) step /= 2;
      }
      return { a: a, d: d };
    }

    // 多起點：凸包解通常最好，但它是在「空間裡最近」的意義下最好的，不是 ΔE00。
    // 另外兩個起點便宜且各自擅長不同情形（全零＝底色本身；全滿＝最上層那支蓋住一切）。
    var starts = [alphas, alphas.map(function () { return 0; }), alphas.map(function () { return 1; })];
    var bestA = null, bestD = Infinity;
    starts.forEach(function (s0) {
      var r0 = descend(s0);
      if (r0.d < bestD) { bestD = r0.d; bestA = r0.a; }
    });

    var layers = pool.map(function (p, k) {
      return { hex: p.hex, alpha: bestA[k], src: p.src };
    }).filter(function (l) { return l.alpha > 1e-4; });
    var got = compose({ base: base, layers: layers }, model);
    var dE = deltaE(rgbToLab(got.r, got.g, got.b), tLab);

    /**
     * 可達性＝**算出來的顏色與目標在 8 位元下同一個 hex**。
     *
     * ⚠️ 這裡刻意**不用**「凸包距離 < 某個容差」。試過，是錯的：目標 hex 本身已被
     *    量化成 8 位元，所以「由這個調色盤合成、再取整成 hex」的顏色**通常不在凸包上**
     *    （差約半個位階）。實測 300 組往返裡有 13–20% 被判成不可達——**假陰性**，
     *    而「到不了」正是這個功能最重的一句話，寧可它嚴格對齊使用者看得到的東西。
     * ⚠️ 也刻意不用「ΔE00 < 某個數」：那個數會是憑感覺挑的，而 ΔE00 在暗部與亮部
     *    對同一個位階差給的值差很多。**同一個 hex** 沒有這兩個問題，而且驗得動。
     */
    var reachable = got.hex === target;
    return {
      layers: layers, hex: got.hex, dE: dE, band: deltaEBand(dE),
      reachable: reachable, exact: EXACT_CONVEX.indexOf(model) >= 0,
      hullDist: hull.dist, target: target, base: base, model: model
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
   * 格式：`m=<model>&b=<hex6>&s=<substrate>&o=<hex6>&a=<hex6>&t=<hex6>&p=<id>&pc=<hex6>_…&l=<layer>_…`
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
    // 目視微調的**錨點**（治理文件的 fd_hex_ref）。它是紀錄的一部分——
    // 「接近 #08093D 但較深」裡的 #08093D 就是它，丟掉就只剩結論、沒有從哪裡來。
    // ⚠️ 三根滑桿的位置**刻意不進網址**：由 describeNudge(錨點, 目視色) 現算，
    //    存兩份就會有「網址說 L−6、實際只到 −3.2」這種對不上的狀態。
    if (isHex(s.anchor)) parts.push('a=' + hexNorm(s.anchor).slice(1));
    // 反解：目標色與基底調色盤。**只在有目標時才寫**，沒拆色的連結不該長出空參數。
    if (isHex(s.solveTarget)) {
      parts.push('t=' + hexNorm(s.solveTarget).slice(1));
      var pid = PALETTE_IDS.indexOf(s.solvePalette) >= 0 ? s.solvePalette : 'rgb';
      parts.push('p=' + pid);
      if (pid === 'custom' && Array.isArray(s.solveCustom) && s.solveCustom.length) {
        parts.push('pc=' + s.solveCustom.filter(isHex)
          .slice(0, MAX_LAYERS).map(function (h) { return hexNorm(h).slice(1); }).join('_'));
      }
    }
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
    var custom = [];
    if (q.pc) {
      q.pc.split('_').forEach(function (h) { if (isHex(h)) custom.push(hexNorm(h)); });
    }
    return {
      model: MODELS.indexOf(q.m) >= 0 ? q.m : DEFAULT_MODEL,
      substrate: q.s || null,
      observed: isHex(q.o) ? hexNorm(q.o) : null,
      anchor: isHex(q.a) ? hexNorm(q.a) : null,
      solveTarget: isHex(q.t) ? hexNorm(q.t) : null,
      solvePalette: PALETTE_IDS.indexOf(q.p) >= 0 ? q.p : 'rgb',
      solveCustom: custom.slice(0, MAX_LAYERS),
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
  /** 一組 hex 的 Lab 平均，回 hex。空陣列回 null。 */
  function meanHex(hexes) {
    var ls = hexes.filter(isHex).map(function (h) {
      var c = hexToRgb(hexNorm(h));
      return rgbToLab(c.r, c.g, c.b);
    });
    if (!ls.length) return null;
    var m = [0, 1, 2].map(function (i) {
      return ls.reduce(function (s, l) { return s + l[i]; }, 0) / ls.length;
    });
    return rgbToHex(labToRgb(m[0], m[1], m[2]));
  }

  /** 一組 hex 相對其平均的平均 ΔE00。少於兩個回 null（一個點沒有離散度）。 */
  function spreadOf(hexes) {
    var hs = hexes.filter(isHex);
    if (hs.length < 2) return null;
    var mid = meanHex(hs), c = hexToRgb(mid), mLab = rgbToLab(c.r, c.g, c.b);
    return hs.reduce(function (s, h) {
      var q = hexToRgb(hexNorm(h));
      return s + deltaE(rgbToLab(q.r, q.g, q.b), mLab);
    }, 0) / hs.length;
  }

  /**
   * 把某支筆在某基材上的**所有**觀測聚合成一個代表值，並把兩種離散度分開報。
   *
   * ⚠️ **一組 (筆, 基材, 層數) 可以有多列，這是設計不是重複資料**
   *    （db_artcolor CHG000050 拿掉了唯一約束）。理由：目視值取決於工作區的光線、
   *    螢幕的色準、以及觀察者的敏銳度——「有唯一真值」這句話不成立。
   *
   * ⚠️ **兩種離散度不可混談，這是整個設計的重點：**
   *    · `repeatability` ＝ **同一個框架內**重複觀測的差距。這是**觀察者自己的精度**，
   *      而且是唯一一個**不需要真值就量得出來**的誤差——它不是對墨水的宣稱。
   *    · `frameGap` ＝ **跨框架**的差距（換了光線／螢幕）。那不是誤差，是另一個問題的答案。
   *    把兩者加在一起平均，會得到一個什麼都不是的數字。
   *
   * ⚠️ **`context` 為空的列自成一組，不與其他空的併**——「框架沒記錄」不等於「同框架」
   *    （同 db_artcolor 對 `fd_context_idx` 的欄位註解）。所以它們不產生重複性。
   *
   * 回 { n, hex, layers, obs, contexts:[{code,n,hex,spread}], repeatability, frameGap }，
   * 沒有紀錄回 null。**純函式。**
   */
  function calibrationSummary(brand, code, substrateCode, calib) {
    var src = calib || global.CM_CALIBRATION || [];
    var rows = src.filter(function (o) {
      return o && o.brand === brand && o.code === code
        && o.substrate === substrateCode && isHex(o.hex);
    });
    if (!rows.length) return null;
    // 只取層數最少的那一批（＝最接近「就這麼畫一次」的那個值）
    var minL = rows.reduce(function (m, o) { return Math.min(m, o.layers || 1); }, Infinity);
    rows = rows.filter(function (o) { return (o.layers || 1) === minL; });

    var byCtx = {}, anon = [];
    rows.forEach(function (o) {
      if (o.context) { (byCtx[o.context] = byCtx[o.context] || []).push(o); } else { anon.push(o); }
    });
    var contexts = Object.keys(byCtx).sort().map(function (k) {
      var hs = byCtx[k].map(function (o) { return o.hex; });
      return { code: k, n: hs.length, hex: meanHex(hs), spread: spreadOf(hs) };
    });
    // 重複性＝各框架內離散度的平均，只計得出來的那些（n≥2）
    var withSpread = contexts.filter(function (c) { return c.spread !== null; });
    var repeatability = withSpread.length
      ? withSpread.reduce(function (s, c) { return s + c.spread; }, 0) / withSpread.length : null;
    // 框架落差＝各框架代表值之間的離散度（至少兩個框架才有）
    var frameGap = contexts.length >= 2
      ? spreadOf(contexts.map(function (c) { return c.hex; })) : null;

    return {
      n: rows.length, layers: minL,
      hex: meanHex(rows.map(function (o) { return o.hex; })),
      obs: rows.slice(), contexts: contexts, anonymous: anon.length,
      repeatability: repeatability, frameGap: frameGap
    };
  }

  function calibratedColors(colors, brand, substrateCode, calib) {
    var src = calib || global.CM_CALIBRATION || [];
    if (!substrateCode) return (colors || []).slice();
    var map = {};
    // ⚠️ 原本這裡是「層數最少者勝」——同層數只有一列，所以無歧義。
    //    CHG000050 拿掉唯一約束之後同層數可以有多列，那條規則會**任意**挑一列
    //    （實際上是輸入順序的第一列），而且不會報錯。改為走 calibrationSummary 聚合。
    (colors || []).forEach(function (c) {
      if (map[c.code]) return;
      var s = calibrationSummary(brand, c.code, substrateCode, src);
      if (s) map[c.code] = { hex: s.hex, n: s.n, layers: s.layers };
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
    PALETTES: PALETTES, PALETTE_IDS: PALETTE_IDS, EXACT_CONVEX: EXACT_CONVEX,
    compose: compose, over: over, solve: solve, normalizeStack: normalizeStack,
    nudge: nudge, describeNudge: describeNudge, labToRgb: labToRgb,
    paintTable: paintTable,
    encodeState: encodeState, decodeState: decodeState,
    mergeNearest: mergeNearest,
    substrateOf: substrateOf, calibrationFor: calibrationFor, calibratedColors: calibratedColors,
    calibrationSummary: calibrationSummary, meanHex: meanHex, spreadOf: spreadOf,
    hasCalibration: hasCalibration,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgbToHsl: rgbToHsl, rgbToLab: rgbToLab,
    deltaE: deltaE, deltaEBand: deltaEBand,
    relLuminance: relLuminance, contrastRatio: contrastRatio, pickTextColor: pickTextColor,
    formatRgb: formatRgb, isHex: isHex,
    buildCss: buildCss, cssFilename: cssFilename
  };

})(typeof window !== 'undefined' ? window : globalThis);
