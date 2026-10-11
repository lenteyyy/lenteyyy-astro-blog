// Local, owner-supplied audio import. No upload or deployment is performed.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [vocabularyPath, p1Path, audioDirectory, extraBookPath] = process.argv.slice(2);
if (!vocabularyPath || !p1Path || !audioDirectory) throw new Error('Provide vocabulary manifest, P1 manifest and audio directory.');
const vocabulary = JSON.parse(readFileSync(vocabularyPath, 'utf8'));
const p1 = JSON.parse(readFileSync(p1Path, 'utf8'));
if (!vocabulary.complete || vocabulary.records.length !== vocabulary.unique_entries) throw new Error('Incomplete vocabulary recordings');
const books = [
  { id: 'answers', title: '机经听力答案词', source: '雅思听力虾滑答案词_汇总.xlsx', items: [] },
  { id: 'spelling', title: '易错词', source: '雅思听力易拼错词_汇总.xlsx', items: [] },
  { id: 'maps', title: '地图题核心词', source: '雅思听力地图题核心词_汇总.xlsx', items: [] },
  { id: 'p1', title: 'Part 1 · 号码与地址', items: [] },
];
const items = [];
const destination = path.resolve('public/ielts/dictation/audio');
mkdirSync(destination, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const overridesFile = 'src/lib/ielts/dictation-audio-overrides.json';
const overrides = new Map((existsSync(overridesFile) ? JSON.parse(readFileSync(overridesFile, 'utf8')).records : []).map(record => [record.id, record]));
function importAudio(record, id, category = 'word') {
  if (!/^[a-z0-9-]+$/.test(id) || path.basename(record.file) !== record.file) throw new Error('Unsafe recording filename');
  const bytes = readFileSync(path.join(audioDirectory, record.file));
  if (hash(bytes) !== record.sha256) throw new Error('Recording integrity mismatch');
  const override = overrides.get(id);
  let audio = '/ielts/dictation/audio/' + id + '.mp3';
  if (override) {
    if (override.original_sha256 !== record.sha256 || !/^\/ielts\/dictation\/audio\/[a-z0-9-]+\.mp3$/.test(override.audio)) throw new Error('Invalid clarity override');
    const target = path.resolve('public' + override.audio);
    if (!existsSync(target) || hash(readFileSync(target)) !== override.sha256) throw new Error('Clarity recording integrity mismatch');
    audio = override.audio;
  } else {
    const target = path.join(destination, id + '.mp3');
    if (existsSync(target) && hash(readFileSync(target)) !== record.sha256) throw new Error('Refusing to replace an unrelated audio file');
    if (!existsSync(target)) copyFileSync(path.join(audioDirectory, record.file), target);
  }
  const answer = record.term ?? record.answer;
  if (typeof answer !== 'string' || !answer || answer.length > 128) throw new Error('Invalid recording answer');
  const acceptedAnswers = record.accepted_answers;
  if (acceptedAnswers && (!Array.isArray(acceptedAnswers) || acceptedAnswers.length > 20 || acceptedAnswers.some(value => typeof value !== 'string' || !value || value.length > 128))) throw new Error('Invalid accepted answers');
  items.push({ id, answer, category, audio, ...(acceptedAnswers ? { acceptedAnswers } : {}) });
}
for (const record of vocabulary.records) {
  const id = 'word-' + hash(Buffer.from(record.term.normalize('NFKC').toLowerCase())).slice(0, 12);
  importAudio(record, id);
  for (const book of books.filter(book => book.source)) {
    if (record.sources.some(source => source.workbook === book.source)) book.items.push(id);
  }
}
const categories = { 电话号码: 'phone', 地址: 'address', 邮编: 'postcode', 航班号: 'flight', 银行卡号: 'card' };
for (const record of p1.records) {
  const category = categories[record.category];
  if (!category) throw new Error('Unknown P1 recording category');
  const id = `p1-${category}-${String(record.number).padStart(2, '0')}`;
  importAudio(record, id, category);
  books.find(book => book.id === 'p1').items.push(id);
}
if (extraBookPath) {
  const extra = JSON.parse(readFileSync(extraBookPath, 'utf8'));
  if (!extra.complete || extra.book_id !== 'nineband' || extra.records.length !== extra.unique_entries) throw new Error('Incomplete extra wordbook');
  const book = { id: 'nineband', title: '九分学长听力词表', items: [] };
  for (const record of extra.records) {
    const id = 'word-' + hash(Buffer.from(record.term.normalize('NFKC').toLowerCase())).slice(0, 12);
    if (items.some(item => item.id === id)) throw new Error('Unexpected duplicate in extra wordbook');
    if (!['word', 'identifier'].includes(record.category)) throw new Error('Unknown extra recording category');
    importAudio(record, id, record.category);
    book.items.push(id);
  }
  books.push(book);
}
if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate recording ID');
writeFileSync('src/lib/ielts/dictation-catalog.json', JSON.stringify({ version: 1, books: books.map(({ source, ...book }) => book), items }, null, 2) + '\n');
console.log(JSON.stringify({ recordings: items.length, books: books.map(book => ({ title: book.title, count: book.items.length })) }));
