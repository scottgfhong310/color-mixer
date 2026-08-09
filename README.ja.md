# color-mixer

> 版本 v0.1｜最後更新 2026-08-07

[English](README.md) ｜ [繁體中文](README.zh-Hant.md) ｜ **日本語**

**Art Color** ファミリーのための調色台。基材を選ぶと（その紙色がキャンバスの地色になります）、
その上に半透明の顔料を重ねて結果色を求め、**5 ブランド／比較対象 1,779 本**の中から
最も近い実在のペンを探します。

混色モデルは 4 つ——「2 色を重ねると何色になるか」に唯一の答えはなく、
**光**を訊いているのか**顔料**を訊いているのかで変わるからです。今どちらを見ているかは常に画面に出ます。

本プロジェクトは **nodeapp WebApp ファミリー**の一員です。共通規約とワークフローは
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md`、`WORKFLOW.md`）。
このアプリがなぜ存在し、構想がどこから来たのかは [CONCEPT.md](CONCEPT.md)。
なぜこの形なのかは [DESIGN.md](DESIGN.md)。

> ⚠️ **開発中。** 現在同梱されている校正データは**プレースホルダーであり実測値ではありません**。
> その場合は画面に告知バナーが出ます。

## 機能

- **基材 → キャンバスの地色**：紙を選ぶとその色が混色の下地になります。hex を直接入力も可。
- **顔料レイヤー**（最大 8 層）をファミリーの 5 つの registry——Faber-Castell、Caran d'Ache、
  COPIC、Finecolour、ENMY——から選択。各層に不透明度があり、順序も入れ替えられます。
- **4 つの混色モデル、2 グループ**：

  | グループ | モデル | 何に答えるか |
  |---|---|---|
  | 光の加算 | `sRGB 合成` | **ブラウザ**が半透明レイヤーを重ねるときの実際の挙動 |
  | 光の加算 | `OKLab 合成` | 明度変化が知覚的に均一、ガンマの誤りなし |
  | 減法 | **`グレーズ`**（既定） | 基材の上の透明な墨層——**紙の色が透けて見える** |
  | 減法 | `パレット混色` | 2 つの顔料を混ぜ合わせる——紙の色は透け**ない** |

  同じスライダーがモデルによって**被覆率／墨層の厚み／濃度**を意味し、画面でそれを説明します。
  減法モデルは 1 つの sRGB hex から逆算した**近似**であることも明示します。
- **5 ブランド横断で最も近い色**を CIEDE2000（ΔE00）順に表示。**各ブランド固有の比較ルールを尊重**
  します（FC は Art & Graphic のみ、CDA は PSTC を除外…）。
  比較対象に**実際に何本入っているか**も画面に出ます。
- **校正値で比較**：選んだ基材での実塗色記録があるペンは、カタログ見本ではなくその値で比較します。
- **URL がセーブデータ**——レシピ全体がクエリ文字列に入るので、リンクをコピーすれば保存になります。
- ライト / ダークテーマ、**zh-Hant / en / ja** の 3 言語、**バックエンドなし**。

## インストールと実行

```bash
npm install
npm start          # → http://localhost:3000/apps/color-mixer/
```

ポートは `PORT` で上書きできます（例：`PORT=3009 npm start`）。契約チェックの実行：

```bash
npm run verify
```

## ディレクトリ構成

```
app.js                                   # Express エントリ：static + / → 302 + JSON 404。API なし。
scripts/verify.js                        # 23 件の契約チェック（--selftest で各条を逆検証）
public/apps/color-mixer/
├─ index.html                            # 構造のみ
├─ color-mixer.css                       # テーマ token + ページ様式
├─ color-mixer.js                        # コントローラ：DOM、イベント、i18n 再描画
├─ color-mixer-lib.js                    # 純粋コア：4 つの混色モデル、URL 状態（window.ColorMixerLib）
├─ color-family.js                       # 共有部品：色系グルーピング規則（下の 2 つの lib より**必ず先に**）
├─ {faber-castell,caran-dache,copic,finecolour,enmy}-color-lib.js   # 5 ブランドの比較器
├─ data/{fc,cda,copic,finecolour,enmy}-colors.js                    # 5 ブランドの registry
├─ data/calibration.js                   # ⚠ プレースホルダーの校正データ ＋ 基材
├─ materialize-dark.css · side-tool.{css,js} · filter-clear.{css,js} · i18n.js · locales/
```

## データ構造

```jsonc
// 1 回の調色＝アプリの状態全体であり、URL がエンコードする内容
{
  "base":   "#f0e6d2",                      // キャンバスの地色（＝基材の紙色）
  "layers": [
    { "hex": "#255da7", "alpha": 0.62,      // 0–1；意味はモデルにより変わる（上記参照）
      "src": { "brand": "copic-color", "code": "B39" } },   // 自作の色のときは null
    { "hex": "#f2d024", "alpha": 0.28, "src": null }
  ]
}

// ColorMixerLib.compose(stack, model) →
{
  "hex":   "#6e9678",
  "r": 110, "g": 150, "b": 120,
  "steps": ["#f0e6d2", "#4a6f8e", "#6e9678"]   // 各層を重ねた後の色；steps[0] は地色
}

// data/calibration.js — 応用校正の観測 1 件
{
  "brand": "copic-color",        // ⚠ アプリのフォルダ名。db_artcolor の meta_brand.fd_code ではない
  "code": "B39",
  "substrate": "a4-white", "layers": 1,
  "hexRef": "#08093d",           // 目視比較で最初に止まった基準点
  "hex":    "#06072f",           // 微調整後に確定した値
  "note":   "…",                 // 自由記述；挙動（にじみ・裏抜け）は当面ここ
  "sourceType": "measured",      // 第 3 の出典クラス：メーカーの言ではなく、こちらの計測
  "verify": "stub"
}
```

カタログ値 → 確定値は「画面と紙がどれだけ離れているか」、基準点 → 確定値は「自分の目がどれだけ
ずれているか」に答えます。[DESIGN.md §2](DESIGN.md) 参照。

## API はありません

本アプリにエンドポイントはありません。色データはファミリー 5 registry の静的コピー、
校正データは `db_artcolor` の書き出し成果物です（DB は**ビルド時**の System of Record であり、
**公開アプリは決して DB に接続しません**）。`app.js` は静的配信、`/` のリダイレクト、
`/api/` 配下の JSON 404 のみを担います。

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
