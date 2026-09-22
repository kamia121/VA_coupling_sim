// Writes tests/presets_js.csv so R/validate.R can cross-check the R implementation.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { simulate } from '../site/js/engine.js';
import { PRESETS } from '../site/js/presets.js';

const cols = ['LV_EDV', 'LV_ESV', 'LV_EF', 'LV_EaEes', 'SBP', 'DBP', 'LAP', 'CO', 'RV_EDV', 'RV_ESV', 'RV_EesEa', 'RV_svEsv', 'mPAP', 'RAP', 'PVR_WU'];
const lines = [['id', 'converged', ...cols].join(',')];
for (const p of PRESETS) {
  const r = simulate(p.params);
  const v = {
    LV_EDV: r.lv.EDV, LV_ESV: r.lv.ESV, LV_EF: r.lv.EF, LV_EaEes: r.lv.EaEes,
    SBP: r.hemo.SBP, DBP: r.hemo.DBP, LAP: r.hemo.LAP, CO: r.hemo.CO,
    RV_EDV: r.rv.EDV, RV_ESV: r.rv.ESV, RV_EesEa: r.rv.EesEa, RV_svEsv: r.rv.svEsv,
    mPAP: r.hemo.mPAP, RAP: r.hemo.RAP, PVR_WU: r.hemo.PVR_WU,
  };
  lines.push([p.id, r.converged ? 'TRUE' : 'FALSE', ...cols.map((c) => v[c])].join(','));
}
writeFileSync(fileURLToPath(new URL('./presets_js.csv', import.meta.url)), lines.join('\n') + '\n');
console.log(`wrote ${PRESETS.length} rows to tests/presets_js.csv`);
