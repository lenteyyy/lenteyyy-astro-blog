export const skills = ['listening', 'speaking', 'reading', 'writing'] as const;
export type Skill = typeof skills[number];
export type Scores = Record<Skill, number>;
export const skillLabels: Record<Skill, string> = { listening: '听力', speaking: '口语', reading: '阅读', writing: '写作' };

export function band(value: number): number {
	if (!Number.isFinite(value) || value < 0 || value > 9 || !Number.isInteger(value * 2)) throw new RangeError('分数必须为0–9的整数或半分');
	return value;
}
export function overallBand(scores: Scores): number {
	return Math.round(skills.reduce((sum, key) => sum + band(scores[key]), 0) / 2) / 2;
}
/** User-selected calculation convention, not a claim about examiner rounding. */
export function criteriaBand(criteria: readonly number[]): number {
	if (criteria.length !== 4 || Array.from(criteria).some(value => !Number.isInteger(value) || value < 0 || value > 9)) throw new RangeError('四项评分须为0–9的整数');
	return Math.floor(criteria.reduce((sum, value) => sum + value, 0) / 2) / 2;
}
export function writingBand(task1: number, task2: number): number {
	return Math.ceil((band(task1) * 2 + band(task2) * 4) / 3) / 2;
}
export type Requirement = { overall: number; minimums: Partial<Scores> };
export function requirementGaps(scores: Scores, requirement: Requirement): string[] {
	const result: string[] = [];
	if (overallBand(scores) < band(requirement.overall)) result.push(`总分需达到${requirement.overall.toFixed(1)}`);
	for (const key of skills) {
		const minimum = requirement.minimums[key];
		if (minimum !== undefined && band(scores[key]) < band(minimum)) result.push(`${skillLabels[key]}需达到${minimum.toFixed(1)}`);
	}
	return result;
}
export type ScorePath = { scores: Scores; overall: number; cost: number; increase: number };
/** Minimum-cost, non-redundant paths in half-band steps. Cost is a preference, not study time. */
export function scorePaths(current: Scores, target: number, requirement: Requirement, weights: Scores): ScorePath[] {
	const goal = Math.max(band(target), band(requirement.overall));
	const starts = skills.map(key => Math.max(band(current[key]), band(requirement.minimums[key] ?? 0)) * 2);
	for (const key of skills) if (!Number.isInteger(weights[key]) || weights[key] < 1 || weights[key] > 5) throw new RangeError('难度权重须为1–5的整数');
	if (overallBand(current) >= goal && requirementGaps(current, requirement).length === 0) return [{ scores: { ...current }, overall: overallBand(current), cost: 0, increase: 0 }];
	const best: ScorePath[] = [];
	const compare = (a: ScorePath, b: ScorePath) => a.cost - b.cost || a.increase - b.increase || a.scores.writing - b.scores.writing || a.scores.speaking - b.scores.speaking || a.scores.listening - b.scores.listening || a.scores.reading - b.scores.reading;
	// Rounded overall reaches goal when the integer half-band sum is at least 8*goal-2.
	const requiredSum = Math.max(0, 8 * goal - 2);
	for (let l = starts[0]; l <= 18; l++) for (let s = starts[1]; s <= 18; s++) for (let r = starts[2]; r <= 18; r++) {
		// For each L/S/R combination, only the minimum feasible W can be optimal.
		const w = Math.max(starts[3], requiredSum - l - s - r);
		if (w > 18) continue;
		const scores: Scores = { listening: l / 2, speaking: s / 2, reading: r / 2, writing: w / 2 };
		const cost = skills.reduce((sum, key) => sum + (scores[key] - current[key]) * 2 * weights[key], 0);
		const increase = skills.reduce((sum, key) => sum + scores[key] - current[key], 0);
		best.push({ scores, overall: overallBand(scores), cost, increase });
		best.sort(compare);
		if (best.length > 3) best.pop();
	}
	return best;
}
