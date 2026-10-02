// Checks the recorded candidate, not the application's live state. A screenshot
// harness exiting successfully must never be mistaken for visual acceptance.
const fs = require('fs');
const path = require('path');
const data = path.resolve(__dirname, '../data');
const rows = JSON.parse(fs.readFileSync(path.join(data, 'origin-summary.json')));
const physical = JSON.parse(fs.readFileSync(path.join(data, 'physical-invariants.json')));
const failures = [];
for (const row of rows.filter(row => row.trace.startsWith('final-'))) {
  if (row.frames < 200) failures.push(`${row.trace}/${row.source}/${row.path}: too few rendered frames`);
  if (row.hiddenFrames) failures.push(`${row.trace}/${row.source}/${row.path}: ${row.hiddenFrames} hidden frames`);
  // One CSS pixel is a conservative diagnostic bound, not a new style policy.
  if (row.worstGapInducedMotionCssPx > 1) failures.push(
    `${row.trace}/${row.source}/${row.path}: ${row.worstGapInducedMotionCssPx.toFixed(3)} CSS px gap-induced jump`);
  if (row.gapReversals) failures.push(`${row.trace}/${row.source}/${row.path}: gap/epoch reversal`);
}
if (!physical.identical) failures.push('Physical source positions or epochs changed');
console.log(JSON.stringify({ status: failures.length ? 'NOT_ACCEPTED' : 'RECORDED_ORIGIN_CHECKS_PASSED',
  failures, note: 'All other visual, performance and regression gates still require review.' }, null, 2));
process.exitCode = failures.length ? 1 : 0;
