import type { GameAudio } from '../game/GameController';
import { SOUND_BANK, type SoundKind } from './samples';

const MAX_VOICES = 24;
const MAX_PENDING_AGE = 0.15;
const MASTER_GAIN = 0.65;
const ATTACK = 0.001;
const RELEASE = 0.012;
const CANCEL_FADE = 0.008;
const PRIORITY: Record<SoundKind, number> = { cue: 3, pocket: 3, return: 2, ball: 1, cushion: 1 };
const VOICES_PER_BATCH: Record<SoundKind, number> = {
  cue: 1,
  ball: 8,
  cushion: 3,
  pocket: 4,
  return: 4,
};
const GAIN: Record<SoundKind, number> = {
  cue: 0.8,
  ball: 0.75,
  cushion: 0.55,
  pocket: 0.7,
  return: 0.45,
};

interface Impact {
  kind: SoundKind;
  strength: number;
  time: number;
  delay: number;
}

interface Voice {
  source: AudioBufferSourceNode;
  amp: GainNode;
  impact: Impact;
  level: number;
  startsAt: number;
  endsAt: number;
}

/** Gravações licenciadas com dinâmica de impacto e mixagem de contatos simultâneos. */
export class SoundEngine implements GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private input: AudioNode | null = null;
  private isMuted = false;
  private encoded = new Map<string, ArrayBuffer>();
  private buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private decoding: Promise<void> | null = null;
  private pending: Impact[] = [];
  private flushScheduled = false;
  private active = new Map<AudioBufferSourceNode, Voice>();
  private previous: Partial<Record<SoundKind, string>> = {};

  get muted(): boolean {
    return this.isMuted;
  }

  set muted(value: boolean) {
    this.isMuted = value;
    this.pending = [];
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(value ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.003);
    }
    if (value) this.reset();
  }

  /** Pré-carregamento sem permissão de áudio; falhas podem ser tentadas novamente no gesto seguinte. */
  preload(): Promise<void> {
    if (this.loading) return this.loading;
    const urls = Object.values(SOUND_BANK)
      .flat()
      .filter((url) => !this.encoded.has(url) && !this.buffers.has(url));
    this.loading = Promise.allSettled(
      urls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Áudio indisponível: ${response.status}`);
        this.encoded.set(url, await response.arrayBuffer());
      }),
    )
      .then((results) => {
        if (results.some((result) => result.status === 'rejected')) {
          console.warn('Algumas amostras de sinuca não carregaram; serão tentadas novamente.');
        }
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  unlock(): void {
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const ctx = new AudioContext({ latencyHint: 'interactive' });
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -8;
        compressor.knee.value = 10;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.18;
        this.master = ctx.createGain();
        this.master.gain.value = this.isMuted ? 0 : MASTER_GAIN;
        // O volume final também deixa margem depois da compressão durante a saída.
        compressor.connect(this.master).connect(ctx.destination);
        this.input = compressor;
        this.ctx = ctx;
      }
      const ctx = this.ctx;
      if (ctx.state === 'suspended') {
        void ctx
          .resume()
          .then(() => {
            if (this.ctx === ctx) this.flush();
          })
          .catch(() => {});
      }
      void this.load();
    } catch {
      // A partida continua mesmo em navegadores sem Web Audio.
    }
  }

  private load(): Promise<void> {
    if (this.decoding) return this.decoding;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve();
    const decoding = this.preload()
      .then(async () => {
        if (this.ctx !== ctx) return;
        await Promise.allSettled(
          [...this.encoded].map(async ([url, data]) => {
            try {
              const buffer = await ctx.decodeAudioData(data.slice(0));
              if (this.ctx === ctx) {
                this.buffers.set(url, buffer);
                this.encoded.delete(url);
              }
            } catch {
              // Uma próxima interação pode refazer apenas o download que falhou.
              if (this.ctx === ctx) this.encoded.delete(url);
            }
          }),
        );
        if (this.ctx === ctx) this.flush();
      })
      .finally(() => {
        if (this.decoding === decoding) this.decoding = null;
      });
    this.decoding = decoding;
    return decoding;
  }

  private queue(kind: SoundKind, strength: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.isMuted || !Number.isFinite(strength) || strength < 0.01) return;
    this.pending.push({
      kind,
      strength: Math.min(1, strength),
      time: performance.now() / 1000,
      delay,
    });
    // A física emite vários contatos por quadro. Preserva os mais fortes sem um bloqueio
    // global que apagaria as colisões simultâneas do triângulo.
    if (this.pending.length > 96) this.pending.sort((a, b) => b.strength - a.strength).length = 96;
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      queueMicrotask(() => {
        this.flushScheduled = false;
        this.flush();
      });
    }
  }

  private flush(): void {
    const ctx = this.ctx;
    if (!ctx || this.isMuted) {
      this.pending = [];
      return;
    }
    // Não agenda vozes em um relógio parado: tocariam atrasadas na próxima interação.
    if (ctx.state !== 'running') return;
    const counts: Partial<Record<SoundKind, number>> = {};
    const waiting: Impact[] = [];
    for (const impact of this.pending.sort((a, b) => b.strength - a.strength)) {
      if (performance.now() / 1000 - impact.time > MAX_PENDING_AGE) continue;
      const candidates = SOUND_BANK[impact.kind].filter((url) => this.buffers.has(url));
      if (!candidates.length) {
        waiting.push(impact);
        continue;
      }
      const count = counts[impact.kind] ?? 0;
      if (count >= VOICES_PER_BATCH[impact.kind] || !this.makeRoom(impact)) continue;
      const variants = candidates.filter((url) => url !== this.previous[impact.kind]);
      const options = variants.length ? variants : candidates;
      const url = options[Math.floor(Math.random() * options.length)]!;
      this.previous[impact.kind] = url;
      counts[impact.kind] = count + 1;
      this.play(impact, this.buffers.get(url)!, count);
    }
    this.pending = waiting;
  }

  private makeRoom(impact: Impact): boolean {
    if (this.active.size < MAX_VOICES) return true;
    const now = this.ctx!.currentTime;
    const score = (event: Impact, remaining = 1) =>
      PRIORITY[event.kind] * 2 + event.strength * remaining;
    const remaining = (voice: Voice) =>
      Math.max(0, Math.min(1, (voice.endsAt - now) / (voice.endsAt - voice.startsAt)));
    let weakest: Voice | null = null;
    for (const voice of this.active.values()) {
      if (
        !weakest ||
        score(voice.impact, remaining(voice)) < score(weakest.impact, remaining(weakest))
      )
        weakest = voice;
    }
    if (!weakest || score(impact) <= score(weakest.impact, remaining(weakest))) return false;
    // Tacada e caçapa continuam audíveis mesmo durante uma saída movimentada.
    this.releaseVoice(weakest);
    return true;
  }

  private releaseVoice(voice: Voice): void {
    const now = this.ctx!.currentTime;
    this.active.delete(voice.source);
    if (voice.startsAt >= now || voice.endsAt <= now) {
      // Cancela retornos futuros antes que possam tocar na nova partida.
      voice.source.stop(now);
      return;
    }
    const stopAt = Math.min(now + CANCEL_FADE, voice.endsAt);
    const envelope = Math.max(
      0,
      Math.min(1, (now - voice.startsAt) / ATTACK, (voice.endsAt - now) / RELEASE),
    );
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setValueAtTime(voice.level * envelope, now);
    voice.amp.gain.linearRampToValueAtTime(0, stopAt);
    voice.source.stop(stopAt);
  }

  private play(impact: Impact, buffer: AudioBuffer, index: number): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const amp = ctx.createGain();
    // A bola não muda de material/tamanho com a força. As gravações já variam o timbre.
    source.playbackRate.value = 1;
    const startsAt = ctx.currentTime + impact.delay + index * 0.002;
    const endsAt = startsAt + buffer.duration / source.playbackRate.value;
    const level = Math.pow(impact.strength, 0.9) * GAIN[impact.kind];
    const voice: Voice = { source, amp, impact, level, startsAt, endsAt };
    amp.gain.setValueAtTime(0, startsAt);
    amp.gain.linearRampToValueAtTime(level, startsAt + ATTACK);
    amp.gain.setValueAtTime(level, Math.max(startsAt + ATTACK, endsAt - RELEASE));
    amp.gain.linearRampToValueAtTime(0, endsAt);
    source.connect(amp).connect(this.input!);
    this.active.set(source, voice);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      amp.disconnect();
    };
    // Dispersão de poucos ms evita somar transientes idênticos na mesma amostra.
    source.start(startsAt);
  }

  cue(speed: number): void {
    this.queue('cue', speed / 8000);
  }
  ball(speed: number): void {
    if (speed >= 35) this.queue('ball', speed / 3200);
  }
  cushion(speed: number): void {
    if (speed >= 45) this.queue('cushion', speed / 2400);
  }
  pocket(): void {
    this.queue('pocket', 0.85);
    this.queue('return', 0.65, 0.2);
  }

  reset(): void {
    this.pending = [];
    for (const voice of this.active.values()) this.releaseVoice(voice);
  }

  dispose(): void {
    this.reset();
    const ctx = this.ctx;
    this.ctx = null;
    this.decoding = null;
    this.input = null;
    this.master = null;
    if (ctx && ctx.state !== 'closed') {
      // Fecha após o fade, sem transformar a desmontagem da tela em um estalo.
      setTimeout(
        () => {
          void ctx.close().catch(() => {});
        },
        CANCEL_FADE * 1000 + 20,
      );
    }
  }
}
