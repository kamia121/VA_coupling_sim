// Bedside calculators on the echo and PA-catheter pages. Arithmetic only, no model.
const $ = (id) => document.getElementById(id);

function bind(ids, units, digits, update) {
  const read = () => Object.fromEntries(ids.map((id) => [id, parseFloat($(id).value) || 0]));
  const paint = () => {
    const v = read();
    ids.forEach((id, i) => {
      const txt = units[i];
      document.querySelector(`[data-for="${id}"]`).textContent = txt;
    });
    update(v);
  };
  ids.forEach((id) => $(id).addEventListener('input', paint));
  paint();
}

const row = (k, v, note = '', flag = false) =>
  `<tr class="${flag ? 'flag' : ''}"><td>${k}</td><td class="num cur">${v}</td><td class="status">${note}</td></tr>`;
const table = (rows) => `<table class="data metrics"><tbody>${rows.join('')}</tbody></table>`;

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
