/* English (en) */
I18n.register('en', {
  'title.page': 'color-mixer',
  'app.title': 'Colour mixer',
  'app.sub': 'Layer pigments over a substrate colour, get the resulting colour, and find the closest pen in the Art Color family',

  /* ---- canvas ---- */
  'canvas.aria': 'The field is the substrate (paper colour); the centre disc is the pigment mixing area (result colour)',
  'canvas.substrate': 'Substrate (canvas base)',
  'canvas.baseHex': 'Custom base',
  'canvas.custom': 'Custom…',

  /* ---- layers ---- */
  'layers.title': 'Pigment layers',
  'layers.add': 'Add a layer',
  'layers.empty': 'No layers yet — hit “Add a layer” to pick a pen from the five family brands, or just type a hex.',
  'layers.custom': 'Custom colour',
  'layers.unknownBrand': 'Unknown brand {b}',
  'layers.up': 'Move up',
  'layers.down': 'Move down',
  'layers.remove': 'Remove this layer',
  'layers.full': 'At most {n} layers',

  /* ---- mixing models ---- */
  'model.title': 'Mixing model',
  'model.groups': 'Left: additive　Right: subtractive (approximate)',
  'model.srgb': 'sRGB compositing',
  'model.oklab': 'OKLab compositing',
  'model.glaze': 'Glaze',
  'model.km': 'Palette mix',
  'model.srgb.note': 'What the browser actually does with translucent layers (CSS rgba() / canvas globalAlpha). Use it to answer “how will this look on screen” — it is not paint: blue over yellow gives grey-green, not green.',
  'model.oklab.note': 'Interpolation in OKLab: perceptually even lightness, and it fixes the gamma error in sRGB compositing. ⚠ But it does <b>not</b> keep the midpoint from going grey — a straight line between near-complementary hues passes through the neutral axis, and blue+yellow measures <b>greyer</b> than sRGB (Lab chroma 12.2 vs 27.9). Still additive, not paint.',
  'model.glaze.note': 'A transparent ink layer over a substrate (Beer-Lambert). Markers, transparent watercolour and photographic dyes behave this way — <b>the paper colour shows through</b>, and its influence fades as the layer thickens. This is the default.',
  'model.km.note': 'Two pigments physically mixed together (single-constant Kubelka-Munk). This model treats the base as just another pigment, so <b>the paper colour does not show through</b> — it cannot answer “the same pen on different paper”.',
  'model.approx': '⚠ The subtractive models are <b>approximations</b> inferred from a single sRGB hex, not measurements: real Kubelka-Munk needs each pigment’s measured absorption and scattering spectra, which manufacturers do not publish. Pure digital primaries (channel values of 0 or 255) distort badly here.',

  /* ---- what the alpha slider means (genuinely differs per model) ---- */
  'alpha.srgb': 'Slider = <b>coverage</b>: how much this layer hides what is below.',
  'alpha.oklab': 'Slider = <b>coverage</b>: how much this layer hides what is below.',
  'alpha.glaze': 'Slider = <b>ink thickness</b>: how far light travels through it.',
  'alpha.km': 'Slider = <b>concentration</b>: this pigment’s share of the mixture.',

  /* ---- nearest ---- */
  'near.title': 'Closest colours in the Art Color family',
  'near.pool': 'Comparing against {n} pens ({brands} brands)',
  'near.useCalib': 'Compare using calibrated values (where a real-application record exists)',
  'near.empty': 'No brands selected — pick at least one.',
  'near.calibrated': 'calibrated',
  'band.very': 'very close',
  'band.close': 'close',
  'band.noticeable': 'noticeable',
  'band.far': 'far',

  /* ---- what each brand actually compares (defaults are not “everything”) ---- */
  'pool.faber-castell-color': 'Faber-Castell compares Art & Graphic only, not Black Edition (a separate product line)',
  'pool.caran-dache-color': 'Caran d’Ache excludes PSTC (shares one official palette with PSTP)',
  'pool.copic-color': 'COPIC excludes the colourless blender',
  'pool.finecolour-color': 'Finecolour compares the marker code space only, not fineliners or acrylics',
  'pool.enmy-color': 'ENMY, all 80 colours',

  /* ---- pick ---- */
  'pick.title': 'Pick a pen',
  'pick.placeholder': 'Code or name…',
  'pick.empty': 'No matching colour',

  /* ---- detail ---- */
  'detail.use': 'Add as a layer',
  'detail.facts': 'Facts',
  'detail.calib': 'Application calibration',
  'detail.noCalib': 'No calibration record for this pen yet.',
  'detail.catalogHex': 'Catalogue value',
  'detail.refHex': 'Visual anchor',
  'detail.finalHex': 'Accepted value',
  'detail.substrate': 'Substrate',
  'detail.layers': 'Layers',
  'detail.approxNote': 'Catalogue swatches are on-screen approximations, not official specifications.',

  /* ---- CSS ---- */
  'css.title': 'CSS for this mix',
  'css.note': 'The recipe lives in the comments — a bare hex tells nobody how it got there.',
  'css.copy': 'Copy',

  /* ---- calibration ---- */
  'calib.title': 'Calibration records',
  'calib.note': 'Calibration data is exported from db_artcolor; this app is read-only. The three hexes answer different questions: catalogue → accepted is the screen-vs-paper gap; anchor → accepted is your own visual bias.',
  'calib.stubWarn': 'The calibration data currently loaded is placeholder, not measured — do not make colour decisions from it.',
  'calib.empty': 'No calibration records yet.',
  'calib.count': '{n} record(s)',

  /* ---- side tools ---- */
  'tool.add': 'Add a pigment layer',
  'tool.calib': 'Calibration records',
  'tool.css': 'View / copy CSS',
  'tool.share': 'Copy share link',
  'tool.reset': 'Clear this mix',
  'tool.mode': 'Toggle light / dark',
  'tool.lang': 'Language',
  'tool.more': 'More tools',
  'tool.clearFilter': 'Clear',

  'btn.close': 'Close',

  /* ---- toasts ---- */
  'toast.copied': 'Copied',
  'toast.copiedValue': 'Copied: {v}',
  'toast.copyFail': 'Copy failed (needs localhost or HTTPS)',
  'toast.lang': 'Switched to {name}',
  'toast.reset': 'Cleared',
  'toast.badHex': 'Not a valid colour: {v}',
  'toast.layerAdded': 'Added: {n}',
  'toast.linkCopied': 'Share link copied'
}, 'English');
