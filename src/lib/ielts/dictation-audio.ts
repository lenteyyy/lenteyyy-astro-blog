type PlaybackOptions = { rate: number; volume: number };
type PlaybackCallbacks = { loading: () => void; playing: () => void; ended: () => void; error: () => void };

/** One isolated decoder per playback; stale events can never advance a new word. */
export class DictationPlayback {
  private media?: HTMLAudioElement;
  private generation = 0;
  private options: PlaybackOptions = { rate: 1, volume: 1 };
  private active = false;
  private createMedia: () => HTMLAudioElement;
  private callbacks: PlaybackCallbacks;
  constructor(createMedia: () => HTMLAudioElement, callbacks: PlaybackCallbacks) { this.createMedia = createMedia; this.callbacks = callbacks; }

  setOptions(options: PlaybackOptions): void {
    if (![.75, .9, 1, 1.25, 1.5].includes(options.rate) || !Number.isFinite(options.volume) || options.volume < 0 || options.volume > 1) throw new RangeError('Invalid playback options');
    this.options = { ...options };
    if (this.media) {
      this.media.preservesPitch = true;
      this.media.defaultPlaybackRate = options.rate;
      this.media.playbackRate = options.rate;
      this.media.volume = options.volume;
    }
  }

  play(url: string, options: PlaybackOptions): void {
    if (!/^\/ielts\/dictation\/audio\/[a-z0-9-]+\.mp3$/.test(url)) throw new TypeError('Invalid recording URL');
    this.stop();
    const token = this.generation;
    const media = this.createMedia();
    this.media = media;
    this.active = true;
    this.setOptions(options);
    const valid = () => this.generation === token && this.media === media && this.active;
    const fail = () => { if (valid()) { this.active = false; this.callbacks.error(); } };
    media.preload = 'auto';
    media.onloadedmetadata = () => { if (valid()) this.setOptions(this.options); };
    media.onplaying = () => { if (valid()) this.callbacks.playing(); };
    media.onended = () => { if (valid()) { this.active = false; this.callbacks.ended(); } };
    media.onerror = fail;
    media.src = url;
    this.callbacks.loading();
    void media.play().catch(fail);
  }

  pause(): void { this.media?.pause(); }

  stop(): void {
    this.generation++;
    this.active = false;
    if (!this.media) return;
    this.media.onplaying = null;
    this.media.onended = null;
    this.media.onerror = null;
    this.media.onloadedmetadata = null;
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
    this.media = undefined;
  }
}
