/* 日本語（ja） */
I18n.register('ja', {
  'title.page': 'color-mixer — 調色パレット',
  'app.title': '調色パレット',
  'app.sub': '基材の地色に顔料を重ねて結果色を求め、Art Color ファミリーから最も近いペンを探します',

  /* ---- キャンバス ---- */
  'canvas.aria': '外側は基材（紙の色）、中央の円は顔料の重ね合わせ領域（結果色）',
  'canvas.substrate': '基材（キャンバスの地色）',
  'canvas.baseHex': '地色を直接指定',
  'canvas.observed': '目視色（見えている色）',
  'canvas.observedHint': '実際に見えている色を入力すると、円がその色で描画され、計算値との差も表示されます',
  'canvas.observedBadge': '目視',
  'canvas.computed': '計算値',
  'canvas.custom': 'カスタム…',

  /* ---- 顔料レイヤー ---- */
  'layers.title': '顔料レイヤー',
  'layers.add': 'レイヤーを追加',
  'layers.empty': 'レイヤーがまだありません——「レイヤーを追加」から 5 ブランドのペンを選ぶか、hex を直接入力してください。',
  'layers.custom': '自作の色',
  'layers.unknownBrand': '不明なブランド {b}',
  'layers.up': '上へ',
  'layers.down': '下へ',
  'layers.remove': 'このレイヤーを削除',
  'layers.full': '最大 {n} レイヤーです',

  /* ---- 混色モデル ---- */
  'model.title': '混色モデル',
  'model.groups': '左：光の加算　右：減法（近似）',
  'model.srgb': 'sRGB 合成',
  'model.oklab': 'OKLab 合成',
  'model.glaze': 'グレーズ',
  'model.km': 'パレット混色',
  'model.srgb.note': 'ブラウザが半透明レイヤーを重ねるときの実際の挙動（CSS rgba()／canvas globalAlpha）。「画面上でどう見えるか」を知りたいときはこれ——顔料ではないので、青に黄を重ねても緑ではなく灰緑になります。',
  'model.oklab.note': 'OKLab 空間での補間：明度変化が知覚的に均一で、sRGB 合成のガンマの誤りも直ります。⚠ ただし中間が濁らなくなるわけでは<b>ありません</b>——補色どうしを直線で結ぶと中性軸を通るため、青＋黄の実測では sRGB より<b>灰色</b>です（Lab 彩度 12.2 対 27.9）。依然として光の加算です。',
  'model.glaze.note': '基材の上に透明な墨層を重ねる（Beer-Lambert）。マーカー、透明水彩、写真用染料はこの挙動です——<b>紙の色が透けて見え</b>、層が厚くなるほどその影響は薄れます。本アプリの既定値です。',
  'model.km.note': '2 つの顔料を実際に混ぜ合わせる（単定数 Kubelka-Munk）。このモデルは地色も 1 つの顔料として混ぜるため<b>紙の色は透けません</b>——「同じペンを違う紙に」という問いには答えられません。',
  'model.approx': '⚠ 減法モデルは 1 つの sRGB hex から逆算した<b>近似</b>であり、測定値ではありません：本来の Kubelka-Munk には顔料ごとの吸収・散乱スペクトルの実測が必要ですが、メーカーは公開していません。純粋なデジタル原色（チャンネル値 0 または 255）では特に破綻します。',

  /* ---- 不透明度スライダーの意味（モデルごとに本当に違う） ---- */
  'alpha.srgb': 'スライダー＝<b>被覆率</b>：下の層をどれだけ隠すか。',
  'alpha.oklab': 'スライダー＝<b>被覆率</b>：下の層をどれだけ隠すか。',
  'alpha.glaze': 'スライダー＝<b>墨層の厚み</b>：光が何回通り抜けるか。',
  'alpha.km': 'スライダー＝<b>濃度</b>：混合物に占めるこの顔料の割合。',

  /* ---- 最も近い色 ---- */
  'near.title': 'Art Color ファミリーで最も近い色',
  'near.pool': '{n} 本のペン（{brands} ブランド）と比較中',
  'near.gap': '1 位と 2 位の差は ΔE00 {gap}。',
  'near.gapWide': '差が大きい：小さな誤差には影響されませんが、目視誤差がこれを超えると明らかに違う色のペンに飛びます。',
  'near.gapNarrow': '差が小さい：わずかな誤差で順位は入れ替わりますが、上位はほぼ同じ見た目です——どれを選んでも構いません。',
  'near.repeat': 'このペンの校正値は {n} 回の観測によるもので、同一フレーム内の再現性は ΔE00 {de}（これはあなた自身の精度であり、インクについての主張ではありません）。',
  'near.frameGap': '観測フレーム間の差は ΔE00 {de}——照明やモニタを変えた結果であり、再現性とは別のことです。',
  'near.useCalib': '校正値で比較する（記録のある色は実際の塗色値を使用）',
  'near.empty': 'ブランドが選ばれていません——少なくとも 1 つ選んでください。',
  'near.calibrated': '校正',
  'band.very': 'ごく近い',
  'band.close': '近い',
  'band.noticeable': '差が分かる',
  'band.far': '遠い',

  /* ---- 各ブランドの比較範囲（既定は「全部」ではない） ---- */
  'pool.faber-castell-color': 'Faber-Castell は Art & Graphic のみ、Black Edition（別製品ライン）は含みません',
  'pool.caran-dache-color': 'Caran d’Ache は PSTC を除外（PSTP と同一の公式パレット）',
  'pool.copic-color': 'COPIC はカラーレスブレンダーを除外',
  'pool.finecolour-color': 'Finecolour はマーカーの色番空間のみ、ファインライナーとアクリルは含みません',
  'pool.enmy-color': 'ENMY 全 80 色',

  /* ---- 色選択 ---- */
  'pick.title': 'ペンを選ぶ',
  'pick.placeholder': '色番または色名…',
  'pick.empty': '該当する色がありません',

  /* ---- 詳細 ---- */
  'detail.use': 'レイヤーとして追加',
  'detail.facts': '事実',
  'detail.calib': '応用校正',
  'detail.noCalib': 'このペンの校正記録はまだありません。',
  'detail.catalogHex': 'カタログ値',
  'detail.refHex': '目視の基準点',
  'detail.finalHex': '確定値',
  'detail.substrate': '基材',
  'detail.layers': '層数',
  'detail.approxNote': 'カタログの色見本は画面上の近似値であり、公式仕様ではありません。',

  /* ---- CSS ---- */
  'css.title': 'この調色の CSS',
  'css.note': 'レシピはコメントに書かれています——hex だけでは、それがどう作られたか誰にも分かりません。',
  'css.copy': 'コピー',

  /* ---- 校正 ---- */
  'calib.title': '校正記録',
  'calib.note': '校正データは db_artcolor から書き出されたもので、本アプリは読み取り専用です。3 つの hex はそれぞれ別の問いに答えます：カタログ値 → 確定値＝画面と実際の塗色の差、基準点 → 確定値＝自分の目視の偏り。',
  'calib.stubWarn': '現在読み込まれている校正データはプレースホルダーであり実測値ではありません——これを根拠に色を決めないでください。',
  'calib.empty': '校正記録はまだありません。',
  'calib.count': '{n} 件の記録',

  /* ---- サイドツール ---- */
  'tool.add': '顔料レイヤーを追加',
  'tool.calib': '校正記録',
  'tool.css': 'CSS を表示 / コピー',
  'tool.share': '共有リンクをコピー',
  'tool.reset': 'この調色をクリア',
  'tool.mode': 'ライト / ダーク切替',
  'tool.lang': '言語',
  'tool.more': 'その他のツール',
  'tool.clearFilter': 'クリア',

  'btn.close': '閉じる',

  /* ---- 目視の微調整 ---- */
  'nudge.toggle': '見た目が合うまで調整…',
  'nudge.hide': '調整を隠す',
  'nudge.anchor': 'アンカー（最初に思い浮かんだ近い色）',
  'nudge.dL': '暗 ↔ 明',
  'nudge.dC': '濁 ↔ 鮮',
  'nudge.dh': '色相',
  'nudge.now': '現在 {hex}',
  'nudge.needAnchor': 'まずアンカーを入力してください——最初に近いと感じた色。その後スライダーで「ただし…」の部分を表します。',
  'nudge.neutral': '⚠️ アンカーが無彩色のため色相に意味がありません（そのスライダーは無効）。',
  'nudge.clipped': '⚠️「{axis}」{want} を要求しましたが、この色域では {got} までです——画面にはこれより先を表示できません。',

  /* ---- 逆算（色の分解） ---- */
  'solve.title': '逆算：色をレシピに分解する',
  'solve.ctx': '下地 {base}　モデル {model}',
  'solve.target': '目標色',
  'solve.useDisc': '円の色を使う',
  'solve.clear': 'クリア',
  'solve.palette': 'ベース顔料',
  'solve.pal.rgb': 'RGB 三原色',
  'solve.pal.cmy': 'CMY',
  'solve.pal.cmyk': 'CMYK',
  'solve.pal.layers': 'キャンバス上の顔料層',
  'solve.pal.custom': 'カスタム',
  'solve.customPh': '空白区切り、例：#ff0000 #00ff00 #0000ff',
  'solve.empty': '目標色を入力するか、「円の色を使う」を押してください。',
  'solve.noPalette': 'このパレットは空です——少なくとも 1 色を入力するか、先に顔料層を追加してください。',
  'solve.usingCalib': '（顔料はこの下地の校正値を使用）',
  'solve.wanted': '目標',
  'solve.got': 'この顔料で最も近い色',
  'solve.reachable': '完全一致',
  'solve.unreachable': '完全には一致しない',
  'solve.apply': 'キャンバスに適用（現在の層を置き換え）',
  'solve.exactYes': 'このモデルの重ね合わせは厳密な凸結合なので、「一致するかどうか」は試行ではなく計算で分かります。',
  'solve.exactNo': '⚠️ OKLab は各層の結果を sRGB 色域に丸め戻すため、重ね合わせは厳密な凸結合ではありません——この解は非常に良い近似にとどまります。',
  'solve.floor': 'ΔE00 {de} は<strong>この下地でこの顔料が到達できる限界</strong>であり、調整不足ではありません——これ以上は近づきません。顔料を替える／増やすか、下地を替えてください。',

  /* ---- トースト ---- */
  'toast.copied': 'コピーしました',
  'toast.copiedValue': 'コピーしました：{v}',
  'toast.copyFail': 'コピーに失敗（localhost または HTTPS が必要）',
  'toast.lang': '{name} に切り替えました',
  'toast.reset': 'クリアしました',
  'toast.badHex': '有効な色ではありません：{v}',
  'toast.layerAdded': '追加しました：{n}',
  'toast.linkCopied': '共有リンクをコピーしました',
  'toast.solveApplied': 'レシピを適用しました：{n} 層'
}, '日本語');
