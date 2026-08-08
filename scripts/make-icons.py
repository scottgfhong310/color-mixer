#!/usr/bin/env python3
"""make-icons — 由母版參數產出整套 icon（SVG / PNG / .ico / manifest）。

icon 的概念：**兩個半透明色片重疊，重疊處是減色的結果**——把本 app 的招牌縮成一枚標記。
藍與黃各一片，交集處是綠。與家族其他色彩 app 清楚區隔：
faber-castell-color＝橫向色帶、caran-dache-color＝色卡扇、copic-color＝三乘三矩陣、
finecolour-color／enmy-color＝各自的色譜形狀——**那些都在描述「一批色」，
本 app 描述的是「兩色相遇會怎樣」**，所以標記畫的是相遇本身。

**重疊處的 hex 不寫死，由本 app 自己的 lib 現算**（比照 copic-color 的 make-icons.py
「九格由資料現查」那條）：icon 顯示的就是 app 會算出來的答案。
模型改了、icon 跟著改；於是「這個綠是真的」變成可驗證的，而不是註解裡的宣稱。

⚠️ **重疊處是畫上去的第三個形狀，不是靠 opacity 疊出來的**——這正是本 app 的論點：
   瀏覽器的 alpha 合成給的是灰橄欖（#8f9866），減色模型才給得出綠（km #3d7833）。
   用 `fill-opacity` 疊會畫出前者，等於這枚 icon 在反駁自己。

⚠️ PyMuPDF 的兩個限制（copic-color / faber-castell-color / thangka-trace 都踩過）：
  ① **不渲染 linearGradient**，會整片退成黑色 → 母版一律純色底。
  ② **以 SVG 宣告的 width/height 為渲染基準、不是 viewBox** → 倍率要用
     「目標 ÷ 實際 page 寬」反推，寫死 size/100 會得到完全錯誤的尺寸。

用法：python3 scripts/make-icons.py
      ../nodeapp-webapp-family/tools/make-ico.sh …   # .ico 另由家族工具產（見下）
"""
import json
import os
import subprocess

import fitz
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'public', 'apps', 'color-mixer')
OUT = os.path.join(APP, 'icons')

# 母版：兩片色與模型。**與 color-mixer-lib.js 檔頭那張實測表、以及 verify.js 的 A4 條同一組**
# ——icon、文件、契約檢查講的是同一件事，改一處另兩處會跟著紅。
IN_A, IN_B, MODEL = '#2b5fa8', '#f2d024', 'km'

DARK_TILE, DARK_EDGE = '#151a24', '#10131a'
LIGHT_TILE, LIGHT_EDGE = '#f6f8fa', '#ffffff'
PAGE_BG = '#0f1115'          # ＝ app 的深色頁面底；theme_color／background_color 都用它


def overlap_hex():
    """重疊色由本 app 的 lib 現算——**不寫死**。算不出來就直接爆，不要默默配一個假顏色。"""
    js = (
        "const fs=require('fs'),w={};"
        "new Function('window','globalThis',fs.readFileSync(process.argv[1],'utf8'))(w,w);"
        "new Function('window','globalThis',fs.readFileSync(process.argv[2],'utf8'))(w,w);"
        "process.stdout.write(w.ColorMixerLib.compose("
        "{base:process.argv[3],layers:[{hex:process.argv[4],alpha:0.5}]}, process.argv[5]).hex);"
    )
    out = subprocess.run(
        ['node', '-e', js,
         os.path.join(APP, 'color-metric.js'), os.path.join(APP, 'color-mixer-lib.js'),
         IN_A, IN_B, MODEL],
        capture_output=True, text=True, check=True).stdout.strip()
    if not out.startswith('#') or len(out) != 7:
        raise SystemExit(f'lib 回了不像顏色的東西：{out!r}')
    return out


def mark(tile, edge, hairline, mix):
    """兩片重疊 ＋ 交集。交集用 clipPath 明確畫出來，不用 opacity（見檔頭）。"""
    rim = (f'<rect x="1" y="1" width="98" height="98" rx="21.5" fill="none" '
           f'stroke="{edge}" stroke-width="2"/>') if hairline else ''
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">'
        f'<rect width="100" height="100" rx="22.5" fill="{tile}"/>{rim}'
        '<defs><clipPath id="lft"><circle cx="38" cy="50" r="27"/></clipPath></defs>'
        f'<circle cx="38" cy="50" r="27" fill="{IN_A}"/>'
        f'<circle cx="62" cy="50" r="27" fill="{IN_B}"/>'
        f'<circle cx="62" cy="50" r="27" fill="{mix}" clip-path="url(#lft)"/>'
        '</svg>'
    )


def build_svgs(mix):
    files = {
        'favicon.svg':            mark(DARK_TILE, DARK_EDGE, False, mix),
        'favicon-light.svg':      mark(LIGHT_TILE, LIGHT_EDGE, True, mix),
        'color-mixer-icon.svg':       mark(DARK_TILE, DARK_EDGE, False, mix),
        'color-mixer-icon-light.svg': mark(LIGHT_TILE, LIGHT_EDGE, True, mix),
    }
    for name, svg in files.items():
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
            f.write(svg + '\n')
    # §5.5 稽核：淺版必須**真的與深版不同**（`cp favicon.svg favicon-light.svg` 不算數）
    assert files['favicon.svg'] != files['favicon-light.svg'], '淺版與深版相同'
    return files


def build_pngs():
    src = os.path.join(OUT, 'favicon.svg')
    doc = fitz.open(src)
    page = doc[0]
    for size in (16, 32, 48, 64, 128, 180, 192, 256, 512):
        # ⚠️ 倍率用「目標 ÷ 實際 page 寬」反推——PyMuPDF 以 SVG 的 width/height 為基準，
        #    不是 viewBox；寫死 size/100 會得到完全錯誤的尺寸（檔頭 ② ）。
        zoom = size / page.rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True)
        out = os.path.join(OUT, f'icon-{size}.png')
        pix.save(out)
        got = Image.open(out).size
        if got != (size, size):
            raise SystemExit(f'icon-{size}.png 實際是 {got}——倍率算錯了')
    doc.close()


def build_manifest():
    m = {
        "name": "color-mixer",
        "short_name": "Colour mixer",
        "description": "Layer translucent pigments over a substrate and find the closest pen "
                       "in the Art Color family.",
        "start_url": "/apps/color-mixer/",
        "scope": "/apps/color-mixer/",
        "display": "standalone",
        "background_color": PAGE_BG,
        "theme_color": PAGE_BG,
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    mix = overlap_hex()
    print(f'  重疊色由 lib 現算：{IN_A} + {IN_B} @ {MODEL} → {mix}')
    build_svgs(mix)
    build_pngs()
    build_manifest()
    print('  SVG 4 / PNG 9 / manifest 1 已產生')
    print('  ⚠️ .ico 另跑：../nodeapp-webapp-family/tools/make-ico.sh '
          'public/apps/color-mixer/icons/favicon.svg public/apps/color-mixer/icons/favicon.ico')
