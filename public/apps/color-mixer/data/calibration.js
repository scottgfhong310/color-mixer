/**
 * calibration.js — 應用校準資料（基材 ＋ 觀測）
 *
 * ⚠️⚠️ **這份是佔位資料（stub），不是實測值。** ⚠️⚠️
 *
 * 正式版由 `db_artcolor` 經 `My Projects/Art Colour/export/a3-export.js --write`
 * 匯出，與五支色彩 registry 的 `data/*.js` 同一條管線（DB 是建置期 SoR、
 * 公開 app 永不連庫）。在治理文件的校準模型定案之前，這份手寫檔讓 app 跑得起來。
 *
 * **為什麼要有 `CM_CALIBRATION_META.stub`**：假資料如果長得跟真資料一樣，
 * 下一個人就會拿佔位數字去做決定。旗標為 true 時控制器會在畫面上掛一條告示，
 * `scripts/verify.js` 的 F3 條擋著它不准被拿掉。**這與家族「留白會被讀成
 * 抽取漏了」是同一條紀律的另一面：假值會被讀成量測值。**
 *
 * ⚠️ **`brand` 用的是 app 的資料夾名（`copic-color`），不是 `db_artcolor` 的
 *    `meta_brand.fd_code`（`copic`）。** 五個品牌兩邊都不一樣：
 *
 *      meta_brand.fd_code   →  app 資料夾名（本檔與 URL 用這個）
 *      faber-castell            faber-castell-color
 *      caran-dache              caran-dache-color
 *      copic                    copic-color
 *      finecolour               finecolour-color
 *      enmy                     enmy-color
 *
 *    理由：本 app 消費的是**五支 app 的資料檔**，不是 DB；`data-brand`、
 *    `pool.<id>` 的 i18n key、比對池統計全都以資料夾名為鍵（家族「命名一致」
 *    canon）。**匯出器要負責這層對照，且要用明列的對照表、不要用字串接尾**
 *    ——目前五支剛好都是 `<fd_code>-color`，但第六個品牌不保證（STAEDTLER 已
 *    滿足進庫條件，屆時的 app 名還沒定）。
 *
 *    ⚠️ 這不是假想的風險：本檔第一版把 `brand` 寫成 `'copic'`，
 *    `calibratedColors()` 於是**一筆都沒換、也沒有報錯**，而畫面上「以校準值比對」
 *    的勾選框照樣勾得起來——**錯的長得跟對的一模一樣**。
 *    `scripts/verify.js` 的 D4 條現在擋著這件事。
 *
 * 資料形狀（正式版沿用，欄位對應治理文件的 `rel_color_substrate` 草案）：
 *   Obs = {
 *     brand:'copic-color', code:'B39',  // 掛在哪支筆之後（鍵＝app 資料夾名，見上）
 *     substrate:'a4-white', layers:1,   // 在哪個基材、幾層／什麼力道
 *     hexRef:'#08093d',                 // 你目視比對時**第一次停下**的錨點
 *     hex:'#06072f',                    // 微調後**你認可**的值
 *     note:'渲開：無',                   // 自由註記（行為事實先不結構化）
 *     sourceType:'measured',            // 第三類來源：不是原廠說的，是我方量的
 *     verify:'stub'                     // 'stub' ＝ 佔位；正式值另議
 *   }
 *
 * 三個 hex 各自回答不同問題（見 DESIGN.md §2）：
 *   tb_color.fd_hex → hex   ＝「螢幕值 vs 實際上色」的差距（跨基材、跨品牌可比）
 *   hexRef → hex            ＝ 你的目視偏差（跨紀錄可看有沒有系統性）
 */
(function (global) {
  'use strict';

  global.CM_CALIBRATION_META = {
    stub: true,
    generatedBy: 'hand-written placeholder',
    note: '佔位資料。hex 由 hexRef 機械套用固定明度位移得到（見各筆 note），並非實測。'
  };

  // 基材。⚠️ baseHex 同為佔位——宣紙的紙漿原色沒有量過，這裡放一個看起來合理的
  // 暖白，只為了讓罩染模型有東西可算。**正式值要量**（或由 owner 指定）。
  global.CM_SUBSTRATES = [
    { code: 'a4-white', kind: 'paper', baseHex: '#ffffff',
      name: '白色 A4 影印紙', nameEn: 'White A4 copy paper', nameJa: '白色A4コピー用紙' },
    { code: 'xuan-natural', kind: 'paper', baseHex: '#f0e6d2',
      name: '紙漿原色宣紙', nameEn: 'Natural-pulp Xuan paper', nameJa: '生成り宣紙' }
  ];

  // 觀測。這兩筆的**情境與 hexRef 來自 owner 的實際描述**（2026-08-07）：
  //   ①「COPIC B39 在白色 A4 紙上，感覺紙上的顏色接近 #08093D 但較深」
  //   ②「COPIC B39 在紙漿原色的宣紙上，感覺接近 #08093D 但較亮些、沒有渲開」
  // ⚠️ 但 `hex` 欄是**我機械算出來的**（把 hexRef 在 OKLab 明度上 ∓8%），
  //    不是 owner 微調後認可的值——那個值只有他能給。這正是 stub 旗標存在的理由。
  global.CM_CALIBRATION = [
    { brand: 'copic-color', code: 'B39', substrate: 'a4-white', layers: 1,
      hexRef: '#08093d', hex: '#06072f', context: 'desk-led',
      note: '較深（hex 為 hexRef 明度 −8% 的佔位值，非實測）',
      sourceType: 'measured', verify: 'stub' },
    // 同一組再記一次（同框架）——**這一列在 2026-08-08 之前存不進 DB**：
    // rel_color_substrate 當時帶著 UNIQUE(色, 基材, 層數)，等於斷言「有唯一真值」。
    // 目視值取決於光線／螢幕／觀察者，那句話不成立，故 CHG000050 拿掉了它。
    // 兩列的差距＝**觀察者自己的重複性**，是唯一一個不需要真值就量得出來的誤差。
    { brand: 'copic-color', code: 'B39', substrate: 'a4-white', layers: 1,
      hexRef: '#08093d', hex: '#080934', context: 'desk-led',
      note: '同框架第二次觀測（佔位值，非實測）',
      sourceType: 'measured', verify: 'stub' },
    // 換一個框架（窗邊日光）——它與上面兩列的差距是**框架落差**，不是重複性。
    // 兩者混在一起平均會得到一個什麼都不是的數字，故 lib 分開報。
    { brand: 'copic-color', code: 'B39', substrate: 'a4-white', layers: 1,
      hexRef: '#08093d', hex: '#0b0a3a', context: 'window-day',
      note: '窗邊日光下再看一次（佔位值，非實測）',
      sourceType: 'measured', verify: 'stub' },
    { brand: 'copic-color', code: 'B39', substrate: 'xuan-natural', layers: 1,
      hexRef: '#08093d', hex: '#0a0c4b', context: 'desk-led',
      note: '較亮些；渲開：無（hex 為 hexRef 明度 +8% 的佔位值，非實測）',
      sourceType: 'measured', verify: 'stub' }
  ];

  /**
   * 觀測框架（db_artcolor 的 `meta_observe_context`，CHG000050）。
   * ⚠️ 三個描述欄是**給人讀的**，不供程式推論——我們沒有分光儀也沒有螢幕特性化，
   *    校正不了它們。程式唯一該問的是「這兩次觀測是不是同一個框架」，那是 identity。
   */
  global.CM_OBSERVE_CONTEXT = [
    { code: 'desk-led', name: '書桌 LED', light: '書桌 LED 白光', display: '主要工作螢幕', observer: '（佔位）' },
    { code: 'window-day', name: '窗邊日光', light: '窗邊日光 陰天', display: '主要工作螢幕', observer: '（佔位）' }
  ];

})(typeof window !== 'undefined' ? window : globalThis);
