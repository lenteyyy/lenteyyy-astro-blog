export type Subject = 'listening' | 'reading' | 'writing';
export type ExamMode = 'single' | 'custom' | 'simulation';
export const subjectOrder: Subject[] = ['listening', 'reading', 'writing'];
export function examPath(book: number, test: number): string {
  if (![20, 21].includes(book) || !Number.isInteger(test) || test < 1 || test > 4) throw new RangeError('Unknown paper');
  return `/ielts/mock/${book === 20 ? 'c20-' : ''}test-${test}`;
}
export function readWorkflow(params: URLSearchParams): { mode: ExamMode; subjects: Subject[]; subject: Subject } | undefined {
  for (const key of ['mode', 'subjects', 'subject']) if (params.getAll(key).length > 1) return undefined;
  const mode = params.get('mode') || 'single';
  if (!['single', 'custom', 'simulation'].includes(mode)) return undefined;
  const raw = params.get('subjects');
  let subjects: Subject[];
  if (mode === 'simulation') {
    if (raw && raw !== subjectOrder.join(',')) return undefined;
    subjects = [...subjectOrder];
  } else if (mode === 'custom') {
    const selected = (raw || '').split(',');
    if (!selected.length || selected.length > 3 || new Set(selected).size !== selected.length || selected.some(s => !subjectOrder.includes(s as Subject))) return undefined;
    subjects = subjectOrder.filter(s => selected.includes(s));
  } else {
    if (raw) return undefined;
    const subject = params.get('subject') || 'listening';
    if (!subjectOrder.includes(subject as Subject)) return undefined;
    subjects = [subject as Subject];
  }
  const subject = (params.get('subject') || subjects[0]) as Subject;
  if (!subjects.includes(subject)) return undefined;
  return { mode: mode as ExamMode, subjects, subject };
}
export function nextSubject(subjects: Subject[], current: Subject): Subject | undefined {
  const index = subjects.indexOf(current);
  return index >= 0 ? subjects[index + 1] : undefined;
}
export function workflowUrl(book: number, test: number, mode: ExamMode, subjects: Subject[], subject: Subject): string {
  const params = new URLSearchParams({ subject });
  if (mode !== 'single') { params.set('mode', mode); params.set('subjects', subjects.join(',')); }
  if (!readWorkflow(params)) throw new RangeError('Invalid workflow');
  return `${examPath(book, test)}?${params}`;
}
export type RunState = { version: 1; started: boolean; current: Subject; finished: boolean; completed: Subject[]; scores: Partial<Record<Subject, number>> };
export function cleanRun(value: unknown, subjects: Subject[]): RunState {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<RunState> : {};
  const scores: RunState['scores'] = {};
  if (v.scores && typeof v.scores === 'object' && !Array.isArray(v.scores)) for (const s of subjects) {
    const score = v.scores[s]; if (typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 40) scores[s] = score;
  }
  const completed=Array.isArray(v.completed)?subjects.filter(s=>v.completed!.includes(s)):[];
  return { version: 1, started: v.version === 1 && v.started === true, current: subjects.includes(v.current as Subject) ? v.current as Subject : subjects[0], finished: v.version === 1 && v.finished === true && completed.length===subjects.length, completed, scores };
}
export function completeStage(run:RunState, subjects:Subject[], subject:Subject, score?:number):RunState {
  if(!run.started || !subjects.includes(subject))throw new RangeError('Inactive exam');
  const completed=subjects.filter(s=>s===subject || run.completed.includes(s));
  const scores={...run.scores};
  if(subject!=='writing' && Number.isInteger(score) && score!>=0 && score!<=40)scores[subject]=score;
  const current=subjects.slice(subjects.indexOf(subject)+1).find(s=>!completed.includes(s)) || subjects.find(s=>!completed.includes(s)) || subject;
  return {version:1,started:true,current,finished:completed.length===subjects.length,completed,scores};
}
