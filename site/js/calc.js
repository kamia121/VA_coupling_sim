// Bedside calculators on the echo and PA-catheter pages. Arithmetic only, no model.
const $ = (id) => document.getElementById(id);

function bind(ids, units, digits, update) {
  const read = () => Object.fromEntries(ids.map((id) => [id, parseFloat($(id).value)]));
  const paint = () => {
    const v = read();
    ids.forEach((id, i) => {
      const txt = `${v[id].toFixed(digits[i])} ${units[i]}`;
      document.querySelector(`[data-for="${id}"]`).textContent = txt;
      $(id).setAttribute('aria-valuetext', txt);
    });
    update(v);
  };
  ids.forEach((id) => $(id).addEventListener('input', paint));
  paint();
}

const row = (k, v, note = '', flag = false) =>
  `<tr class="${flag ? 'flag' : ''}"><td>${k}</td><td class="num cur">${v}</td><td class="status">${note}</td></tr>`;
const table = (rows) => `<table class="data metrics"><tbody>${rows.join('')}</tbody></table>`;

export function initEchoCalcs() {
  bind(['lv-sbp', 'lv-d', 'lv-vti', 'lv-ef', 'lv-hr'], ['mmHg', 'mm', 'cm', '%', '/min'], [0, 1, 1, 0, 0], (v) => {
    const csa = Math.PI * Math.pow(v['lv-d'] / 20, 2);          // cm²
    const sv = csa * v['lv-vti'];                               // mL
    const ea = 0.9 * v['lv-sbp'] / sv;
    const ef = v['lv-ef'] / 100;
    const ratio = (1 - ef) / ef;
    const ees = ea / ratio;
    $('lv-out').innerHTML = table([
      row('LVOT area', `${csa.toFixed(2)} cm²`, 'π(D/2)²'),
      row('Stroke volume', `${sv.toFixed(0)} mL`, 'area × VTI', sv < 50),
      row('Cardiac output', `${(sv * v['lv-hr'] / 1000).toFixed(1)} L/min`),
      row('Ea ≈ 0.9·SBP/SV', `${ea.toFixed(2)} mmHg/mL`),
      row('Ea/Ees ≈ (1 − EF)/EF', `${ratio.toFixed(2)}`, 'assumes V₀ ≈ 0', ratio > 1.3),
      row('Implied Ees', `${ees.toFixed(2)} mmHg/mL`, 'Ea ÷ ratio; same assumption'),
    ]) + '<p class="status">Ees here is implied by the EF-based ratio, not measured. It overestimates Ees when V₀ is large (dilated ventricle).</p>';
  });

  bind(['rv-tapse', 'rv-trv', 'rv-rap'], ['mm', 'm/s', 'mmHg'], [1, 2, 0], (v) => {
    const pasp = 4 * v['rv-trv'] ** 2 + v['rv-rap'];
    const r = v['rv-tapse'] / pasp;
    let band = r > 0.32 ? 'above 0.32 (lower-risk tertile)' : r >= 0.19 ? '0.19–0.32 (intermediate tertile)' : 'below 0.19 (higher-risk tertile)';
    $('rv-out').innerHTML = table([
      row('PASP = 4v² + RAP', `${pasp.toFixed(0)} mmHg`),
      row('TAPSE/PASP', `${r.toFixed(2)} mm/mmHg`, band, r < 0.19),
      row('Below 0.31?', r < 0.31 ? 'yes' : 'no', 'Tello 2019: predicted Ees/Ea < 0.805 in PAH', r < 0.31),
      row('Below 0.36?', r < 0.36 ? 'yes' : 'no', 'Guazzi 2013: higher risk in heart failure', r < 0.36),
    ]) + '<p class="status">The thresholds come from different populations (PAH vs heart failure) and are not interchangeable.</p>';
  });
}

export function initPacCalc() {
  bind(['p-rap', 'p-pasp', 'p-padp', 'p-pawp', 'p-co', 'p-hr', 'p-mpap'], ['mmHg', 'mmHg', 'mmHg', 'mmHg', 'L/min', '/min', 'mmHg'], [0, 0, 0, 0, 1, 0, 0], (v) => {
    const pp = v['p-pasp'] - v['p-padp'];
    const mpap = v['p-mpap'] > 0 ? v['p-mpap'] : v['p-padp'] + pp / 3;
    const sv = v['p-co'] * 1000 / v['p-hr'];
    const tpg = mpap - v['p-pawp'];
    const dpg = v['p-padp'] - v['p-pawp'];
    const pvr = tpg / v['p-co'];
    const pac = pp > 0 ? sv / pp : NaN;
    const rc = pvr * 0.06 * pac;
    const papi = pp / Math.max(v['p-rap'], 1);
    const ea = mpap / sv;
    let cls;
    if (mpap <= 20) cls = 'mPAP ≤ 20 mmHg: does not meet the haemodynamic definition of PH';
    else if (v['p-pawp'] <= 15) cls = pvr > 2 ? 'Pre-capillary PH profile (PAWP ≤ 15, PVR > 2 WU)' : 'mPAP > 20 with PAWP ≤ 15 and PVR ≤ 2 WU: unclassified PH profile';
    else cls = pvr > 2 ? 'Combined post- and pre-capillary PH profile (PAWP > 15, PVR > 2 WU)' : 'Isolated post-capillary PH profile (PAWP > 15, PVR ≤ 2 WU)';
    const bad = pp <= 0 || v['p-padp'] >= v['p-pasp'];
    $('pac-out').innerHTML = (bad ? '<p class="note caution">PADP must be lower than PASP.</p>' : '') + table([
      row('mPAP', `${mpap.toFixed(0)} mmHg`, v['p-mpap'] > 0 ? 'measured' : 'estimated', mpap > 20),
      row('Stroke volume', `${sv.toFixed(0)} mL`),
      row('TPG', `${tpg.toFixed(0)} mmHg`),
      row('DPG', `${dpg.toFixed(0)} mmHg`),
      row('PVR', `${pvr.toFixed(1)} WU`, `${(pvr * 80).toFixed(0)} dyn·s·cm⁻⁵`, pvr > 2),
      row('PA compliance', `${pac.toFixed(1)} mL/mmHg`, 'SV / pulse pressure'),
      row('RC time', `${rc.toFixed(2)} s`),
      row('PAPi', `${papi.toFixed(1)}`, '(PASP − PADP)/RAP', papi <= 0.9),
      row('PA elastance ≈ mPAP/SV', `${ea.toFixed(2)} mmHg/mL`),
    ]) + `<p><strong>${cls}.</strong></p><p class="status">Definitions from the 2022 ESC/ERS guidelines. A haemodynamic profile is not a diagnosis.</p>`;
  });
}
