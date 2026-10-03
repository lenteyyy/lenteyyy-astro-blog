export type EntryQuestion = { id: string; number: number; prompt: string; options: string[]; choices: string[] };
export type EntryGroup = { title: string; instructions: string[]; bank: string[]; questions: EntryQuestion[] };
export type EntryContent = {
  title: string; version: number;
  listening: { title: string; audio: string; instructions: string[]; groups: EntryGroup[] };
  reading: { title: string; instructions: string[]; passageTitle: string; paragraphs: string[]; groups: EntryGroup[] };
  writing: { title: string; tasks: { id: string; title: string; instructions: string[]; image: string; minimumWords: number; groups: EntryGroup[] }[] };
};

export function answerIds(content: EntryContent): string[] {
  return [...content.listening.groups.flatMap(g => g.questions.map(q => q.id)),
    ...content.reading.groups.flatMap(g => g.questions.map(q => q.id)),
    ...content.writing.tasks.flatMap(t => [...t.groups.flatMap(g => g.questions.map(q => q.id)), t.id])];
}

/** Untrusted browser storage is plain text, never HTML; only this test's fields survive. */
export function cleanAnswers(value: unknown, ids: string[]): Record<string, string> {
  const answers: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return answers;
  for (const id of ids) {
    const item = Object.hasOwn(value, id) ? (value as Record<string, unknown>)[id] : undefined;
    if (typeof item === 'string') answers[id] = item.slice(0, /^W[12]$/.test(id) ? 50000 : 200);
  }
  return answers;
}

export function wordCount(value: string): number {
  return (value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
}

/** TXT deliberately avoids spreadsheet formula injection and active HTML. No account identifier. */
export function exportAnswers(content: EntryContent, value: unknown): string {
  const answers = cleanAnswers(value, answerIds(content));
  const text = (id: string) => (answers[id] || '未作答').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  const lines = [content.title, '', content.listening.title];
  for (const g of content.listening.groups) for (const q of g.questions) lines.push(`${q.number}. ${text(q.id)}`);
  lines.push('', content.reading.title);
  for (const g of content.reading.groups) for (const q of g.questions) lines.push(`${q.number}. ${text(q.id)}`);
  lines.push('', content.writing.title);
  for (const task of content.writing.tasks) {
    lines.push('', task.title, '基础诊断题');
    for (const g of task.groups) for (const q of g.questions) lines.push(`${q.number}. ${text(q.id)}`);
    lines.push('作文', text(task.id), `字数：${wordCount(answers[task.id] || '')}`);
  }
  return '\ufeff' + lines.join('\n');
}
