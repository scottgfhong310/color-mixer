/* 日本語（ja） */
I18n.register('ja', {
  'title.page': 'color-mixer — 調色パレット',
  'app.title': '調色パレット',
  'app.sub': '基材の地色に顔料を重ねて結果色を求め、Art Color ファミリーから最も近いペンを探します',

  /* ---- キャンバス ---- */
  'canvas.aria': '外側は基材（紙の色）、中央の円は顔料の重ね合わせ領域（結果色）',
  'canvas.substrate': '基材（キャンバスの地色）',
  'canvas.baseHex': '地色を直接指定',
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
  'near.useCalib': '校正値で比較する（記録のある色は実際の塗色値を使用）',
  'near.empty': 'ブランドが選ばれていません——少なくとも 1 つ選んでください。',
  'near.calibrated': '校正',
  'band.very': '極めて近い',
  'band.close': '近い',
  'band.noticeable': '識別可能な差',
  'band.far': '差が大きい',

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

  /* ---- トースト ---- */
  'toast.copied': 'コピーしました',
  'toast.copiedValue': 'コピーしました：{v}',
  'toast.copyFail': 'コピーに失敗（localhost または HTTPS が必要）',
  'toast.lang': '{name} に切り替えました',
  'toast.reset': 'クリアしました',
  'toast.badHex': '有効な色ではありません：{v}',
  'toast.layerAdded': '追加しました：{n}',
  'toast.linkCopied': '共有リンクをコピーしました'
}, '日本語');
