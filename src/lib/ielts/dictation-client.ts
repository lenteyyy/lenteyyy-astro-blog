import { randomIndex } from './dictation';
import { DictationPlayback } from './dictation-audio';
import {addWord} from './notebooks';
import {loadNotebook,saveNotebook} from './notebook-store';
import {PrivateRequestScope} from './private-request-scope';
import { dictationBooks, wordById, P1_CATEGORIES, DICTATION_RATES, defaultDictationRate, matchAnswer, sanitizeWrongIds, shuffled, DictationSession, type DictationWord } from './dictation-library';

type Settings = { rate: number; p1Rate: number; repeats: number; volume: number; fontSize: number; interval: number;
  shuffle: boolean; loopWrong: boolean; requireCorrection: boolean; autoSubmit: boolean; showWord: boolean; continuous: boolean };
const defaults: Settings = { rate: 1, p1Rate: defaultDictationRate('p1'), repeats: 1, volume: 1, fontSize: 24, interval: 5, shuffle: true,
  loopWrong: false, requireCorrection: true, autoSubmit: false, showWord: false, continuous: false };
const SETTINGS_KEY = 'ielts-dictation-settings-v1', WRONG_KEY = 'ielts-dictation-wrong-v1';
const numericOptions: Record<string, readonly number[]> = { rate: DICTATION_RATES, p1Rate: DICTATION_RATES, repeats: [1, 2, 3], fontSize: [24, 30, 36], interval: [3, 5, 8, 10] };
const root = document.querySelector<HTMLElement>('[data-dictation]');
if (root) {
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const input = $<HTMLInputElement>('[data-answer]');
  let audio = $<HTMLAudioElement>('[data-audio]');
  const feedback = $<HTMLElement>('[data-feedback]'), audioStatus = $<HTMLElement>('[data-audio-status]');
  const next = $<HTMLButtonElement>('[data-next]'), check = $<HTMLButtonElement>('[data-check]');
  const dialog = $<HTMLDialogElement>('[data-settings]'), rate = $<HTMLSelectElement>('[data-quick-rate]');
  const params = new URLSearchParams(location.search);
  const requestedBook = dictationBooks.find(book => book.id === params.get('book'));
  let settings = { ...defaults }, wrongIds: string[] = [], selectedBook = requestedBook?.id ?? dictationBooks[0].id;
  let requestedWord = requestedBook?.items.map(id => wordById.get(id)!).find(word => word.answer.toLowerCase() === (params.get('word') ?? '').slice(0, 128).toLowerCase());
  let session: DictationSession | null = null, current: DictationWord | undefined;
  let verdict: boolean | null = null, wasWrong = false, advancing = false, played = 0;
  let timer: ReturnType<typeof setTimeout> | undefined, audioTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0, closedByPage = false, awaitingAudio = false;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      const entries = saved as Record<string, unknown>;
      for (const key of Object.keys(defaults) as (keyof Settings)[]) {
        const value = entries[key];
        if (typeof defaults[key] === 'boolean' && typeof value === 'boolean') Object.assign(settings, { [key]: value });
        else if (typeof value === 'number' && Number.isFinite(value) && (key === 'volume' ? value >= 0 && value <= 1 : numericOptions[key]?.includes(value))) Object.assign(settings, { [key]: value });
      }
    }
    wrongIds = sanitizeWrongIds(JSON.parse(localStorage.getItem(WRONG_KEY) ?? '[]'));
  } catch { /* Storage can be unavailable; practice remains usable. */ }
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };
  const book = () => dictationBooks.find(book => book.id === selectedBook)!;
  const collectionScope=new PrivateRequestScope(),saveWord=root.querySelector<HTMLButtonElement>('[data-save-word]')!,saveStatus=root.querySelector<HTMLElement>('[data-word-save-status]')!;
  saveWord.addEventListener('click',async()=>{
    if(!current)return;const word=current,group=book().title;collectionScope.invalidate();const token=collectionScope.capture();saveWord.disabled=true;
    try{const response=await fetch('/api/ielts/auth/me',{cache:'no-store',signal:token.signal}),identity=await response.json();if(!collectionScope.current(token))return;
      if(!response.ok||!identity.authenticated){saveStatus.textContent='请先登录账户，再收藏到单词本。';return;}
      saveNotebook(identity.userId,addWord(loadNotebook(identity.userId),word.answer,{audioId:word.id,group,source:'单词听写'}));saveStatus.textContent=`已收藏 ${word.answer}。`;
    }catch{if(collectionScope.current(token))saveStatus.textContent='收藏失败，请检查登录状态和本机存储。';}finally{saveWord.disabled=false;}
  });
  const collectionChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('ielts-auth-events'):undefined;
  const clearCollection=()=>{collectionScope.invalidate();saveStatus.textContent='';saveWord.disabled=false;};
  collectionChannel?.addEventListener('message',clearCollection);window.addEventListener('pagehide',clearCollection);
  const available = () => book().items.map(id => wordById.get(id)!).filter(word => {
    const category = $<HTMLSelectElement>('[data-category]').value;
    return selectedBook !== 'p1' || category === 'all' || word.category === category;
  });
  const updateWrong = () => {
    try { localStorage.setItem(WRONG_KEY, JSON.stringify(wrongIds)); } catch {}
    const count = available().filter(word => wrongIds.includes(word.id)).length;
    $<HTMLElement>('[data-wrong-count]').textContent = String(count);
    $<HTMLButtonElement>('[data-review]').disabled = count === 0;
    $<HTMLButtonElement>('[data-clear-wrong]').disabled = wrongIds.length === 0;
    $<HTMLButtonElement>('[data-result-review]').disabled = count === 0;
  };
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const clearAudioTimer = () => { if (audioTimer !== undefined) clearTimeout(audioTimer); audioTimer = undefined; };
  const playbackRate = () => selectedBook === 'p1' ? settings.p1Rate : settings.rate;
  const setRate = (value: number) => {
    if (!numericOptions.rate.includes(value)) return;
    if (selectedBook === 'p1') settings.p1Rate = value; else settings.rate = value;
    saveSettings(); applySettings();
  };
  const stopAudio = () => { generation++; clearTimer(); clearAudioTimer(); player.stop(); awaitingAudio = false; audioStatus.textContent = ''; };
  const applySettings = () => {
    rate.value = String(playbackRate()); player.setOptions({ rate: playbackRate(), volume: settings.volume });
    next.disabled = awaitingAudio;
    root.style.setProperty('--dictation-font-size', `${settings.fontSize}px`);
    for (const control of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]')) {
      const key = control.dataset.setting as keyof Settings;
      if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = Boolean(settings[key]);
      else control.value = String(key === 'rate' ? playbackRate() : settings[key]);
    }
    $<HTMLElement>('[data-prompt]').textContent = current && settings.showWord ? current.answer : '根据发音写出答案';
    if (verdict !== null) {
      next.hidden = settings.requireCorrection && !verdict;
      input.disabled = verdict || !settings.requireCorrection; check.hidden = input.disabled;
    }
  };
  const play = () => {
    if (!current || !session || closedByPage) return;
    clearTimer(); clearAudioTimer(); generation++;
    awaitingAudio = true; next.disabled = true;
    player.play(current.audio, { rate: playbackRate(), volume: settings.volume });
  };
  const replay = () => { played = 0; play(); };
  const showCurrent = () => {
    clearCollection();
    stopAudio(); current = session?.current; verdict = null; wasWrong = false; advancing = false; played = 0;
    if (!current || !session) return;
    input.value = ''; input.disabled = false; check.hidden = false; check.disabled = false;
    feedback.textContent = ''; next.hidden = true;
    $<HTMLElement>('[data-progress]').textContent = `已完成 ${session.completed} / ${session.total}`;
    $<HTMLProgressElement>('[data-progress-bar]').value = session.completed / session.total * 100;
    applySettings(); input.focus(); play();
  };
  const showLibrary = () => {
    stopAudio(); session = null; current = undefined;
    $<HTMLElement>('[data-library]').hidden = false; $<HTMLElement>('[data-practice]').hidden = true;
    $<HTMLElement>('[data-result]').hidden = true; updateWrong();
  };
  const finish = () => {
    if (!session) return;
    stopAudio(); current = undefined;
    $<HTMLElement>('[data-practice]').hidden = true; $<HTMLElement>('[data-result]').hidden = false;
    $<HTMLElement>('[data-summary]').textContent = `首次答对 ${session.correctFirst} / ${session.total} · 错词 ${session.mistakes.size} · 作答 ${session.attempts} 次`;
    updateWrong(); $<HTMLButtonElement>('[data-again]').focus();
  };
  const advance = () => {
    if (!session || !current || awaitingAudio || verdict === null || (settings.requireCorrection && !verdict) || advancing) return;
    advancing = true; clearTimer(); session.submit(verdict && !wasWrong);
    wrongIds = wrongIds.filter(id => !session!.mastered.has(id)); updateWrong();
    if (!session.current) finish(); else showCurrent();
  };
  const submit = (allowBlank = false) => {
    if (!session || !current || advancing || verdict === true || (!allowBlank && !input.value.trim())) return;
    clearTimer(); const correct = matchAnswer(input.value, current); verdict = correct;
    if (!correct) { wasWrong = true; if (!wrongIds.includes(current.id)) wrongIds.push(current.id); updateWrong(); }
    feedback.textContent = correct ? `正确 · ${current.answer}` : `正确答案：${current.answer}${settings.requireCorrection ? ' · 请改正后继续' : ''}`;
    next.hidden = settings.requireCorrection && !correct;
    input.disabled = correct || !settings.requireCorrection; check.hidden = input.disabled;
    if (correct || !settings.requireCorrection) {
      if (!awaitingAudio) {
        if (settings.continuous) timer = setTimeout(advance, 600);
        else next.focus();
      }
    } else input.focus();
  };
  const start = (review = false) => {
    stopAudio(); let words = available().filter(word => !review || wrongIds.includes(word.id));
    if (!words.length) { $<HTMLElement>('[data-book-status]').textContent = '当前词书没有错词。'; return; }
    if (settings.shuffle) words = shuffled(words, randomIndex);
    if (!review && requestedWord && words.some(word => word.id === requestedWord!.id)) {
      words = [requestedWord, ...words.filter(word => word.id !== requestedWord!.id)]; requestedWord = undefined;
    }
    const size = $<HTMLSelectElement>('[data-size]').value;
    if (size !== 'all') words = words.slice(0, Number(size));
    session = new DictationSession(words, settings.loopWrong);
    $<HTMLElement>('[data-library]').hidden = true; $<HTMLElement>('[data-result]').hidden = true;
    $<HTMLElement>('[data-practice]').hidden = false;
    const category = $<HTMLSelectElement>('[data-category]').value;
    $<HTMLElement>('[data-book-title]').textContent = book().title + (selectedBook === 'p1' && category !== 'all' ? ` · ${P1_CATEGORIES[category]}` : '') + (review ? ' · 错词复习' : '');
    showCurrent();
  };
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-book]')) button.addEventListener('click', () => {
    selectedBook = button.dataset.book!;
    root.querySelectorAll('[data-book]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    $<HTMLElement>('[data-category-label]').hidden = selectedBook !== 'p1'; applySettings(); updateWrong();
    requestedWord = undefined;
    $<HTMLElement>('[data-book-status]').textContent = '英语发音 · 错词仅保存在当前浏览器';
  });
  $<HTMLSelectElement>('[data-category]').addEventListener('change', updateWrong);
  $<HTMLButtonElement>('[data-start]').addEventListener('click', () => start());
  $<HTMLButtonElement>('[data-again]').addEventListener('click', () => start());
  for (const selector of ['[data-review]', '[data-result-review]']) $<HTMLButtonElement>(selector).addEventListener('click', () => start(true));
  $<HTMLButtonElement>('[data-clear-wrong]').addEventListener('click', () => { wrongIds = []; updateWrong(); });
  $<HTMLButtonElement>('[data-exit]').addEventListener('click', showLibrary);
  $<HTMLButtonElement>('[data-library-button]').addEventListener('click', showLibrary);
  $<HTMLButtonElement>('[data-play]').addEventListener('click', replay);
  next.addEventListener('click', advance);
  $<HTMLFormElement>('[data-answer-form]').addEventListener('submit', event => { event.preventDefault(); if (verdict === true || (verdict === false && !settings.requireCorrection)) advance(); else submit(); });
  input.addEventListener('input', () => { if (settings.autoSubmit && !input.disabled && current && matchAnswer(input.value, current)) submit(); });
  const player = new DictationPlayback(() => {
    const fresh = document.createElement('audio');
    fresh.dataset.audio = ''; fresh.setAttribute('aria-hidden', 'true');
    audio.replaceWith(fresh); audio = fresh;
    return fresh;
  }, {
    loading: () => { audioStatus.textContent = '正在加载录音'; },
    playing: () => { audioStatus.textContent = '正在播放'; },
    error: () => { clearTimer(); clearAudioTimer(); audioStatus.textContent = '录音无法加载，请点击重播。'; },
    ended: () => {
      if (!current || !session || closedByPage) return;
      played++; const token = generation;
      if (played < settings.repeats) {
        audioStatus.textContent = '稍后重播';
        audioTimer = setTimeout(() => { if (token === generation) play(); }, 450);
        return;
      }
      awaitingAudio = false; next.disabled = false; audioStatus.textContent = '';
      if (verdict !== null) {
        if (verdict || !settings.requireCorrection) {
          if (settings.continuous && !dialog.open) timer = setTimeout(() => { if (token === generation) advance(); }, 600);
          else next.focus();
        }
      } else if (settings.continuous && !dialog.open) {
        audioStatus.textContent = `${settings.interval}秒后检查并继续`;
        timer = setTimeout(() => { if (token === generation) submit(true); }, settings.interval * 1000);
      }
    },
  });
  const openSettings = () => { clearTimer(); clearAudioTimer(); player.pause(); dialog.showModal(); };
  $<HTMLButtonElement>('[data-open-settings]').addEventListener('click', openSettings);
  $<HTMLButtonElement>('[data-close-settings]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (current && (verdict === null || awaitingAudio)) replay(); });
  for (const control of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]')) control.addEventListener('change', () => {
    const key = control.dataset.setting as keyof Settings;
    const value = control instanceof HTMLInputElement && control.type === 'checkbox' ? control.checked : Number(control.value);
    if (key === 'rate' && typeof value === 'number') { setRate(value); return; }
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && (key === 'volume' ? value >= 0 && value <= 1 : numericOptions[key]?.includes(value)))) {
      Object.assign(settings, { [key]: value }); saveSettings(); applySettings();
    }
  });
  rate.addEventListener('change', () => setRate(Number(rate.value)));
  $<HTMLButtonElement>('[data-fullscreen]').addEventListener('click', () => {
    const action = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.();
    void action?.catch(() => { $<HTMLElement>('[data-book-status]').textContent = '当前浏览器不支持全屏。'; });
  });
  document.addEventListener('fullscreenchange', () => {
    $<HTMLButtonElement>('[data-fullscreen]').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
  });
  document.addEventListener('keydown', event => {
    if (event.isComposing || dialog.open || !current) return;
    if (event.altKey && event.code === 'KeyR') { event.preventDefault(); replay(); }
    if (event.code === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey && event.target === document.body) { event.preventDefault(); if (verdict !== null && (verdict || !settings.requireCorrection)) advance(); else submit(); }
  });
  window.addEventListener('pagehide', () => { closedByPage = true; stopAudio(); });
  window.addEventListener('pageshow', () => { closedByPage = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimer(); clearAudioTimer(); player.pause(); audioStatus.textContent = '已暂停 · 点击重播继续'; } });
  root.querySelectorAll<HTMLButtonElement>('[data-book]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.book === selectedBook)));
  $<HTMLElement>('[data-category-label]').hidden = selectedBook !== 'p1';
  if (requestedWord) $<HTMLElement>('[data-book-status]').textContent = `本次从 ${requestedWord.answer} 开始 · 错词仅保存在当前浏览器`;
  applySettings(); updateWrong();
}
