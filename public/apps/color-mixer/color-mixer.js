/**
 * color-mixer.js — 頁面控制器（碰 DOM 的那一半）
 *
 * 純運算全在 color-mixer-lib.js；這裡只做 DOM、事件、i18n 重繪、toast。
 *
 * ⚠️ **控制器不保存任何計算結果**：畫面、CSS 匯出、分享連結、最接近色，
 *    四個出口各自由當下的 `state` 重算。代價是幾十次浮點運算，換到的是
 *    「畫面與輸出不一致」這個 bug 類別在結構上不存在（circle-text 的教訓，
 *    家族 CLAUDE.md v1.17）。**不要為了「省一點」把 compose 的結果存起來。**
 *
 * ⚠️ **五個品牌的比對規矩不在這裡**：各品牌 lib 的 nearestXxx 自己知道要排除
 *    什麼、預設比哪個範圍。這裡只負責「呼叫它們」與「把結果合併」（後者在 lib）。
 *    在這裡加一行 filter 就是「同一條規則的第二份實作」（v1.16）。
 */
(function (window, $) {
  'use strict';

  var Lib = window.ColorMixerLib;
  var LS_THEME = 'color-mixer-theme';
  var NEAR_N = 18;

  // ---- 品牌登記：一支 app 要同時用五個家族 registry，接點集中在這張表 ------

  var BRANDS = [
    {
      id: 'faber-castell-color', label: 'Faber-Castell', short: 'FC',
      colors: function () { return window.FC_COLORS || []; },
      near: function (rgb, n, colors) {
        return window.FaberCastellCssLib.nearestFC(rgb, { n: n, colors: colors });
      },
      cssVar: function (c) { return c.cssVar || ('--fc-' + c.code); },
      name: function (c) { return c.name || ''; }
    },
    {
      id: 'caran-dache-color', label: 'Caran d’Ache', short: 'CDA',
      colors: function () { return window.CDA_COLORS || []; },
      // ⚠️ CDA 的身分是 (系列, 色碼)：同色碼跨系列是不同顏色（治理 §3.1）。
      //    nearestCDA 的結果與 CDA_COLORS 的元素都帶 seriesId，故兩邊共用這支。
      key: function (c) { return (c.seriesId || '?') + '-' + c.code; },
      badge: function (c) { return c.seriesId || ''; },
      near: function (rgb, n, colors) {
        return window.CaranDacheColorLib.nearestCDA(rgb, { n: n, colors: colors });
      },
      cssVar: function (c) { return c.cssVar || ''; },
      name: function (c) { return c.name || ''; }
    },
    {
      id: 'copic-color', label: 'COPIC', short: 'COPIC',
      colors: function () { return window.COPIC_COLORS || []; },
      near: function (rgb, n, colors) {
        return window.CopicColorLib.nearestCOPIC(rgb, { n: n, colors: colors });
      },
      cssVar: function (c) { return c.cssVar || ''; },
      name: function (c) { return c.name || ''; }
    },
    {
      id: 'finecolour-color', label: 'Finecolour', short: 'FCL',
      colors: function () { return window.FINECOLOUR_COLORS || []; },
      near: function (rgb, n, colors) {
        return window.FinecolourColorLib.nearestFinecolour(rgb, { n: n, colors: colors });
      },
      cssVar: function (c) { return c.cssVar || ''; },
      // ⚠️ 不可直接讀 .name——Finecolour 的官方色名語言隨色號空間而變
      // （麥克筆是英文的、彩針筆是中文的），一律走 officialName()。
      name: function (c) { return window.FinecolourColorLib.officialName(c); }
    },
    {
      id: 'enmy-color', label: 'ENMY', short: 'ENMY',
      colors: function () { return window.ENMY_COLORS || []; },
      near: function (rgb, n, colors) {
        return window.EnmyColorLib.nearestENMY(rgb, { n: n, colors: colors });
      },
      cssVar: function (c) { return c.cssVar || ''; },
      // ENMY 原廠不發佈色名，displayName 恆回非空（多半就是色號本身）。
      name: function (c) { return window.EnmyColorLib.displayName(c, lang()); }
    }
  ];
  /**
   * ⚠️ **色碼不是所有品牌的唯一識別。** Caran d'Ache 的身分是 (seriesId, code)——
   * 同色碼跨系列是**不同的顏色**（db_artcolor 治理 §3.1），實查 `120` 在 CDA_COLORS
   * 裡有 **9 列**。只用 code 當鍵會讓「點卡片開明細」開到另一個顏色，而畫面不會報錯：
   * 實測點 NEO-120（#2d1955 深紫）開出來的是 LUM-120（#815ea0 淺紫）。
   * 各品牌預設以 code 為鍵；CDA 在自己的登記裡覆寫 key／badge。
   */
  function defaultKey(c) { return String(c.code); }
  function noBadge() { return ''; }
  BRANDS.forEach(function (b) {
    if (!b.key) b.key = defaultKey;
    if (!b.badge) b.badge = noBadge;
  });

  function brandOf(id) {
    for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i].id === id) return BRANDS[i];
    return null;
  }

  // ---- state（唯一真相；不含任何算出來的東西） ---------------------------

  var state = {
    model: Lib.DEFAULT_MODEL,
    substrate: null,
    stack: { base: '#ffffff', layers: [] },
    brands: BRANDS.map(function (b) { return b.id; }),   // 篩選 chips：預設全開
    useCalib: false,
    pickBrand: 'copic-color'
  };
  var poolSize = {};        // 各品牌實際的比對池大小（由該品牌自己的 nearest 算出）
  var detailCtx = null;     // 明細 Modal 現在開的是哪一筆

  // ---- 小工具 -----------------------------------------------------------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c];
    });
  }
  function lang() { return window.I18n ? window.I18n.lang : 'zh-Hant'; }
  function t(key, params) {
    if (!window.I18n) return key;
    return window.I18n.t(key, params);
  }
  function toast(msg, cls) { window.M.toast({ html: msg, classes: cls || 'teal' }); }

  /** 每個出口都自己算一次——見檔頭。 */
  function result() { return Lib.compose(state.stack, state.model); }

  // ---- 網址列＝存檔 -----------------------------------------------------

  function pushUrl() {
    var qs = Lib.encodeState({ model: state.model, substrate: state.substrate, stack: state.stack });
    try { history.replaceState(null, '', '?' + qs); } catch (e) { /* file:// 下會丟，忽略 */ }
  }
  function readUrl() {
    var s = Lib.decodeState(window.location.search);
    if (!s) return false;
    state.model = s.model;
    state.substrate = s.substrate;
    state.stack = s.stack;
    return true;
  }

  // ---- 渲染：畫布 -------------------------------------------------------

  function renderCanvas() {
    var r = result();

    // 畫布＝基材（紙色），中央的圓＝疊加結果。**兩個不同的顏色，別接錯。**
    $('#canvas').css({ background: state.stack.base });
    $('#mix-disc').css({
      background: r.hex,
      color: Lib.pickTextColor(r),     // 讀數在圓內，所以對比要算在「結果色」上
      // ⚠️ 沒有顏料層時 r.hex === base，圓與紙同色會整個消失。加一圈極淡的環，
      //    環色由**紙色**決定（不是結果色）——它畫在兩者交界上，貼著紙那一側。
      boxShadow: '0 0 0 1px ' + (Lib.pickTextColor(Lib.hexToRgb(state.stack.base)) === '#ffffff'
        ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)')
    });

    $('#result-hex').text(r.hex);
    $('#result-rgb').text(Lib.formatRgb(r));
    $('#base-hex').val(state.stack.base);
    renderCopyRow(r);
  }

  // §11.1：順序固定 var → hex → rgb → class
  function renderCopyRow(r) {
    var items = [
      ['var', 'var(--mix-result)'],
      ['hex', r.hex],
      ['rgb', Lib.formatRgb(r)],
      ['class', '.mix-result']
    ];
    $('#copy-row').html(items.map(function (it) {
      return '<button class="copy-btn" type="button" data-copy="' + esc(it[1]) + '">'
        + '<i class="material-icons">content_copy</i>' + esc(it[1]) + '</button>';
    }).join(''));
  }

  // ---- 渲染：顏料層 -----------------------------------------------------

  function renderLayers() {
    var ls = state.stack.layers;
    $('#layers-empty').toggle(ls.length === 0);
    $('#layers').html(ls.map(function (ly, i) {
      // ⚠️ 網址是**刻意設計成手改得動**的（沒有 base64），所以 brand 打錯必然會發生。
      //    認不出來時要明講「未知品牌」，**不可以把原字串當成品牌名印出來**——
      //    `copic` 打成這樣會顯示「copic B39」，看起來與正確的「COPIC B39」一樣是對的。
      //    canon 的品牌鍵＝資料夾名（`copic-color`），與 data-brand／i18n key 全部同名。
      var b = ly.src ? brandOf(ly.src.brand) : null;
      var title = !ly.src ? esc(t('layers.custom'))
        : b ? esc(b.label + ' ' + ly.src.code)
            : esc(t('layers.unknownBrand', { b: ly.src.brand }) + ' ' + ly.src.code);
      var sub = esc(ly.hex);
      return ''
        + '<div class="layer" data-i="' + i + '">'
        + '  <div class="layer-chip" style="background:' + esc(ly.hex) + '"></div>'
        + '  <div class="layer-main">'
        + '    <div class="layer-title">' + title + '</div>'
        + '    <div class="layer-sub">' + sub + '</div>'
        + '    <div class="layer-alpha">'
        + '      <input type="range" class="browser-default" min="0" max="100" step="1"'
        + '             value="' + Math.round(ly.alpha * 100) + '" data-i="' + i + '" />'
        + '      <span class="pct">' + Math.round(ly.alpha * 100) + '%</span>'
        + '    </div>'
        + '  </div>'
        + '  <div class="layer-act">'
        + '    <button class="up" type="button" data-i="' + i + '" title="' + esc(t('layers.up')) + '">'
        + '<i class="material-icons">arrow_upward</i></button>'
        + '    <button class="down" type="button" data-i="' + i + '" title="' + esc(t('layers.down')) + '">'
        + '<i class="material-icons">arrow_downward</i></button>'
        + '    <button class="del" type="button" data-i="' + i + '" title="' + esc(t('layers.remove')) + '">'
        + '<i class="material-icons">close</i></button>'
        + '  </div>'
        + '</div>';
    }).join(''));
  }
  function brandLabel(id) { var b = brandOf(id); return b ? b.label : id; }

  // ---- 渲染：模型 chips ＋ 說明 -----------------------------------------

  function renderModels() {
    // 分組 chips：單選互斥、恆有一個 active、**無勾號**（§5.13）。
    // 中間插一條分隔，把「光的疊加」與「減色」在視覺上分開——那是這四個
    // 模型真正的分界，不分開的話使用者只看到四顆長得一樣的鍵。
    var html = '';
    Lib.MODELS.forEach(function (m, i) {
      if (i === Lib.ADDITIVE.length) html += '<span class="chip-sep"></span>';
      html += '<button type="button" class="group-chip' + (state.model === m ? ' active' : '')
        + '" data-model="' + m + '" role="radio" aria-checked="' + (state.model === m) + '">'
        + esc(t('model.' + m)) + '</button>';
    });
    $('#model-chips').html(html);

    var note = t('model.' + state.model + '.note');
    if (Lib.SUBTRACTIVE.indexOf(state.model) >= 0) {
      note += ' <span class="warn">' + t('model.approx') + '</span>';
    }
    $('#model-note').html(note);
    $('#alpha-note').html(t('alpha.' + state.model));
  }

  // ---- 渲染：最接近色 ---------------------------------------------------

  function nearestLists() {
    var r = result();
    var rgb = { r: r.r, g: r.g, b: r.b };
    return BRANDS.filter(function (b) { return state.brands.indexOf(b.id) >= 0; })
      .map(function (b) {
        var colors = state.useCalib && state.substrate
          ? Lib.calibratedColors(b.colors(), b.id, state.substrate)
          : undefined;                       // undefined ＝ 用該 lib 自己的預設清單
        return { brand: b.id, items: b.near(rgb, NEAR_N, colors) };
      });
  }

  function renderNear() {
    var chosen = BRANDS.filter(function (b) { return state.brands.indexOf(b.id) >= 0; });
    $('#near-empty').toggle(chosen.length === 0);
    if (!chosen.length) { $('#near-list').empty(); $('#near-pool').text(''); return; }

    var merged = Lib.mergeNearest(nearestLists(), NEAR_N);
    var total = chosen.reduce(function (s, b) { return s + (poolSize[b.id] || 0); }, 0);
    $('#near-pool').text(t('near.pool', { n: total, brands: chosen.length }));

    $('#near-list').html(merged.map(function (it) {
      var rgb = Lib.hexToRgb(it.hex);
      var fg = Lib.pickTextColor(rgb);
      var nm = it.name || it.nameZh || it.code;
      // ⚠️ **不可以看 it.calibrated**：那個旗標是 calibratedColors() 掛在色物件上的，
      //    而各品牌的 nearestXxx 會把結果**投影**成自己那組固定欄位再回傳，自訂欄位
      //    一律被丟掉。實測結果是色片用了校準值、徽章卻不亮，而且不會報錯。
      var cal = state.useCalib && Lib.hasCalibration(it.brand, it.code, state.substrate);
      var bd = brandOf(it.brand);
      var bdg = bd.badge(it);      // CDA 攤平後不標系列就分不出誰是誰
      return ''
        + '<div class="near-card" data-brand="' + esc(it.brand) + '" data-key="' + esc(bd.key(it)) + '">'
        + '  <div class="near-sw" style="background:' + esc(it.hex) + ';color:' + fg + '">'
        + '    <span class="code">' + esc(it.code) + '</span>'
        + (bdg ? '<span class="cal">' + esc(bdg) + '</span>' : '')
        + (cal ? '<span class="cal">' + esc(t('near.calibrated')) + '</span>' : '')
        + '  </div>'
        + '  <div class="near-meta">'
        + '    <div class="near-brand">' + esc(brandOf(it.brand).short) + '</div>'
        + '    <div class="near-name" title="' + esc(nm) + '">' + esc(nm) + '</div>'
        + '    <div class="near-de">ΔE ' + it.deltaE.toFixed(2)
        + ' <span class="band-' + it.band + '">' + esc(t('band.' + it.band)) + '</span></div>'
        + '  </div>'
        + '</div>';
    }).join(''));
  }

  function renderBrandChips() {
    // 篩選 chips：多選、**有勾號**、可全部取消（§5.13）
    $('#brand-chips').html(BRANDS.map(function (b) {
      var on = state.brands.indexOf(b.id) >= 0;
      return '<button type="button" class="type-chip' + (on ? ' active' : '') + '"'
        + ' data-brand="' + b.id + '" aria-pressed="' + on + '"'
        + ' title="' + esc(t('pool.' + b.id)) + '">'
        + esc(b.label) + '</button>';
    }).join(''));
  }

  // ---- 渲染：基材 -------------------------------------------------------

  function substrates() { return window.CM_SUBSTRATES || []; }
  function substrateName(s) {
    var lg = lang();
    return (lg === 'ja' ? s.nameJa : lg === 'en' ? s.nameEn : s.name) || s.code;
  }
  function renderSubstrates() {
    var opts = ['<option value="">' + esc(t('canvas.custom')) + '</option>'];
    substrates().forEach(function (s) {
      opts.push('<option value="' + esc(s.code) + '"' + (state.substrate === s.code ? ' selected' : '')
        + '>' + esc(substrateName(s)) + '</option>');
    });
    var el = document.getElementById('substrate');
    el.innerHTML = opts.join('');
    var inst = window.M.FormSelect.getInstance(el);
    if (inst) inst.destroy();
    window.M.FormSelect.init(el);   // §5.11：每次重建 options 後重新 init
  }

  // ---- 全頁重繪 ---------------------------------------------------------

  function renderAll() {
    renderCanvas();
    renderLayers();
    renderModels();
    renderBrandChips();
    renderNear();
    pushUrl();
  }

  // ---- 挑色 Modal -------------------------------------------------------

  function renderPickBrands() {
    $('#pick-brands').html(BRANDS.map(function (b) {
      return '<button type="button" class="group-chip' + (state.pickBrand === b.id ? ' active' : '')
        + '" data-pb="' + b.id + '" role="radio" aria-checked="' + (state.pickBrand === b.id) + '">'
        + esc(b.label) + '</button>';
    }).join(''));
  }
  function renderPickGrid() {
    var b = brandOf(state.pickBrand);
    var q = String($('#pick-search').val() || '').trim().toLowerCase();
    var list = b.colors().filter(function (c) {
      if (!q) return true;
      return String(c.code).toLowerCase().indexOf(q) >= 0
        || String(b.name(c)).toLowerCase().indexOf(q) >= 0
        || String(c.nameZh || '').toLowerCase().indexOf(q) >= 0
        || String(c.nameJa || '').toLowerCase().indexOf(q) >= 0
        || String(c.hex || '').toLowerCase().indexOf(q) >= 0;
    });
    $('#pick-empty').toggle(list.length === 0);
    // 表頭脈絡：現在在看哪個品牌、篩出幾色（同 chat-archive 的 #prompt-path）。
    // 印**篩選後**的數字而不是品牌總色數——使用者數得出來，對不上就是騙人。
    $('#pick-path').text(b.label + ' · ' + list.length + (q ? ' / ' + b.colors().length : ''));
    // 上限只為了不讓 800+ 色片一次進 DOM；有搜尋框可以縮小範圍。
    $('#pick-grid').html(list.slice(0, 400).map(function (c) {
      var fg = Lib.pickTextColor({ r: c.r, g: c.g, b: c.b });
      return '<div class="pick-sw" style="background:' + esc(c.hex) + ';color:' + fg + '"'
        + ' data-key="' + esc(b.key(c)) + '" title="' + esc(b.key(c) + '  ' + b.name(c)) + '">'
        + '<span>' + esc(c.code) + '</span></div>';
    }).join(''));
  }
  function pickNav() { return window.M.Sidenav.getInstance(document.getElementById('pick-nav')); }

  /** 側鍵與「加一層」都走這裡：已開就收起（同 chat-archive 的 #setting-prompts）。 */
  function togglePick() {
    renderPickBrands();
    renderPickGrid();
    var inst = pickNav();
    if (inst) { inst.isOpen ? inst.close() : inst.open(); }
  }

  /** 以**品牌自己的識別**找色（CDA 是 seriesId-code，其餘是 code）。 */
  function findColor(brandId, key) {
    var b = brandOf(brandId);
    if (!b) return null;
    var list = b.colors();
    for (var i = 0; i < list.length; i++) if (b.key(list[i]) === String(key)) return list[i];
    return null;
  }

  function addLayer(brandId, key) {
    if (state.stack.layers.length >= Lib.MAX_LAYERS) {
      return toast(t('layers.full', { n: Lib.MAX_LAYERS }), 'orange');
    }
    var c = findColor(brandId, key);
    if (!c) return;
    // src.code 存的是**品牌自己的識別**（CDA 是 seriesId-code），網址帶得走、找得回來
    state.stack = Lib.normalizeStack({
      base: state.stack.base,
      layers: state.stack.layers.concat([{ hex: c.hex, alpha: 0.6, src: { brand: brandId, code: key } }])
    });
    renderAll();
    toast(t('toast.layerAdded', { n: brandOf(brandId).label + ' ' + key }), 'green');
  }

  // ---- 明細 Modal（§11.1 骨架） -----------------------------------------

  function openDetail(brandId, key) {
    var b = brandOf(brandId);
    var c = findColor(brandId, key);
    if (!b || !c) return;
    detailCtx = { brand: brandId, code: key };
    renderDetail();
    window.M.Modal.getInstance(document.getElementById('detail-modal')).open();
  }

  function renderDetail() {
    if (!detailCtx) return;
    var b = brandOf(detailCtx.brand);
    var c = findColor(detailCtx.brand, detailCtx.code);
    if (!b || !c) return;
    var rgb = { r: c.r, g: c.g, b: c.b };
    var fg = Lib.pickTextColor(rgb);

    $('#d-head').css({ background: c.hex, color: fg });
    $('#d-code').text(c.code);
    $('#d-tag').text(b.label);
    $('#d-name').text(b.name(c) || '');
    $('#d-note').text(t('detail.approxNote'));

    var cssVar = b.cssVar(c);
    var items = [];
    if (cssVar) items.push('var(' + cssVar + ')');
    items.push(c.hex, Lib.formatRgb(rgb));
    if (cssVar) items.push('.' + cssVar.replace(/^--/, '') + '-bg');
    $('#d-copy').html(items.map(function (v) {
      return '<button class="copy-btn" type="button" data-copy="' + esc(v) + '">'
        + '<i class="material-icons">content_copy</i>' + esc(v) + '</button>';
    }).join(''));

    // ── 段落一：與目前調色結果的距離
    var r = result();
    var d = Lib.deltaE(Lib.rgbToLab(r.r, r.g, r.b), Lib.rgbToLab(c.r, c.g, c.b));
    var sec = '<div class="d-section"><h6>' + esc(t('detail.facts')) + '</h6>'
      + '<table class="facts-table"><tbody>'
      + '<tr><td class="fk">ΔE00</td><td class="fv">' + d.toFixed(2)
      + '（' + esc(t('band.' + Lib.deltaEBand(d))) + '）</td></tr>'
      + '<tr><td class="fk">' + esc(t('detail.catalogHex')) + '</td><td class="fv">' + esc(c.hex) + '</td></tr>'
      + '</tbody></table></div>';

    // ── 段落二：應用校準
    // §11.1：「沒有這項資料」要寫出來，不要留白——留白會被讀成「抽取漏了」。
    var obs = Lib.calibrationFor(detailCtx.brand, detailCtx.code);
    sec += '<div class="d-section"><h6>' + esc(t('detail.calib')) + '</h6>';
    if (!obs.length) {
      sec += '<div class="d-empty">' + esc(t('detail.noCalib')) + '</div>';
    } else {
      sec += '<table class="facts-table"><tbody>' + obs.map(function (o) {
        var s = Lib.substrateOf(o.substrate);
        return '<tr><td class="fk">' + esc(s ? substrateName(s) : o.substrate)
          + ' × ' + esc(o.layers || 1) + '</td><td class="fv">'
          + esc(o.hexRef || '—') + ' → <b>' + esc(o.hex) + '</b></td></tr>'
          + (o.note ? '<tr><td class="fk"></td><td class="fv" style="opacity:.7">' + esc(o.note) + '</td></tr>' : '');
      }).join('') + '</tbody></table>';
    }
    sec += '</div>';
    $('#d-sections').html(sec);
  }

  // ---- 校準 Modal -------------------------------------------------------

  function openCalib() {
    var all = window.CM_CALIBRATION || [];
    var html;
    if (!all.length) {
      html = '<div class="d-empty">' + esc(t('calib.empty')) + '</div>';
    } else {
      html = '<p class="d-note">' + esc(t('calib.count', { n: all.length })) + '</p>'
        + '<table class="facts-table"><tbody>' + all.map(function (o) {
          var s = Lib.substrateOf(o.substrate);
          var b = brandOf(o.brand);
          return '<tr><td class="fk">' + esc((b ? b.short : o.brand) + ' ' + o.code)
            + ' · ' + esc(s ? substrateName(s) : o.substrate) + ' × ' + esc(o.layers || 1)
            + '</td><td class="fv">' + esc(o.hexRef || '—') + ' → <b>' + esc(o.hex) + '</b>'
            + (o.note ? '<div style="opacity:.7">' + esc(o.note) + '</div>' : '')
            + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    $('#calib-body').html(html);
    window.M.Modal.getInstance(document.getElementById('calib-modal')).open();
  }

  // ---- 複製 -------------------------------------------------------------

  function copyText(text, $btn) {
    function done() {
      if ($btn) { $btn.addClass('copied'); setTimeout(function () { $btn.removeClass('copied'); }, 1200); }
      toast(t('toast.copiedValue', { v: text }), 'teal');
    }
    // §11.1：非 HTTPS／非 localhost 沒有 navigator.clipboard，要有退路；
    // rejection（例如沒有使用者手勢）走 .catch 出紅色 toast，不要靜默失敗。
    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(text).then(done, function () {
        if (!legacyCopy(text)) toast(t('toast.copyFail'), 'red'); else done();
      });
    } else if (legacyCopy(text)) { done(); } else { toast(t('toast.copyFail'), 'red'); }
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  // ---- 主題 -------------------------------------------------------------

  function applyTheme(theme) {
    var r = document.documentElement;
    r.setAttribute('data-theme', theme);
    r.classList.toggle('dark-mode', theme === 'dark');
    r.classList.toggle('light-mode', theme === 'light');   // §5.1 的 bonji 坑
    try { localStorage.setItem(LS_THEME, theme); } catch (e) { }
    $('#setting-mode i').text(theme === 'dark' ? 'dark_mode' : 'light_mode');
  }

  // ---- 事件 -------------------------------------------------------------

  function bindEvents() {
    // 模型（分組 chips，單選）
    $('#model-chips').on('click', '.group-chip', function () {
      state.model = $(this).data('model');
      renderAll();
    });

    // 品牌篩選（多選 toggle）
    $('#brand-chips').on('click', '.type-chip', function () {
      var id = $(this).data('brand');
      var i = state.brands.indexOf(id);
      if (i >= 0) state.brands.splice(i, 1); else state.brands.push(id);
      renderBrandChips();
      renderNear();
    });
    $('#brand-clear').on('click', function () {
      state.brands = [];
      renderBrandChips();
      renderNear();
    });

    $('#use-calib').on('change', function () {
      state.useCalib = this.checked;
      renderNear();
    });

    // 基材
    $('#substrate').on('change', function () {
      var code = this.value || null;
      state.substrate = code;
      var s = code ? Lib.substrateOf(code) : null;
      if (s) state.stack = Lib.normalizeStack({ base: s.baseHex, layers: state.stack.layers });
      renderAll();
    });

    // 自訂底色
    $('#base-hex').on('change', function () {
      var v = String(this.value || '').trim();
      if (!Lib.isHex(v)) { toast(t('toast.badHex', { v: v }), 'red'); $('#base-hex').val(state.stack.base); return; }
      state.stack = Lib.normalizeStack({ base: v, layers: state.stack.layers });
      state.substrate = null;      // 手動改底色＝不再宣稱是某個基材
      renderSubstrates();
      renderAll();
    });

    // 顏料層
    $('#add-layer, #setting-add').on('click', togglePick);
    $('#layers')
      .on('input', 'input[type=range]', function () {
        var i = +$(this).data('i');
        state.stack.layers[i].alpha = (+this.value) / 100;
        $(this).closest('.layer-alpha').find('.pct').text(this.value + '%');
        renderCanvas();
        renderNear();
      })
      .on('click', '.del', function () {
        state.stack.layers.splice(+$(this).data('i'), 1);
        renderAll();
      })
      .on('click', '.up', function () {
        var i = +$(this).data('i'), ls = state.stack.layers;
        if (i >= ls.length - 1) return;
        ls.splice(i + 1, 0, ls.splice(i, 1)[0]);
        renderAll();
      })
      .on('click', '.down', function () {
        var i = +$(this).data('i'), ls = state.stack.layers;
        if (i <= 0) return;
        ls.splice(i - 1, 0, ls.splice(i, 1)[0]);
        renderAll();
      });

    // 挑色 Modal
    $('#pick-brands').on('click', '.group-chip', function () {
      state.pickBrand = $(this).data('pb');
      renderPickBrands();
      renderPickGrid();
    });
    $('#pick-search').on('input', renderPickGrid);
    $('#pick-grid').on('click', '.pick-sw', function () {
      // ⚠️ **刻意不關面板**：這正是它從 Modal 改成側欄的理由——挑一支、看畫布怎麼變、
      //    再挑下一支是一個連續動作。關掉面板等於把「回去再挑」變回一個需要存在的動作。
      addLayer(state.pickBrand, $(this).data('key'));
    });

    // 最接近色 → 明細
    $('#near-list').on('click', '.near-card', function () {
      openDetail($(this).data('brand'), $(this).data('key'));
    });
    $('#d-use').on('click', function () {
      if (detailCtx) addLayer(detailCtx.brand, detailCtx.code);
      window.M.Modal.getInstance(document.getElementById('detail-modal')).close();
    });

    // 複製鈕（事件委派：內容會重繪）
    $(document).on('click', '.copy-btn', function () {
      copyText($(this).data('copy'), $(this));
    });

    // 側鍵
    $('#setting-css').on('click', function () {
      $('#css-out').text(Lib.buildCss(state.stack, state.model, result()));
      window.M.Modal.getInstance(document.getElementById('css-modal')).open();
      window.SideTool.setIconDone(this);
    });
    $('#css-copy').on('click', function () {
      copyText(Lib.buildCss(state.stack, state.model, result()));
    });
    $('#setting-calib').on('click', function () {
      openCalib();
      window.SideTool.setIconDone(this);
    });
    $('#setting-share').on('click', function () {
      var url = window.location.origin + window.location.pathname + '?'
        + Lib.encodeState({ model: state.model, substrate: state.substrate, stack: state.stack });
      copyText(url, null);
      window.SideTool.setIconDone(this);
    });
    $('#setting-reset').on('click', function () {
      state.stack = Lib.normalizeStack({ base: state.stack.base, layers: [] });
      renderAll();
      toast(t('toast.reset'), 'grey');
      window.SideTool.setIconDone(this);
    });
    // #setting-mode 的 icon 是狀態指示，**不套** setIconDone 的 check 動畫（§5.5）
    $('#setting-mode').on('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    $('#setting-lang').on('click', function () {
      var next = window.I18n.cycle();
      toast(t('toast.lang', { name: window.I18n.name(next) }), 'teal');
    });

    // 切語言：資料的名字不翻譯，但小標、註記、模型說明都要跟著換（§11.1 末條）
    document.addEventListener('i18n:changed', function () {
      renderSubstrates();
      renderAll();
      renderPickBrands();
      if (detailCtx) renderDetail();
    });
  }

  // ---- 初始化 -----------------------------------------------------------

  function measurePools() {
    // 「現在比的是幾支筆」要問各品牌自己（它們知道自己排除了什麼），
    // 不要在這裡重數一遍——那就是規則的第二份實作。
    var probe = { r: 128, g: 128, b: 128 };
    BRANDS.forEach(function (b) {
      try { poolSize[b.id] = b.near(probe, 1e6).length; }
      catch (e) { poolSize[b.id] = 0; }
    });
  }

  function init() {
    window.M.Modal.init(document.querySelectorAll('.modal'), { preventScrolling: false });
    // 挑色面板走右側滑出 sidenav（形制同 chat-archive 的 Prompt 清單）。
    // onOpenStart/onCloseEnd 掛 body.sidenav-open —— 共用 side-tool.css 靠它把整排側鍵淡出。
    window.M.Sidenav.init(document.getElementById('pick-nav'), {
      edge: 'right',
      onOpenStart: function () { document.body.classList.add('sidenav-open'); },
      onCloseEnd: function () { document.body.classList.remove('sidenav-open'); }
    });

    applyTheme(localStorage.getItem(LS_THEME) || 'dark');

    // 佔位校準資料要在畫面上自己承認（verify F3 擋著這條）
    var meta = window.CM_CALIBRATION_META || {};
    $('#calib-stub').toggle(meta.stub === true);

    if (!readUrl()) {
      var s = substrates()[0];
      if (s) { state.substrate = s.code; state.stack.base = s.baseHex; }
    }

    measurePools();
    renderSubstrates();
    bindEvents();
    renderAll();
    // 共用引擎的 API 是 register / t / apply / set / cycle（＋ lang / langs / name）——
    // **沒有 init()**，初始語系由 lang getter 內部的 ensureInit 解析。
    if (window.I18n) window.I18n.apply(document);
  }

  $(init);

})(window, window.jQuery);
