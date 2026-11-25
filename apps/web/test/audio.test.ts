import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../src/audio/SoundEngine';
import { SOUND_BANK } from '../src/audio/samples';

class Param {
  value = 0;
  cancelScheduledValues = vi.fn();
  linearRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class Node {
  gain = new Param();
  connect = vi.fn((destination: Node) => destination);
  disconnect = vi.fn();
}

class Source extends Node {
  buffer: { id: number; duration: number } | null = null;
  playbackRate = new Param();
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onended?.());
}

let contexts: Context[];
const urls = Object.values(SOUND_BANK).flat();

class Context {
  currentTime = 0;
  state = 'suspended';
  destination = new Node();
  sources: Source[] = [];
  gains: Node[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  decodeAudioData = vi.fn(async (data: ArrayBuffer) => ({
    id: new Uint8Array(data)[0],
    duration: 0.2,
  }));
  createGain = vi.fn(() => {
    const gain = new Node();
    this.gains.push(gain);
    return gain;
  });
  createBufferSource = vi.fn(() => {
    const source = new Source();
    this.sources.push(source);
    return source;
  });
  createDynamicsCompressor = vi.fn(() =>
    Object.assign(new Node(), {
      threshold: new Param(),
      knee: new Param(),
      ratio: new Param(),
      attack: new Param(),
      release: new Param(),
    }),
  );
  constructor() {
    contexts.push(this);
  }
}

const response = (url: string) => ({
  ok: true,
  arrayBuffer: async () => new Uint8Array([urls.indexOf(url) + 1]).buffer,
});
let engine: SoundEngine;

async function ready(): Promise<Context> {
  await engine.preload();
  engine.unlock();
  await vi.waitFor(() => expect(contexts[0]!.decodeAudioData).toHaveBeenCalledTimes(urls.length));
  return contexts[0]!;
}

beforeEach(() => {
  contexts = [];
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => response(url)),
  );
  vi.spyOn(Math, 'random').mockReturnValue(0);
  engine = new SoundEngine();
});

afterEach(() => {
  engine.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('áudio de sinuca', () => {
  it('pré-carrega sem abrir AudioContext e reutiliza contexto e amostras ao liberar novamente', async () => {
    await engine.preload();
    expect(contexts).toHaveLength(0);
    const ctx = await ready();
    engine.unlock();
    await Promise.resolve();
    expect(contexts).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(urls.length);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(urls.length);
  });

  it('mistura contatos simultâneos com variações, em vez de bloquear o segundo impacto', async () => {
    const ctx = await ready();
    engine.ball(1000);
    engine.ball(1000);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0]!.buffer).not.toBe(ctx.sources[1]!.buffer);
    expect(ctx.sources[0]!.start).toHaveBeenCalledWith(0);
    expect(ctx.sources[1]!.start).toHaveBeenCalledWith(0.002);
  });

  it('usa a força para o volume e prioriza os impactos mais fortes de um quadro', async () => {
    const ctx = await ready();
    engine.ball(100);
    engine.ball(3200);
    await Promise.resolve();
    expect(ctx.gains[1]!.gain.value).toBeGreaterThan(ctx.gains[2]!.gain.value);
    ctx.sources.forEach((source) => source.stop());
    for (let i = 0; i < 20; i++) engine.ball(100 + i * 100);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(10); // dois anteriores e oito contatos selecionados
  });

  it('preserva caçapas quando o limite de vozes já está ocupado por bolas', async () => {
    const ctx = await ready();
    for (let frame = 0; frame < 3; frame++) {
      for (let i = 0; i < 8; i++) engine.ball(3200);
      await Promise.resolve();
    }
    engine.pocket();
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(26);
    expect(ctx.sources[0]!.stop).toHaveBeenCalledOnce();
    expect(ctx.sources[24]!.start).toHaveBeenCalledWith(0);
    expect(ctx.sources[25]!.start).toHaveBeenCalledWith(0.2);
  });

  it('silencia vozes atuais e o retorno agendado, sem reproduzir som antigo ao reativar', async () => {
    const ctx = await ready();
    engine.pocket();
    await Promise.resolve();
    engine.muted = true;
    expect(ctx.sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
    expect(ctx.gains[0]!.gain.value).toBe(0);
    engine.ball(3200);
    engine.muted = false;
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(2);
    engine.ball(3200);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(3);
  });

  it('ignora tremores de baixa velocidade e valores não finitos', async () => {
    const ctx = await ready();
    engine.ball(1);
    engine.cushion(1);
    engine.cue(Number.NaN);
    engine.ball(Infinity);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(0);
  });

  it('aplica ataque e término suaves, calculados a partir da duração e da velocidade da amostra', async () => {
    const ctx = await ready();
    engine.ball(3200);
    await Promise.resolve();
    const source = ctx.sources[0]!;
    const gain = ctx.gains[1]!.gain;
    const duration = source.buffer!.duration / source.playbackRate.value;
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.75, 0.001);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, duration);
    expect(source.stop).not.toHaveBeenCalled(); // deixa o buffer terminar naturalmente
  });

  it('preserva o tom nas diferentes forças e deixa a colisão fraca realmente mais suave', async () => {
    const ctx = await ready();
    engine.ball(320);
    engine.ball(3200);
    await Promise.resolve();
    expect(ctx.sources.map((source) => source.playbackRate.value)).toEqual([1, 1]);
    const strong = ctx.gains[1]!.gain.linearRampToValueAtTime.mock.calls[0]![0];
    const soft = ctx.gains[2]!.gain.linearRampToValueAtTime.mock.calls[0]![0];
    expect(soft / strong).toBeCloseTo(Math.pow(0.1, 0.9));
  });

  it('deixa a tabela longa terminar mesmo quando outra colisão ocorre durante sua cauda', async () => {
    await engine.preload();
    engine.unlock();
    const ctx = contexts[0]!;
    ctx.decodeAudioData.mockImplementation(async (data) => ({
      id: new Uint8Array(data)[0],
      duration: 1.2,
    }));
    await vi.waitFor(() => expect(ctx.decodeAudioData).toHaveBeenCalledTimes(urls.length));
    engine.cushion(2400);
    await Promise.resolve();
    const cushion = ctx.sources[0]!;
    expect(ctx.gains[1]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.2);
    ctx.currentTime = 0.4;
    engine.ball(1600);
    await Promise.resolve();
    expect(cushion.stop).not.toHaveBeenCalled();
    expect(cushion.playbackRate.value).toBe(1);
  });

  it('troca uma voz antiga por uma nova colisão sem interromper a onda instantaneamente', async () => {
    const ctx = await ready();
    for (let frame = 0; frame < 3; frame++) {
      for (let i = 0; i < 8; i++) engine.ball(3200);
      await Promise.resolve();
    }
    ctx.currentTime = 0.05;
    engine.ball(3200);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(25);
    expect(ctx.sources[0]!.stop).toHaveBeenCalledWith(0.058);
    expect(ctx.gains[1]!.gain.cancelScheduledValues).toHaveBeenCalledWith(0.05);
    expect(ctx.gains[1]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.058);
  });

  it('reinicia com fade na voz atual e cancela o retorno futuro antes de ele tocar', async () => {
    const ctx = await ready();
    engine.pocket();
    await Promise.resolve();
    ctx.currentTime = 0.05;
    engine.reset();
    expect(ctx.sources[0]!.stop).toHaveBeenCalledWith(0.058);
    expect(ctx.sources[1]!.stop).toHaveBeenCalledWith(0.05);
    engine.ball(3200);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(3);
  });

  it('não perde amostras quando o contexto é recriado durante a decodificação', async () => {
    await engine.preload();
    engine.unlock();
    const first = contexts[0]!;
    let finish!: () => void;
    const blocked = new Promise<void>((resolve) => {
      finish = resolve;
    });
    first.decodeAudioData.mockImplementation(async (data) => {
      await blocked;
      return { id: new Uint8Array(data)[0], duration: 0.2 };
    });
    await vi.waitFor(() => expect(first.decodeAudioData).toHaveBeenCalledTimes(urls.length));
    engine.dispose();
    engine.unlock();
    const second = contexts[1]!;
    await vi.waitFor(() => expect(second.decodeAudioData).toHaveBeenCalledTimes(urls.length));
    engine.ball(3200);
    await Promise.resolve();
    expect(second.sources).toHaveLength(1);
    finish();
    await Promise.resolve();
    engine.ball(3200);
    await Promise.resolve();
    expect(second.sources).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(urls.length);
  });

  it('descarta eventos atrasados mesmo quando o relógio de um contexto suspenso não avança', async () => {
    const ctx = await ready();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    ctx.state = 'suspended';
    engine.ball(3200);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(0);
    clock.mockReturnValue(1300);
    engine.unlock();
    await Promise.resolve();
    expect(ctx.currentTime).toBe(0);
    expect(ctx.sources).toHaveLength(0);
    engine.ball(3200);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(1);
  });

  it('aguarda a retomada do contexto para tocar um evento que ainda é recente', async () => {
    const ctx = await ready();
    ctx.state = 'suspended';
    engine.cue(8000);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(0);
    engine.unlock();
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(1);
  });

  it('tenta novamente arquivos que falharam sem impedir o uso dos demais', async () => {
    await engine.preload();
    engine.dispose();
    vi.mocked(fetch).mockImplementation(async () => {
      throw new Error('offline');
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    engine = new SoundEngine();
    await engine.preload();
    expect(warning).toHaveBeenCalledOnce();
    vi.mocked(fetch).mockImplementation(async (url) => response(String(url)) as Response);
    contexts = [];
    engine.unlock();
    await vi.waitFor(() => expect(contexts[0]!.decodeAudioData).toHaveBeenCalledTimes(urls.length));
    engine.cue(5000);
    await Promise.resolve();
    expect(contexts[0]!.sources).toHaveLength(1);
  });

  it('não interrompe a partida quando Web Audio não está disponível', async () => {
    await engine.preload();
    vi.stubGlobal('AudioContext', undefined);
    expect(() => engine.unlock()).not.toThrow();
    expect(() => engine.cue(8000)).not.toThrow();
  });
});
