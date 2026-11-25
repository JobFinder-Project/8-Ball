import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const directory = new URL('../src/audio/samples/', import.meta.url);
const files = readdirSync(directory)
  .filter((file) => file.endsWith('.wav'))
  .sort();

describe('amostras de sinuca distribuídas com o jogo', () => {
  it('mantém uma biblioteca local de dez amostras', () => {
    expect(files).toHaveLength(10);
  });

  it.each(files)('%s tem formato compatível, transiente rápido e término sem corte', (file) => {
    const wav = readFileSync(new URL(file, directory));
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    let data: Buffer | null = null;
    let rate = 0;
    for (let offset = 12; offset + 8 <= wav.length;) {
      const kind = wav.toString('ascii', offset, offset + 4);
      const size = wav.readUInt32LE(offset + 4);
      if (kind === 'fmt ') {
        expect(wav.readUInt16LE(offset + 8)).toBe(1); // PCM
        expect(wav.readUInt16LE(offset + 10)).toBe(1); // mono
        rate = wav.readUInt32LE(offset + 12);
        expect(rate).toBe(44100);
        expect(wav.readUInt16LE(offset + 22)).toBe(16);
      }
      if (kind === 'data') data = wav.subarray(offset + 8, offset + 8 + size);
      offset += 8 + size + (size % 2);
    }
    expect(data).not.toBeNull();
    const pcm = data!;
    const samples = Array.from(
      { length: pcm.length / 2 },
      (_, i) => pcm.readInt16LE(i * 2) / 32768,
    );
    const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThan(0.95);
    expect(samples.length / rate).toBeGreaterThan(0.1);
    expect(samples.length / rate).toBeLessThan(file.startsWith('cushion-') ? 1.5 : 1);
    const onset = samples.findIndex((value) => Math.abs(value) > 0.005);
    expect(onset).toBeGreaterThanOrEqual(0);
    expect(onset / rate).toBeLessThan(0.008);
    expect(Math.abs(samples[0]!)).toBeLessThan(0.001);
    expect(Math.abs(samples.at(-1)!)).toBeLessThan(0.001);
    if (file.startsWith('ball-') || file.startsWith('cushion-')) {
      expect(samples.length / rate).toBeGreaterThan(0.3);
      // Examina ANTES do fade final de 35 ms, não apenas o último sample zerado.
      const tail = samples.slice(-Math.round(0.085 * rate), -Math.round(0.035 * rate));
      const rms = Math.sqrt(
        tail.reduce((energy, value) => energy + value * value, 0) / tail.length,
      );
      expect(rms / peak).toBeLessThan(0.01);
    }
    if (file.startsWith('ball-')) {
      const rms = (start: number, end: number) => {
        const window = samples.slice(Math.round(start * rate), Math.round(end * rate));
        return Math.sqrt(
          window.reduce((energy, value) => energy + value * value, 0) / window.length,
        );
      };
      // A limpeza não pode trocar a cauda por um recorte curto nem atrasar o impacto.
      expect(samples.length / rate).toBeGreaterThan(0.48);
      const peakIndex = samples.findIndex((value) => Math.abs(value) === peak);
      expect(peakIndex / rate).toBeLessThan(0.08);
      expect(rms(0.1, 0.2)).toBeGreaterThan(0.0002);
      // Mede antes do fade: o chiado já deve estar baixo, não apenas oculto no final.
      expect(rms(0.35, 0.45)).toBeLessThan(0.00015);
    }
    if (file.startsWith('cushion-')) {
      expect(samples.length / rate).toBeGreaterThan(1);
      const rms = (start: number, end: number) => {
        const window = samples.slice(Math.round(start * rate), Math.round(end * rate));
        return Math.sqrt(
          window.reduce((energy, value) => energy + value * value, 0) / window.length,
        );
      };
      // Não aceita alongar o WAV apenas com zeros; a ressonância existe e desaparece.
      expect(rms(0.35, 0.5)).toBeGreaterThan(0.00001);
      expect(rms(0.9, 1.05)).toBeLessThan(0.00003);
      expect(samples.slice(-Math.round(0.05 * rate)).every((value) => value === 0)).toBe(true);
    }
  });
});
