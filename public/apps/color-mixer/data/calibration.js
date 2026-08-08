/* Application calibration — build artefact, do not hand-edit.
 * Exported from the family colour database (db_artcolor), the System of Record.
 * What a row records is NOT "what the ink is". It is "what to put on this screen so that
 *   it looks to me like what I saw" — a visual match, so it depends on the room light, the
 *   display, and the observer. Those three are inside the frame (`context`) and cancel only
 *   when the value is consumed in the same frame. It is an exact record of a subjective
 *   value, not an approximation of an objective one.
 * THERE IS NO UNIQUE ROW per (colour, substrate, layers) — that constraint was dropped in
 *   CHG000050 precisely because no single true value exists. Consumers MUST aggregate and
 *   MUST report the spread; see ColorMixerLib.calibrationSummary().
 * `context: null` means the frame was not recorded. It does NOT mean "same frame as the
 *   others" — repeatability statistics must exclude those rows.
 * `baseKnown: false` means the substrate colour has never been measured. The field is
 *   explicit on purpose: a missing baseHex would silently fall back to white, and a
 *   natural-pulp paper would then render exactly like white A4 with nothing reporting it.
 * Fields: substrates[code, kind, baseKnown, baseHex?, name, nameEn, nameJa];
 *   observations[brand, code, substrate, layers, hexRef?, hex, context?, observedOn?,
 *   sourceType, verify, note?]; contexts[code, name, light?, display?, observer?].
 * `brand` is the APP FOLDER NAME (copic-color), not meta_brand.fd_code (copic).
 */
(function (global) {
  'use strict';

  global.CM_CALIBRATION_META = {"stub":false,"generatedBy":"My Projects/Art Colour/export/a3-export.js","source":"db_artcolor","observations":1,"substratesWithoutBase":["a4-white","xuan-natural"]};

  global.CM_SUBSTRATES = [
    {"code":"a4-white","kind":"paper","baseKnown":false,"name":"白色 A4 影印紙","nameEn":"White A4 copy paper","nameJa":"白色A4コピー用紙"},
    {"code":"xuan-natural","kind":"paper","baseKnown":false,"name":"紙漿原色宣紙","nameEn":"Natural-pulp Xuan paper","nameJa":"生成り宣紙"}
  ];

  global.CM_CALIBRATION = [
    {"brand":"copic-color","code":"B39","substrate":"a4-white","layers":1,"hex":"#171159","sourceType":"measured","verify":"approximate","note":"所有者目視。原話：「白色 A4 紙上，COPIC B39 的顏色在視覺上接近 #171159。」觀測框架（光線／螢幕）與日期均未記錄，故 fd_context_idx 與 fd_observed_on 留 NULL——NULL 不等於「與其他列同框架」，重複性統計要排除本列。 ｜ 同組另有一則更早的目視（另一天）：「接近 #08093D 但較深」。「較深」經所有者裁決為**彩度更高**（不是明度更低）——兩種讀法會把它推向相反的地方，與本列分別是 ΔE00 6.97 與 3.30。取彩度讀法後，兩天的判斷方向一致：本列相對該錨點為 L +6.0、C +12.8、h +3.0°。該則因只有錨點與方向、**沒有量值**，故不另立一列（fd_hex 需要點值，不猜）。"}
  ];

  global.CM_OBSERVE_CONTEXT = [
    {"code":"desk-led-4000k-mbp","name":"書桌 LED 白晝光 ＋ MacBook Pro 內建螢幕","light":"書桌 LED，燈具標示「白晝光」，色溫 4000K","display":"MacBook Pro 內建螢幕","observer":"所有者"}
  ];

})(typeof window !== 'undefined' ? window : globalThis);
