import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skills, band, overallBand, criteriaBand, writingBand, requirementGaps, scorePaths } from '../src/lib/ielts/score-calculator.ts';
import { requirements, groupedRequirements, postgraduateGroups, undergraduateGroups } from '../src/lib/ielts/score-requirements.ts';
import { universities, rankingEdition, rankingSource, postgraduateRequirements } from '../src/lib/ielts/score-postgraduate.ts';
const scores = (l, s, r, w) => ({ listening: l, speaking: s, reading: r, writing: w });
const none = { overall: 0, minimums: {} };
const weights = scores(1, 2, 1, 3);

test('overall matches official examples and every half-band combination', () => {
  assert.equal(overallBand(scores(6.5, 7, 6.5, 5)), 6.5);
  assert.equal(overallBand(scores(4, 4, 3.5, 4)), 4);
  assert.equal(overallBand(scores(6.5, 6, 6.5, 5.5)), 6);
  for (let l = 0; l <= 18; l++) for (let s = 0; s <= 18; s++) for (let r = 0; r <= 18; r++) for (let w = 0; w <= 18; w++) {
    assert.equal(overallBand(scores(l / 2, s / 2, r / 2, w / 2)), Math.floor((l + s + r + w + 2) / 4) / 2);
  }
});
test('criteria accept only four integers and use requested downward half-band rounding', () => {
  assert.equal(criteriaBand([7, 7, 7, 6]), 6.5);
  assert.equal(criteriaBand([7, 7, 7, 7]), 7);
  for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) for (let c = 0; c <= 9; c++) for (let d = 0; d <= 9; d++) assert.equal(criteriaBand([a, b, c, d]), Math.floor((a + b + c + d) / 2) / 2);
  for (const invalid of [[7, 7, 7], [7, 7, 7, 6.5], [7, 7, 7, NaN], [7, 7, 7, 10], new Array(4)]) assert.throws(() => criteriaBand(invalid), RangeError);
});
test('writing weights Task 2 twice and rounds upward to the next half band without float drift', () => {
  assert.equal(writingBand(7, 7.5), 7.5);
  assert.equal(writingBand(6, 7), 7);
  assert.equal(writingBand(7, 6), 6.5);
  for (let a = 0; a <= 18; a++) for (let b = 0; b <= 18; b++) assert.equal(writingBand(a / 2, b / 2), Math.floor((a + 2 * b + 2) / 3) / 2);
});
test('malformed bands and difficulty weights fail closed', () => {
  for (const invalid of [-1, 9.5, 6.25, NaN, Infinity, '7', null, undefined]) assert.throws(() => band(invalid), RangeError);
  assert.throws(() => scorePaths(scores(7, 7, 7, 7), 7.5, none, scores(0, 2, 1, 3)), RangeError);
  assert.throws(() => scorePaths(scores(7, 7, 7, 7), 7.5, none, scores(1, 2.5, 1, 3)), RangeError);
});
test('overall alone cannot satisfy a school component floor; unstated floors are not invented', () => {
  const hku = requirements.find(item => item.id === 'hku-ug');
  assert.deepEqual(requirementGaps(scores(9, 5.5, 9, 5.5), hku), ['口语需达到6.0', '写作需达到6.0']);
  assert.equal(requirements.find(item => item.id === 'ucl-5').minimums.writing, 8);
  assert.deepEqual(requirements.find(item => item.id === 'cuhk-ug').minimums, {});
});
test('paths meet both targets without decreasing any current band', () => {
  for (const current of [scores(0, 0, 0, 0), scores(7.5, 6.5, 7.5, 6.5), scores(9, 9, 9, 9)]) for (const goal of [7, 7.5, 8, 9]) for (const requirement of [none, ...requirements, ...postgraduateRequirements]) {
    const paths = scorePaths(current, goal, requirement, weights);
    assert.ok(paths.length >= 1 && paths.length <= 3);
    for (const path of paths) {
      assert.ok(path.overall >= Math.max(goal, requirement.overall));
      assert.deepEqual(requirementGaps(path.scores, requirement), []);
      for (const key of skills) { assert.ok(path.scores[key] >= current[key]); assert.equal(band(path.scores[key]), path.scores[key]); }
    }
    assert.equal(new Set(paths.map(path => JSON.stringify(path.scores))).size, paths.length);
  }
});
test('best path has exact minimum weighted cost and favours listening/reading only where feasible', () => {
  const current = scores(7.5, 6.5, 7.5, 6.5);
  const result = scorePaths(current, 8, none, weights)[0];
  let minimum = Infinity;
  for (let l = 15; l <= 18; l++) for (let s = 13; s <= 18; s++) for (let r = 15; r <= 18; r++) for (let w = 13; w <= 18; w++) {
    const candidate = scores(l / 2, s / 2, r / 2, w / 2);
    if (overallBand(candidate) >= 8) minimum = Math.min(minimum, skills.reduce((sum, key) => sum + 2 * (candidate[key] - current[key]) * weights[key], 0));
  }
  assert.equal(result.cost, minimum);
  assert.equal(result.scores.writing, 6.5);
  assert.equal(result.scores.speaking, 6.5);
  const oxford = requirements.find(item => item.id === 'oxford-ug');
  assert.ok(scorePaths(current, 7.5, oxford, weights)[0].scores.writing >= 7);
  assert.deepEqual(scorePaths(scores(9, 9, 9, 9), 9, none, weights), [{ scores: scores(9, 9, 9, 9), overall: 9, cost: 0, increase: 0 }]);
});
test('school sources are fixed official HTTPS links and profiles identify their scope', () => {
  assert.equal(new Set(requirements.map(item => item.id)).size, requirements.length);
  for (const item of requirements) { assert.equal(new URL(item.source).protocol, 'https:'); assert.match(item.label, /·/); band(item.overall); for (const value of Object.values(item.minimums)) band(value); }
});
test('calculator is local-only, accessible and has no removed label or unsafe HTML', () => {
  const ui = readFileSync(new URL('../src/components/ielts/ScoreCalculator.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /保守估算|不替代考官|调整提分难度|data-weight|data-school-source|href=|set:html|innerHTML|fetch\(|localStorage|sessionStorage|navigator\.|console\./);
  assert.match(ui, /textContent/);
  assert.match(ui, /aria-valuetext/);
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /:focus-visible/);
  assert.match(ui, /\.table-scroll :global\(td\)/);
  assert.match(ui, /role="tablist"/);
  assert.match(ui, /role="tabpanel"/);
  assert.match(ui, /ArrowRight/);
  assert.match(ui, /向上取至0.5分/);
});
test('destination groups merge only identical thresholds and keep exact course scopes', () => {
  assert.deepEqual(new Set(groupedRequirements.map(item => item.group)), new Set(['香港', '新加坡', '澳大利亚', '英国']));
  assert.ok(groupedRequirements.length < requirements.length);
  assert.equal(groupedRequirements.flatMap(item => item.members).length, requirements.length);
  for (const entry of groupedRequirements) for (const member of entry.members) {
    assert.equal(member.overall, entry.overall);
    assert.deepEqual(member.minimums, entry.minimums);
    assert.ok(member.label.includes(' · '));
  }
  assert.equal(groupedRequirements.find(item => item.id === 'cuhk-ug').members.length, 2);
  assert.equal(groupedRequirements.find(item => item.id === 'melbourne').members.length, 8);
  assert.deepEqual(requirementGaps(scores(9, 9, 6, 6), requirements.find(item => item.id === 'nus-ug')), ['阅读需达到6.5', '写作需达到6.5']);
  assert.deepEqual(requirementGaps(scores(9, 6, 9, 6), requirements.find(item => item.id === 'ntu-ug')), ['口语需达到6.5', '写作需达到6.5']);
});
test('calculator is an independent public page without telemetry or inline homepage expansion', () => {
  const page = readFileSync(new URL('../src/pages/ielts/score-calculator.astro', import.meta.url), 'utf8');
  assert.match(page, /export const prerender = true/);
  assert.match(page, /telemetry=\{false\}/);
  assert.match(page, /href="\/ielts#notes"/);
  assert.match(page, /<ScoreCalculator \/>/);
});
test('postgraduate coverage includes all 32 QS 2027 top-100 universities in the four destinations', () => {
  assert.equal(rankingEdition, 'QS 2027');
  assert.equal(new URL(rankingSource).hostname, 'www.topuniversities.com');
  assert.equal(universities.length, 32);
  assert.equal(new Set(universities.map(item => item[0])).size, 32);
  assert.deepEqual(['香港', '新加坡', '澳大利亚', '英国'].map(region => universities.filter(item => item[2] === region).length), [5, 2, 9, 16]);
  assert.deepEqual(new Set(postgraduateRequirements.map(item => item.university)), new Set(universities.map(item => item[0])));
  assert.equal(new Set(postgraduateRequirements.map(item => item.id)).size, postgraduateRequirements.length);
  for (const item of postgraduateRequirements) {
    assert.ok(item.rank <= 100 && item.rank >= 1);
    assert.equal(new URL(item.source).protocol, 'https:');
    assert.match(item.label, / · /);
    band(item.overall); for (const value of Object.values(item.minimums)) band(value);
  }
});
test('degree levels stay separate; grouped postgraduate thresholds keep every named course', () => {
  assert.equal(postgraduateGroups.flatMap(item => item.members).length, postgraduateRequirements.length);
  assert.ok(undergraduateGroups.every(item => item.members.every(member => !member.id.startsWith('ucl-') && member.id !== 'anu-crawford')));
  for (const group of postgraduateGroups) for (const member of group.members) {
    assert.equal(member.overall, group.overall); assert.deepEqual(member.minimums, group.minimums);
  }
  const uts = postgraduateRequirements.find(item => item.university === 'uts');
  assert.deepEqual(uts.minimums, { writing: 6 });
  const city = postgraduateRequirements.find(item => item.university === 'cityu');
  assert.equal(city.overall, 6); assert.match(city.note, /英语面试/);
  const glasgow = postgraduateRequirements.filter(item => item.university === 'glasgow');
  assert.equal(glasgow.length, 2);
  assert.deepEqual(requirementGaps(scores(6, 6, 7.5, 6.5), glasgow[0]), []);
  assert.deepEqual(requirementGaps(scores(6.5, 6.5, 6.5, 6), glasgow[1]), []);
  assert.ok(glasgow.every(item => requirementGaps(scores(7.5, 6, 6.5, 6), item).length > 0));
});
test('calculator uses homepage-sized text and a normal-flow sticky footer, not a content overlay', () => {
  const ui = readFileSync(new URL('../src/components/ielts/ScoreCalculator.astro', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../src/layouts/IeltsLayout.astro', import.meta.url), 'utf8');
  const footer = readFileSync(new URL('../src/components/ielts/LegalLinks.astro', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../src/pages/ielts/index.astro', import.meta.url), 'utf8');
  assert.match(ui, /\.score-calculator \{[^}]*font-size: 17px/);
  assert.match(ui, /data-study-level/); assert.match(ui, /value="postgraduate" selected/);
  assert.match(ui, /rebuildSchools\(\)/);
  assert.match(layout, /min-height: 100dvh; display: flex; flex-direction: column/);
  assert.match(layout, /\.ielts-site > main \{ flex: 1/);
  assert.match(footer, /margin-top: auto; flex-shrink: 0/);
  assert.doesNotMatch(footer, /position: (fixed|absolute)/);
  assert.match(home, /\.ielts-app \{ min-height: 0; flex: 1/);
});
