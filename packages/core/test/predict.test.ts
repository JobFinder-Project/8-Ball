import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, BALL_RADIUS, predictShot } from '../src';
import { layout, table } from './helpers';

describe('linha de mira', () => {
  it('bola cheia: a bola fantasma encosta na bola alvo', () => {
    const balls = layout({ 0: [500, 600], 1: [1000, 600] });
    const p = predictShot(balls, table, 0);
    expect(p.kind).toBe('ball');
    if (p.kind !== 'ball') return;
    expect(p.ghost.x).toBeCloseTo(1000 - BALL_DIAMETER, 3);
    expect(p.targetDirection.x).toBeCloseTo(1, 5);
    expect(p.fullness).toBeCloseTo(1, 5);
  });

  it('corte: alvo e branca saem em direções perpendiculares', () => {
    const balls = layout({ 0: [500, 600], 1: [1000, 630] });
    const p = predictShot(balls, table, 0);
    if (p.kind !== 'ball') throw new Error('esperava contato com bola');
    const dot = p.targetDirection.x * p.cueDirection.x + p.targetDirection.y * p.cueDirection.y;
    expect(dot).toBeCloseTo(0, 6);
  });

  it('sem bolas no caminho, informa a tabela e o reflexo', () => {
    const balls = layout({ 0: [500, 600] });
    const p = predictShot(balls, table, -Math.PI / 2);
    expect(p.kind).toBe('cushion');
    if (p.kind !== 'cushion') return;
    expect(p.ghost.y).toBeCloseTo(28.575, 1);
    expect(p.reflected.y).toBeCloseTo(1, 5);
  });

  it.each([0, 0.001, 0.1, 1])(
    'reconhece uma bola com folga de %s mm antes de outro alvo',
    (gap) => {
      const balls = layout({ 0: [500, 600], 1: [500 + BALL_DIAMETER + gap, 600], 2: [1000, 600] });
      const p = predictShot(balls, table, 0);
      if (p.kind !== 'ball') throw new Error('esperava contato com bola');
      expect(p.target.id).toBe(1);
      expect(p.ghost.x).toBeCloseTo(500 + gap, 6);
      expect(p.fullness).toBeCloseTo(1, 6);
    },
  );

  it.each([0, -0.001, -0.05])(
    'trata contato/sobreposição de %s mm sem direções inválidas',
    (gap) => {
      const balls = layout({ 0: [500, 600], 1: [500 + BALL_DIAMETER + gap, 600] });
      const p = predictShot(balls, table, Math.PI / 6);
      if (p.kind !== 'ball') throw new Error('esperava contato inicial');
      expect(p.ghost).toEqual({ x: 500, y: 600 });
      expect(Math.hypot(p.targetDirection.x, p.targetDirection.y)).toBeCloseTo(1, 8);
      expect(p.fullness).toBeCloseTo(Math.cos(Math.PI / 6), 8);
      expect(
        p.targetDirection.x * p.cueDirection.x + p.targetDirection.y * p.cueDirection.y,
      ).toBeCloseTo(0, 8);
    },
  );

  it.each([Math.PI / 2, -Math.PI / 2, Math.PI])(
    'não bloqueia ao mirar tangente/para longe (%s rad)',
    (angle) => {
      const balls = layout({ 0: [500, 600], 1: [500 + BALL_DIAMETER, 600] });
      expect(predictShot(balls, table, angle).kind).toBe('cushion');
    },
  );

  it('ao se afastar da bola encostada, encontra outro alvo na direção da mira', () => {
    const balls = layout({ 0: [700, 600], 1: [700 + BALL_DIAMETER, 600], 2: [400, 600] });
    const p = predictShot(balls, table, Math.PI);
    if (p.kind !== 'ball') throw new Error('esperava o alvo à esquerda');
    expect(p.target.id).toBe(2);
    expect(p.ghost.x).toBeCloseTo(400 + BALL_DIAMETER, 6);
  });

  it.each([0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 3])(
    'reconhece contato em diferentes orientações (%s rad)',
    (angle) => {
      const balls = layout({
        0: [900, 600],
        1: [900 + Math.cos(angle) * BALL_DIAMETER, 600 + Math.sin(angle) * BALL_DIAMETER],
      });
      const p = predictShot(balls, table, angle);
      if (p.kind !== 'ball') throw new Error('esperava contato inicial');
      expect(p.target.id).toBe(1);
      expect(p.ghost.x).toBeCloseTo(900, 6);
      expect(p.ghost.y).toBeCloseTo(600, 6);
    },
  );

  it('ignora uma bola encaçapada mesmo se sua posição coincidir com um contato', () => {
    const balls = layout({ 0: [500, 600], 1: [500 + BALL_DIAMETER, 600], 2: [1000, 600] });
    balls[1]!.active = false;
    const p = predictShot(balls, table, 0);
    if (p.kind !== 'ball') throw new Error('esperava outro alvo');
    expect(p.target.id).toBe(2);
  });

  it.each([0, 0.001, 0.1])('reconhece tabela com folga %s mm sem atravessá-la', (gap) => {
    const balls = layout({ 0: [500, BALL_RADIUS + gap] });
    const prediction = predictShot(balls, table, -Math.PI / 2);
    expect(prediction.kind).toBe('cushion');
    expect(prediction.ghost.y).toBeCloseTo(BALL_RADIUS, 7);
  });

  it('permite afastar da tabela encostada sem marcar contato inicial falso', () => {
    const balls = layout({ 0: [500, BALL_RADIUS] });
    const prediction = predictShot(balls, table, Math.PI / 2);
    expect(prediction.ghost.y).toBeCloseTo(table.spec.width - BALL_RADIUS, 7);
  });
});
