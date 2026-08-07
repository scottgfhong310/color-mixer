# color-mixer

> 版本 v0.1｜最後更新 2026-08-07

[English](README.md) ｜ **繁體中文** ｜ [日本語](README.ja.md)

**Art Color** 家族的調色台。選一個基材（它的紙色就是畫布底色），在上面疊半透明顏料，
算出結果色，再到**五個品牌／1,779 支可比對的筆**裡找最接近的那一支。

四個混色模型——因為「兩個顏色疊起來會變成什麼」沒有唯一答案，它取決於你問的是**光**還是**顏料**。
畫面上恆顯示你現在看的是哪一種。

本專案為 **nodeapp WebApp 家族**成員，共同規範與流程見
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md`、`WORKFLOW.md`）。
為什麼長這樣：[DESIGN.md](DESIGN.md)。

> ⚠️ **開發中。** 目前隨附的校準資料是**佔位值，不是實測**。是佔位資料時畫面上會有一條告示。

## 功能

- **基材 → 畫布底色**：選一張紙，它的顏色就成為混色的底。也可以直接填任何 hex。
- **顏料層**（最多 8 層）取自家族五支 registry——Faber-Castell、Caran d'Ache、COPIC、
  Finecolour、ENMY——每層各有自己的透明度，可調換順序。
- **四個混色模型，分兩組**：

  | 組 | 模型 | 它回答什麼 |
  |---|---|---|
  | 光的疊加 | `sRGB 合成` | **瀏覽器**疊半透明圖層時的真實行為 |
  | 光的疊加 | `OKLab 合成` | 明度變化感知均勻、無 gamma 誤差 |
  | 減色 | **`罩染`**（預設） | 透明墨層蓋在基材上——**紙色會透出來** |
  | 減色 | `調色盤混合` | 兩坨顏料混在一起——紙色**不會**透出來 |

  同一個滑桿在四個模型下分別是**覆蓋率／墨層厚度／濃度**，畫面上會講。
  減色模型是由單一 sRGB hex 反推的**近似**，畫面上也會講。
- **跨五個品牌找最接近色**，依 CIEDE2000（ΔE00）排序，且**尊重各品牌自己的比對規矩**
  （FC 只比 Art & Graphic、CDA 排除 PSTC…）。畫面顯示**現在比對池裡實際有幾支筆**。
- **以校準值比對**：某支筆在所選基材上有實際上色紀錄時，改用那個值比對，而不是型錄色票。
- **網址列就是存檔**——整份配方寫在查詢字串裡，複製連結＝存檔。
- light / dark 主題、**zh-Hant / en / ja** 三語、**完全沒有後端**。

## 安裝與執行

```bash
npm install
npm start          # → http://localhost:3000/apps/color-mixer/
```

以 `PORT` 覆寫連接埠（如 `PORT=3009 npm start`）。跑契約檢查：

```bash
npm run verify
```

## 目錄結構

```
app.js                                   # Express 入口：static + / → 302 + JSON 404。無 API。
scripts/verify.js                        # 23 條契約檢查（--selftest 反向驗證每一條）
public/apps/color-mixer/
├─ index.html                            # 純結構
├─ color-mixer.css                       # 主題 token + 本頁樣式
├─ color-mixer.js                        # 控制器：DOM、事件、i18n 重繪
├─ color-mixer-lib.js                    # 純核心：四個混色模型、網址狀態（window.ColorMixerLib）
├─ color-family.js                       # 共用件：色系分群規則（**必須早於**下面兩支品牌 lib）
├─ {faber-castell,caran-dache,copic,finecolour,enmy}-color-lib.js   # 五個品牌的比對器
├─ data/{fc,cda,copic,finecolour,enmy}-colors.js                    # 五個品牌的 registry
├─ data/calibration.js                   # ⚠ 佔位校準資料 ＋ 基材
├─ materialize-dark.css · side-tool.{css,js} · filter-clear.{css,js} · i18n.js · locales/
```

## 資料結構

```jsonc
// 一次調色＝整個 app 狀態，也是網址編碼的內容
{
  "base":   "#f0e6d2",                      // 畫布底色（＝基材的紙色）
  "layers": [
    { "hex": "#255da7", "alpha": 0.62,      // 0–1；語意隨模型而變（見上）
      "src": { "brand": "copic-color", "code": "B39" } },   // 自調色時為 null
    { "hex": "#f2d024", "alpha": 0.28, "src": null }
  ]
}

// ColorMixerLib.compose(stack, model) →
{
  "hex":   "#6e9678",
  "r": 110, "g": 150, "b": 120,
  "steps": ["#f0e6d2", "#4a6f8e", "#6e9678"]   // 疊完每一層之後的顏色；steps[0] 是底色
}

// data/calibration.js — 一次應用校準觀測
{
  "brand": "copic-color",        // ⚠ 是 app 資料夾名，不是 db_artcolor 的 meta_brand.fd_code
  "code": "B39",
  "substrate": "a4-white", "layers": 1,
  "hexRef": "#08093d",           // 目視比對時第一次停下的錨點
  "hex":    "#06072f",           // 微調後認可的值
  "note":   "…",                 // 自由註記；行為事實（渲開、透背）目前放這裡
  "sourceType": "measured",      // 第三類來源：不是原廠說的，是我方量的
  "verify": "stub"
}
```

型錄值 → 認可值回答「螢幕離紙有多遠」；錨點 → 認可值回答「我的眼睛偏多少」。見 [DESIGN.md §2](DESIGN.md)。

## 沒有 API

本 app 沒有任何端點。色彩資料是五支家族 registry 的靜態複製件；校準資料是 `db_artcolor` 的匯出產物
（DB 是**建置期**的 System of Record，**公開 app 永不連庫**）。`app.js` 只負責靜態檔、根路徑轉址、
以及 `/api/` 底下的 JSON 404。

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
