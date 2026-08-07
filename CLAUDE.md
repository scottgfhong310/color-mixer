# color-mixer — Session 起手 context

> 版本 v0.1｜最後更新 2026-08-07

Art Color 家族的調色台：基材底色 ＋ 半透明顏料層 → 結果色 → 跨五品牌找最接近的筆，
並顯示該色的**應用校準**紀錄（同一支筆在不同紙上實際是什麼顏色）。

- **怎麼用** → [README.md](README.md)（三語）
- **為什麼長這樣** → [DESIGN.md](DESIGN.md) ← **動手前先讀，尤其 §3（四個混色模型）與 §5（三個坑）**
- **家族共同規範** → <https://github.com/scottgfhong310/nodeapp-webapp-family>
  （`DESIGN_GUIDELINES.md` / `WORKFLOW.md` / `DATABASE_GUIDELINES.md` / `SHARED_LIBRARY_GUIDELINES.md`）

## 執行與驗證

```bash
npm install && npm start          # → http://localhost:3000/apps/color-mixer/
npm run verify                    # 23 條契約檢查（全過 0 / 不符 1 / 旗標打錯 2）
node scripts/verify.js --selftest # 反向驗證：故意改壞，確認每條抓得到
bash scripts/sync-copies.sh       # 回灌 InProgress 鏡像 ＋ 驗 17 個借來的檔
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

見 [DESIGN.md §6](DESIGN.md)：canvas 筆刷（階段二）、校準的正式資料模型進治理文件、
`color-metric.js` 共用件抽出、`icons/` 與 favicon set、發佈與家族登錄
（README 成員表／`app-launcher` registry／i18n 盤點匯入）。

**`data/calibration.js` 目前是佔位資料**——`CM_CALIBRATION_META.stub` 為 true 時畫面掛告示，
`verify.js` F3 條擋著它不准被拿掉。正式版由 `My Projects/Art Colour/export/a3-export.js --write` 匯出。
