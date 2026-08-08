/* 繁體中文（zh-Hant） */
I18n.register('zh-Hant', {
  'title.page': 'color-mixer — 調色盤',
  'app.title': '調色盤',
  'app.sub': '在基材底色上疊顏料，算出結果色，並在 Art Color 家族裡找最接近的筆',

  /* ---- 畫布 ---- */
  'canvas.aria': '外圈是基材（紙色），中央的圓是顏料疊加區（結果色）',
  'canvas.substrate': '基材（畫布底色）',
  'canvas.baseHex': '自訂底色',
  'canvas.observed': '目視色（我看到的）',
  'canvas.observedHint': '填你實際看到的顏色；圓圈會改用它渲染，並印出與計算值的差距',
  'canvas.observedBadge': '目視',
  'canvas.computed': '計算值',
  'canvas.custom': '自訂…',

  /* ---- 顏料層 ---- */
  'layers.title': '顏料層',
  'layers.add': '加一層',
  'layers.empty': '還沒有顏料層——按「加一層」從家族的五個品牌挑一支筆，或直接填一個 hex。',
  'layers.custom': '自調色',
  'layers.unknownBrand': '未知品牌 {b}',
  'layers.up': '往上一層',
  'layers.down': '往下一層',
  'layers.remove': '移除這一層',
  'layers.full': '最多 {n} 層',

  /* ---- 混色模型 ----
     ⚠️ 這四段說明是本 app 最重要的文案：使用者換一個模型看到數字全變了，
     沒有這幾句就會以為是 bug。判準同 circle-text「配平要犧牲哪個變數」——
     錯的從來不是某個做法，是不講。 */
  'model.title': '混色模型',
  'model.groups': '左：光的疊加　右：減色（近似）',
  'model.srgb': 'sRGB 合成',
  'model.oklab': 'OKLab 合成',
  'model.glaze': '罩染',
  'model.km': '調色盤混合',
  'model.srgb.note': '瀏覽器疊半透明圖層時的真實行為（CSS rgba()／canvas globalAlpha）。要回答「螢幕上長怎樣」就用它——它不是顏料，藍疊黃會得到灰綠而不是綠。',
  'model.oklab.note': '在 OKLab 空間插值：明度變化感知均勻，且修掉了 sRGB 的 gamma 誤差。⚠ 但它<b>不會</b>讓中段不發灰——互補色之間走直線會穿過中性軸，藍＋黃實測比 sRGB <b>更灰</b>（Lab 彩度 12.2 對 27.9）。仍是光的疊加。',
  'model.glaze.note': '透明墨層蓋在基材上（Beer-Lambert）。麥克筆、透明水彩、照相染料都是這個行為——<b>紙色會透出來</b>，而且影響隨墨層加厚而遞減。這是本 app 的預設值。',
  'model.km.note': '兩坨顏料混在一起（單常數 Kubelka-Munk）。此模型把底色當成另一種顏料一起混，<b>紙色不會透出來</b>——「同一支筆在不同紙上」這個問題它答不出來。',
  'model.approx': '⚠ 減色模型是由單一 sRGB hex 反推的<b>近似</b>，不是量測值：真正的 Kubelka-Munk 需要每個顏料實測的吸收與散射光譜，原廠不公布。純數位原色（通道值 0 或 255）在此模型下尤其失真。',

  /* ---- 透明度的語意（四個模型不同，這是真實差異不是實作瑕疵） ---- */
  'alpha.srgb': '滑桿＝<b>覆蓋率</b>：這一層蓋掉下層多少。',
  'alpha.oklab': '滑桿＝<b>覆蓋率</b>：這一層蓋掉下層多少。',
  'alpha.glaze': '滑桿＝<b>墨層厚度</b>：光穿過幾次。',
  'alpha.km': '滑桿＝<b>濃度</b>：這一層的顏料佔混合物多少比例。',

  /* ---- 最接近色 ---- */
  'near.title': 'Art Color 家族最接近的色',
  'near.pool': '正在比對 {n} 支筆（{brands} 個品牌）',
  'near.useCalib': '以校準值比對（有紀錄的色改用實際上色值）',
  'near.empty': '沒有符合的品牌——至少要選一個。',
  'near.calibrated': '校準',
  'band.very': '極接近',
  'band.close': '接近',
  'band.noticeable': '可辨差異',
  'band.far': '差異大',

  /* ---- 各品牌比對範圍的實話（預設值不是「全部」，不講會誤導） ---- */
  'pool.faber-castell-color': 'Faber-Castell 預設只比 Art & Graphic，不含 Black Edition（另一條產品線）',
  'pool.caran-dache-color': 'Caran d’Ache 排除 PSTC（與 PSTP 共用同一份調色盤）',
  'pool.copic-color': 'COPIC 排除無色調和筆',
  'pool.finecolour-color': 'Finecolour 預設只比麥克筆色號空間，不含彩針筆與壓克力筆',
  'pool.enmy-color': 'ENMY 全 80 色',

  /* ---- 挑色 ---- */
  'pick.title': '挑一支筆',
  'pick.placeholder': '色號或色名…',
  'pick.empty': '找不到符合的顏色',

  /* ---- 明細（§11.1） ---- */
  'detail.use': '加進顏料層',
  'detail.facts': '事實',
  'detail.calib': '應用校準',
  'detail.noCalib': '這支筆還沒有校準紀錄。',
  'detail.catalogHex': '型錄值',
  'detail.refHex': '目視錨點',
  'detail.finalHex': '認可值',
  'detail.substrate': '基材',
  'detail.layers': '層數',
  'detail.approxNote': '型錄色票為螢幕近似值，非官方規格。',

  /* ---- CSS ---- */
  'css.title': '這次調色的 CSS',
  'css.note': '配方寫在註解裡——只給一個 hex，日後沒有人知道它是怎麼來的。',
  'css.copy': '複製',

  /* ---- 校準 ---- */
  'calib.title': '校準紀錄',
  'calib.note': '校準紀錄由 db_artcolor 匯出，本 app 唯讀。三個 hex 各自回答不同的問題：型錄值 → 認可值＝螢幕與實際上色的差距；錨點 → 認可值＝目視偏差。',
  'calib.stubWarn': '目前載入的校準資料是佔位值，不是實測——請勿據以決定用色。',
  'calib.empty': '目前沒有任何校準紀錄。',
  'calib.count': '{n} 筆紀錄',

  /* ---- 側鍵 ---- */
  'tool.add': '加一層顏料',
  'tool.calib': '校準紀錄',
  'tool.css': '檢視 / 複製 CSS',
  'tool.share': '複製分享連結',
  'tool.reset': '清除這次調色',
  'tool.mode': '切換 light / dark',
  'tool.lang': '語言',
  'tool.more': '更多工具',
  'tool.clearFilter': '清除',

  'btn.close': '關閉',

  /* ---- 反解（拆色） ---- */
  'solve.title': '反解：把一個顏色拆成配方',
  'solve.ctx': '底色 {base}　模型 {model}',
  'solve.target': '目標色',
  'solve.useDisc': '用圓圈現在的色',
  'solve.clear': '清除',
  'solve.palette': '基底顏料',
  'solve.pal.rgb': 'RGB 三原色',
  'solve.pal.cmy': 'CMY',
  'solve.pal.cmyk': 'CMYK',
  'solve.pal.layers': '畫布上的顏料層',
  'solve.pal.custom': '自訂',
  'solve.customPh': '用空白隔開，例如 #ff0000 #00ff00 #0000ff',
  'solve.empty': '填一個目標色，或按「用圓圈現在的色」。',
  'solve.noPalette': '這個調色盤是空的——填至少一個顏色，或先在畫布上加幾層顏料。',
  'solve.usingCalib': '（顏料用該基材的校準值）',
  'solve.wanted': '想要的',
  'solve.got': '這組顏料最接近的',
  'solve.reachable': '剛好命中',
  'solve.unreachable': '無法完全命中',
  'solve.apply': '套用到畫布（取代現有層）',
  'solve.exactYes': '這個模型的疊層是精確的凸組合，所以「命不命中」是算出來的，不是試出來的。',
  'solve.exactNo': '⚠️ OKLab 的逐層結果會被夾回 sRGB 色域，所以它的疊層不是精確的凸組合——這裡的解只是很好的近似。',
  'solve.floor': 'ΔE00 {de} 是<strong>這組顏料在這個底色上的極限</strong>，不是還沒調好——再調也不會更近。要更接近就得換／加顏料，或換底色。',

  /* ---- toast（§6 正統表逐字） ---- */
  'toast.copied': '已複製',
  'toast.copiedValue': '已複製：{v}',
  'toast.copyFail': '複製失敗（需 localhost 或 HTTPS）',
  'toast.lang': '已切換為 {name}',
  'toast.reset': '已清除',
  'toast.badHex': '不是有效的顏色：{v}',
  'toast.layerAdded': '已加入：{n}',
  'toast.linkCopied': '已複製分享連結',
  'toast.solveApplied': '已套用配方：{n} 層',
}, '繁體中文');
