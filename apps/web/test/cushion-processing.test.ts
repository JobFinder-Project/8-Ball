import { describe, expect, it } from 'vitest';
import { extendCushionTail } from '../../../scripts/cushion-tail.mjs';

const rate = 44100;
const rms = (samples: Float32Array, start: number, end: number) => {
  const window = samples.subarray(Math.round(start * rate), Math.round(end * rate));
  return Math.sqrt(window.reduce((energy, value) => energy + value * value, 0) / window.length);
};

describe('ressonância offline da tabela', () => {
  it('não produz chiado nem som ao receber silêncio', () => {
    const output = extendCushionTail(new Float32Array(rate / 2), rate);
    expect(output.every((sample: number) => sample === 0)).toBe(true);
  });

  it('preserva o ataque e prolonga a batida com energia decrescente, não só silêncio', () => {
    const input = Float32Array.from(
      { length: rate / 4 },
      (_, i) => Math.exp(-i / (rate * 0.018)) * Math.cos((2 * Math.PI * 600 * i) / rate),
    );
    const output = extendCushionTail(input, rate);
    expect(output.length / rate).toBe(1.2);
    expect(output[0]).toBeCloseTo(input[0]!);
    expect(rms(output, 0.35, 0.5)).toBeGreaterThan(0.00001);
    expect(rms(output, 0.8, 1)).toBeLessThan(rms(output, 0.35, 0.5) / 10);
    expect(extendCushionTail(input, rate)).toEqual(output);
  });
});
