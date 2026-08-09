# color-mixer — Session 起手 context

> 版本 v0.3｜最後更新 2026-08-09

Art Color 家族的調色台：基材底色 ＋ 半透明顏料層 → 結果色 → 跨五品牌找最接近的筆，
並顯示該色的**應用校準**紀錄（同一支筆在不同紙上實際是什麼顏色）。

- **怎麼用** → [README.md](README.md)（三語）
- **為什麼長這樣** → [DESIGN.md](DESIGN.md) ← **動手前先讀，尤其 §3（四個混色模型）與 §5（三個坑）**
- **家族共同規範** → <https://github.com/scottgfhong310/nodeapp-webapp-family>
  （`DESIGN_GUIDELINES.md` / `WORKFLOW.md` / `DATABASE_GUIDELINES.md` / `SHARED_LIBRARY_GUIDELINES.md`）

## 執行與驗證

```bash
npm install && npm start          # → http://localhost:3000/apps/color-mixer/
npm run verify                    # 46 條契約檢查（全過 0 / 不符 1 / 旗標打錯 2）
node scripts/verify.js --selftest # 反向驗證：故意改壞，確認每條抓得到
bash scripts/sync-copies.sh       # 回灌 InProgress 鏡像 ＋ 驗 18 個借來的檔
```

**改完前端一定要跑 `sync-copies.sh`**——回灌不是一次性的（WORKFLOW A4），
不跑的話 3001 上跑的是舊版。⚠️ 本 app **沒有 route**，所以回灌只有「整包前端」一步；
`InProgress/app.js` 不必也不該掛 `color-mixer`（實查：只有 `color-palette` 有掛，因為那支有 API）。
純靜態檔同步後 3001 常駐 server **不必重啟**。

## canon 重點（改動前先確認沒有違反）

- **零後端**：`app.js` 只有 static ＋ `/`→302 ＋ JSON 404，**沒有任何 API**、沒有 `routes/`、
  沒有 `public/upload/`。比照五支色彩 registry。
- **前端四件式**：`index.html`（純結構）／`color-mixer.css`／`color-mixer.js`（控制器）／
  `color-mixer-lib.js`（純核心、**不碰 DOM**、IIFE → `window.ColorMixerLib`）。
- **控制器不保存計算結果**：畫面／CSS／分享連結／最接近色，四個出口各自由 `state` 重算。
  這不是效能疏忽，是讓「畫面與輸出不一致」在結構上不可能（DESIGN §4.1）。
- **不重寫五個品牌的比對規矩**：lib 只有 `mergeNearest`，沒有 `nearestAcross`（DESIGN §4.2）。
- **品牌鍵＝app 資料夾名**（`copic-color`），與 `data-brand`／`pool.<id>` i18n key 全部同名；
  ⚠️ **不等於** `db_artcolor.meta_brand.fd_code`（`copic`），對照表見 DESIGN §4.3。
- **三語 ＋ light/dark ＋ 防閃爍開機腳本**；共用文案照 DESIGN_GUIDELINES §6 正統表逐字
  （`verify.js` F5 條擋著）。
- **原始碼不得含實體 NUL 位元組**（`verify.js` E1 條）。

## ⚠️ 反解（拆色）的三條紀律

`Lib.solve()` 給目標色反推配方。它解得動是因為**四個模型的疊層都是「某空間裡的凸組合」**
（`SPACE` 那張表是模型的**唯一**定義，`over()` 由它導出——求解器不是模型的第二份實作）。

1. **`EXACT_CONVEX` 是量出來的，不是推導的。** `oklab` **不在**裡面（逐層會被夾回 sRGB
   色域）。新增模型時要先量再決定它進不進這張表，`verify.js` G1 兩個方向都擋著。
2. **`reachable` ＝ 結果與目標同一個 hex**，不是「凸包距離 < 容差」也不是「ΔE00 < 某個數」。
   前者實測 13–20% 假陰性（目標 hex 本身已量化），後者那個門檻會是憑感覺挑的。
3. **`layers` 調色盤是校準值唯一進得到反解的路徑**（其餘調色盤沒有「哪支筆」的身分）。
   它走 `Lib.calibratedColors()`，不自己再比對一次；`verify.js` G6 擋著。

⚠️ **改到 `state.useCalib`／`substrate`／`model`／`solve*` 的 handler 一律 `renderAll()`。**
`#use-calib` 原本只呼叫 `renderNear()`（當年正確），反解上線後症狀是**勾了沒反應**——
不報錯，只是安靜地繼續用型錄色。`verify.js` G7 擋著這一整類。

## ⚠️ 筆刷的一條紀律

**繪圖迴圈不做合成。** 控制器只維護「這個像素被塗過幾次」的整數緩衝區，顏色查
`Lib.paintTable()`；合成永遠只發生在那支裡、用的是同一個 `compose`。
⚠️ **不可以改用 canvas 的 `globalAlpha` 疊**——那是瀏覽器的 alpha 合成＝**永遠只有 `srgb`**，
而畫面上還寫著現在選的是「罩染」。不報錯，只會讓四個模型看起來一模一樣。
`verify.js` I2 明文擋這個字，I1 擋「一筆 ＝ 圓圈那個色」，I4 擋「塗鴉不是 state」。

## ⚠️ 校準值的三條紀律（目視值取決於光線／螢幕／觀察者）

1. **一組 (筆, 基材, 層數) 可以有多列**（db_artcolor CHG000050 拿掉了唯一約束）。
   消費端一律走 `Lib.calibrationSummary()` 聚合，**不可假設只有一列**——
   舊的「層數最少者勝」在多列下會任意挑，而且不報錯。
2. **`repeatability`（同框架）與 `frameGap`（跨框架）是兩件事**，不可加在一起平均。
   前者是觀察者自己的精度，後者是換了光線／螢幕的結果。`verify.js` H2 擋著。
   只有一次觀測時兩者回 `null` 不是 0——0 會被讀成「量過而且很一致」。
3. **滑桿位置不存 state**，由 `describeNudge(錨點, 目視色)` 現算，所以畫面恆是實得值。
   色域到頂**只有滑桿事件當下知道得了**（要求值是輸入，事後推不回來），記在 `nudgeClipped`。
   `verify.js` H3 擋著這一整類。

## ⚠️ 兩個一定要記得的順序 / 語意陷阱

1. **`color-family.js` 必須早於 `faber-castell-color-lib.js` 與 `finecolour-color-lib.js`**
   ——那兩支在**模組載入時**就讀 `window.ColorFamily`，排錯整支 app 當場掛掉
   （家族 CLAUDE.md v1.18）。`verify.js` E2 條擋著。
2. **`calibratedColors()` 掛的 `calibrated` 旗標活不過品牌 lib**：`nearestXxx` 會把結果
   投影成自己那組固定欄位，自訂欄位被丟掉。要標記校準一律問 **`hasCalibration()`**。
   `verify.js` D5 條同時擋「控制器不得再讀 `it.calibrated`」。

## 複製件登記（共用件改版時靠這份清單找複製點同步）

| 檔案 | 權威版 | 備註 |
|---|---|---|
| `i18n.js` | 家族 repo 根 | byte-identical |
| `side-tool.css` / `side-tool.js` | 家族 repo 根 | byte-identical；CSS 應解析出 **25** 條規則 |
| `materialize-dark.css` | 家族 repo 根 | byte-identical；應解析出 **109** 條規則 |
| `color-family.js` | 家族 repo 根 | byte-identical；**載入順序有硬條件**，見上 |
| `filter-clear.css` / `filter-clear.js` | `local-reader` | byte-identical（§5.12 指定的權威版） |
| `faber-castell-color-lib.js` ＋ `data/fc-colors.js` | `faber-castell-color` | 由該 repo 的 `scripts/sync-copies.sh` 推送 |
| `caran-dache-color-lib.js` ＋ `data/cda-colors.js` | `caran-dache-color` | 同上 |
| `copic-color-lib.js` ＋ `data/copic-colors.js` | `copic-color` | 同上 |
| `finecolour-color-lib.js` ＋ `data/finecolour-colors.js` | `finecolour-color` | 同上 |
| `enmy-color-lib.js` ＋ `data/enmy-colors.js` | `enmy-color` | 同上 |

**本 app 是這五支的第三個消費端**（前兩個是 `color-palette`、`thangka-trace`）。
五支上游的 `scripts/sync-copies.sh` 已於 2026-08-07 把 color-mixer 收進複製點清單——
**每個檔案由 6 份複製增為 8 份**（本尊／`color-palette`／`thangka-trace`／`color-mixer`，各含
InProgress 鏡像），所以上游改版時會主動推過來，不必靠這裡的人記得去拉。
（實測反向驗證過：刪掉本 app 的複製件，跑上游腳本會推回來；本 app 的 InProgress 鏡像夾不見時，
上游腳本會 `MISSING` 並 exit 1。）

## 尚未做的事

見 [DESIGN.md §6](DESIGN.md)——**清單目前是空的**（2026-08-09 逐項實查，
最後一項 canvas 筆刷同日完成，見 §4.8）。八項的判準都留在 §6／§4.8。

⚠️ 那七項**早就做完而清單沒跟上**——同 v1.15 補記三的「清單落後實作」，
而**結轉的動作本身看起來像確認**。判準：**列一條待辦之前先查它還開著沒有。**

**`data/calibration.js` 自 2026-08-08 起是 `db_artcolor` 的匯出產物、不再是佔位資料**
（`CM_CALIBRATION_META.stub` 現為 false；stub 那條路徑與 `verify.js` F3 保留，
下次真的要放佔位資料時還會用到）。**產物是生成物、不手改**：
跑 `My Projects/Art Colour/export/a3-export.js --write`，再 `--check` 確認逐位元組相同。

⚠️ **兩張紙的紙色仍未量測**（`baseKnown: false`）。那不是漏抽，是還沒量——
而 `normalizeStack` 對缺席的 base **會退回 `#ffffff`**，於是「紙漿原色宣紙」會渲染成
跟白 A4 一模一樣的白紙，而 glaze 模型下紙色是會透出來的，**整條算出來的東西都是白紙的答案**。
零報錯。故基材下拉與畫布上各有一條告示，`verify.js` H4 條擋著（含「不可用 falsy 檢查
取代 `=== false`」——那會遮蓋「匯出器漏了這個欄位」）。
