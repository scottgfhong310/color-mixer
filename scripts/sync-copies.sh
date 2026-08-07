#!/bin/bash
# sync-copies.sh — 把本 repo 的前端同步到 InProgress 鏡像，並驗證所有「借來的」共用件。
#
# 本 repo 在同步這件事上同時是兩種角色：
#   ① **上游**（權威版）→ InProgress 鏡像：整包前端，本腳本會覆蓋它。
#   ② **下游**（消費端）← 家族 repo / local-reader / 五支色彩 registry：
#      共用件、五支品牌 lib 與其資料。**本腳本只驗、不抓**——「該不該更新」是上游的決定，
#      這裡自動拉會讓一次無意的上游改動悄悄流進來。不一致時它會明講該去哪裡同步。
#
# ⚠️ **本 app 沒有 route，所以沒有第 ② 步**（零後端：app.js 只有 static + 302 + JSON 404）。
#    這是刻意寫出來的，不是省略——WORKFLOW A4 的回灌範圍是「前端 ＋ app 專屬 route」，
#    而 `chat-archive` 就是漏了後半、長出「新前端＋舊後端」，症狀完全不像同步問題
#    （家族 CLAUDE.md v1.22）。本 app 在 InProgress/app.js **不需要也不該有**掛載，
#    與五支色彩 registry 相同（實查：InProgress/app.js 只掛了 color-palette，因為那支有 API）。
#    純靜態檔同步後 **3001 常駐 server 不必重啟**。
#
# **回灌不是一次性的**（WORKFLOW.md Path A 的 A4）：GitHub 版是權威，
# 之後每次改前端都要再跑一次，否則 3001 上跑的是舊版。
#
# 用法：bash scripts/sync-copies.sh
set -u
G=/Users/Shared/nodeapp/GitHub
I=/Users/Shared/nodeapp/InProgress
F=$G/nodeapp-webapp-family
SRC=$G/color-mixer/public/apps/color-mixer
DST=$I/public/apps/color-mixer
FAIL=0

echo "=== ① 整包前端 → InProgress 鏡像（只同步程式碼）==="
mkdir -p "$DST"
# ⚠️ 要看 cp 自己的 exit code：`cp` 失敗只把訊息印到 stderr，**不會讓腳本失敗**；
#    若接著只看 diff，遇到「複製失敗但兩邊本來就相同」會印 OK ＋ exit 0
#    （家族 CLAUDE.md v1.18 在 color-palette 的同一支腳本上實測過這個假陽性）。
if ! cp -R "$SRC/." "$DST/"; then
  echo "  ERROR  cp 失敗"
  FAIL=1
fi

if diff -rq "$SRC" "$DST" > /dev/null; then
  echo "  OK  與獨立版逐檔相同（$(find "$SRC" -type f | wc -l | tr -d ' ') 個檔）"
else
  echo "  MISMATCH  以下有差異："
  diff -rq "$SRC" "$DST"
  FAIL=1
fi

echo
echo "=== ② 借來的共用件與品牌資料：與權威版比對（只驗不抓）==="
check() {  # $1=本地相對路徑  $2=權威版絕對路徑  $3=權威版說明
  local a b
  a=$(md5 -q "$SRC/$1" 2>/dev/null) || a=MISSING
  b=$(md5 -q "$2" 2>/dev/null) || b=MISSING
  if [ "$a" = "$b" ] && [ "$a" != "MISSING" ]; then
    printf "  OK        %-34s %s\n" "$1" "$a"
  else
    printf "  MISMATCH  %-34s local=%s auth=%s\n" "$1" "$a" "$b"
    printf "            ← 權威版：%s\n" "$3"
    FAIL=1
  fi
}

# A 類共用件（權威版＝家族 repo 根）
check i18n.js             "$F/i18n.js"             "nodeapp-webapp-family/i18n.js"
check side-tool.css       "$F/side-tool.css"       "nodeapp-webapp-family/side-tool.css"
check side-tool.js        "$F/side-tool.js"        "nodeapp-webapp-family/side-tool.js"
check materialize-dark.css "$F/materialize-dark.css" "nodeapp-webapp-family/materialize-dark.css"
# ⚠️ color-family.js 有**載入順序**的硬條件：必須早於 faber-castell / finecolour 兩支 lib
#    （它們在模組載入時就讀 window.ColorFamily）。scripts/verify.js 的 E2 條擋著。
check color-family.js     "$F/color-family.js"     "nodeapp-webapp-family/color-family.js"

# filter-clear 的權威版是 local-reader 那份（DESIGN_GUIDELINES §5.12 指定）
check filter-clear.css    "$G/local-reader/public/apps/local-reader/filter-clear.css" "local-reader"
check filter-clear.js     "$G/local-reader/public/apps/local-reader/filter-clear.js"  "local-reader"

# 五支品牌的比對器與資料（權威版＝各自的 repo；由那邊的 sync-copies.sh 推送過來）
for b in faber-castell-color caran-dache-color copic-color finecolour-color enmy-color; do
  check "$b-lib.js" "$G/$b/public/apps/$b/$b-lib.js" "$b"
done
check data/fc-colors.js         "$G/faber-castell-color/public/apps/faber-castell-color/data/fc-colors.js"   "faber-castell-color"
check data/cda-colors.js        "$G/caran-dache-color/public/apps/caran-dache-color/data/cda-colors.js"       "caran-dache-color"
check data/copic-colors.js      "$G/copic-color/public/apps/copic-color/data/copic-colors.js"                 "copic-color"
check data/finecolour-colors.js "$G/finecolour-color/public/apps/finecolour-color/data/finecolour-colors.js"  "finecolour-color"
check data/enmy-colors.js       "$G/enmy-color/public/apps/enmy-color/data/enmy-colors.js"                    "enmy-color"

echo
echo "  註：data/calibration.js **不在**上面的清單裡——它不是借來的共用件，"
echo "      是 db_artcolor 的匯出產物（目前為佔位資料，見 CLAUDE.md）。"
echo
echo "  註：五支品牌 repo 的 sync-copies.sh 已於 2026-08-07 把 color-mixer 收進複製點清單"
echo "      （各檔由 6 份複製增為 8 份：本尊／color-palette／thangka-trace／color-mixer，各含 InProgress 鏡像），"
echo "      所以上游改版時會主動推過來。本段的 MISMATCH 是**第二道防線**，不是唯一那道。"

echo
if [ "$FAIL" -eq 0 ]; then echo "全部通過。"; else echo "有項目不一致（見上）。"; fi
exit "$FAIL"
