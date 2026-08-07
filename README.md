# color-mixer

> 版本 v0.1｜最後更新 2026-08-07

**English** ｜ [繁體中文](README.zh-Hant.md) ｜ [日本語](README.ja.md)

A colour mixing bench for the **Art Color** family. Pick a substrate (its paper colour becomes the
canvas base), layer translucent pigments on top, and get the resulting colour — then find the closest
real pen across **five brands / 1,779 comparable pens**.

Four mixing models, because *"what do two colours make when layered"* has no single answer: it depends
on whether you are asking about **light** or about **paint**. The app always says which one you are
looking at.

Part of the **nodeapp WebApp family** — shared conventions and workflow live at
<https://github.com/scottgfhong310/nodeapp-webapp-family> (`DESIGN_GUIDELINES.md`, `WORKFLOW.md`).
Why it is built this way: [DESIGN.md](DESIGN.md).

> ⚠️ **Work in progress.** The calibration data shipped here is a **placeholder, not measured**.
> The app shows a banner whenever that is the case.

## Features

- **Substrate → canvas base**: pick a paper and its colour becomes the base of the mix. Or type any hex.
- **Pigment layers** (up to 8) from the five family registries — Faber-Castell, Caran d'Ache, COPIC,
  Finecolour, ENMY — each with its own transparency, reorderable.
- **Four mixing models**, in two groups:

  | group | model | what it answers |
  |---|---|---|
  | additive | `sRGB` | what the **browser** does with translucent layers |
  | additive | `OKLab` | perceptually even lightness, no gamma error |
  | subtractive | **`Glaze`** (default) | a transparent ink layer over a substrate — **the paper shows through** |
  | subtractive | `Palette mix` | two pigments physically mixed — the paper does **not** show through |

  The same slider means **coverage / ink thickness / concentration** depending on the model, and the
  page says so. Subtractive models are **approximations** inferred from a single sRGB hex, and the page
  says that too.
- **Closest colours across all five brands**, ranked by CIEDE2000 (ΔE00), with each brand's own
  comparison rules respected (FC compares Art & Graphic only, CDA excludes PSTC, …). The page shows
  **how many pens are actually in the pool**.
- **Compare using calibrated values**: where a real-application record exists for the chosen substrate,
  that colour is compared using its measured-on-paper value instead of the catalogue swatch.
- **The URL is the save file** — the whole recipe lives in the query string, so copying the link is saving.
- Light / dark themes, **zh-Hant / en / ja** i18n, no backend at all.

## Install & run

```bash
npm install
npm start          # → http://localhost:3000/apps/color-mixer/
```

Override the port with `PORT` (e.g. `PORT=3009 npm start`). Run the contract checks with:

```bash
npm run verify
```

## Directory structure

```
app.js                                   # Express entry: static + / → 302 + JSON 404. No API.
scripts/verify.js                        # 23 contract checks (--selftest reverse-verifies them)
public/apps/color-mixer/
├─ index.html                            # structure only
├─ color-mixer.css                       # theme tokens + page styles
├─ color-mixer.js                        # controller: DOM, events, i18n redraw
├─ color-mixer-lib.js                    # pure core: 4 mixing models, URL state (window.ColorMixerLib)
├─ color-family.js                       # shared: colour-family rules (must load BEFORE the two libs below)
├─ {faber-castell,caran-dache,copic,finecolour,enmy}-color-lib.js   # the five brands' comparators
├─ data/{fc,cda,copic,finecolour,enmy}-colors.js                    # the five brands' registries
├─ data/calibration.js                   # ⚠ placeholder calibration + substrates
├─ materialize-dark.css · side-tool.{css,js} · filter-clear.{css,js} · i18n.js · locales/
```

## Data shapes

```jsonc
// A mix — the whole app state, and what the URL encodes
{
  "base":   "#f0e6d2",                      // canvas base (the substrate's paper colour)
  "layers": [
    { "hex": "#255da7", "alpha": 0.62,      // 0–1; meaning depends on the model (see above)
      "src": { "brand": "copic-color", "code": "B39" } },   // null when it is a custom colour
    { "hex": "#f2d024", "alpha": 0.28, "src": null }
  ]
}

// ColorMixerLib.compose(stack, model) →
{
  "hex":   "#6e9678",
  "r": 110, "g": 150, "b": 120,
  "steps": ["#f0e6d2", "#4a6f8e", "#6e9678"]   // colour after each layer; steps[0] is the base
}

// data/calibration.js — one application-calibration observation
{
  "brand": "copic-color",        // ⚠ the app folder name, NOT db_artcolor's meta_brand.fd_code
  "code": "B39",
  "substrate": "a4-white", "layers": 1,
  "hexRef": "#08093d",           // the anchor you first stopped at while eyeballing
  "hex":    "#06072f",           // the value you accepted after fine-tuning
  "note":   "…",                 // free text; behavioural facts (bleed, show-through) live here for now
  "sourceType": "measured",      // a third source class: not what the maker said, what we measured
  "verify": "stub"
}
```

Catalogue → accepted answers *"how far is the screen from the paper"*; anchor → accepted answers
*"how far off is my eye"*. See [DESIGN.md §2](DESIGN.md).

## No API

This app has no endpoints. Colour data are static copies of the five family registries; calibration is
an export product of `db_artcolor` (the DB is a **build-time** system of record — public apps never
connect to it). `app.js` only serves static files, redirects `/`, and returns a JSON 404 under `/api/`.

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
