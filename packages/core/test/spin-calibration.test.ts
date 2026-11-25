import { describe, expect, it } from 'vitest';
import {
  activateCueEffect,
  applyClothFriction,
  applyCueStrike,
  BALL_DIAMETER,
  createSimulation,
  DEFAULT_CUE,
  DEFAULT_PHYSICS,
  isMoving,
  step,
  type Ball,
} from '../src';
import { layout, table } from './helpers';

const energy = (b: Ball) =>
  0.5 * (b.vx ** 2 + b.vy ** 2) + 0.2 * (b.ux ** 2 + b.uy ** 2 + b.side ** 2);

// Sem tabelas/caçapas: isola o efeito do primeiro choque e do feltro.
const isolated = { ...table, cushions: [], pockets: [] };

function fullHit(power: number, gap: number, spinY: number) {
  const balls = layout({ 0: [200, 600], 1: [200 + BALL_DIAMETER + gap, 600] });
  const cue = balls[0]!;
  const sim = createSimulation(isolated, balls);
  applyCueStrike(cue, { angle: 0, power, spin: { x: 0, y: spinY } });
  let contact: { x: number; incoming: number; ux: number } | null = null;
  for (let i = 0; i < 10000 && !contact; i++)
    step(sim, 0.001, {
      onBallContact: () => {
        if (contact) return;
        // O alvo parado recebe (1+e)/2 da velocidade de chegada.
        contact = {
          x: cue.x,
          incoming: (2 * balls[1]!.vx) / (1 + DEFAULT_PHYSICS.ballRestitution),
          ux: cue.ux,
        };
      },
    });
  if (!contact) throw new Error(`Sem contato: força=${power}, distância=${gap}`);
  const impact = contact as { x: number; incoming: number; ux: number };
  let previous = balls.reduce((sum, b) => sum + energy(b), 0);
  for (let i = 0; i < 600; i++) {
    step(sim);
    const current = balls.reduce((sum, b) => sum + energy(b), 0);
    expect(current).toBeLessThanOrEqual(previous + 1e-5);
    previous = current;
  }
  const early = { displacement: cue.x - impact.x, vx: cue.vx, y: cue.y };
  let steps = 0;
  while (isMoving(balls) && steps++ < 30000) {
    step(sim);
    const current = balls.reduce((sum, b) => sum + energy(b), 0);
    if (current > previous + 1e-5) throw new Error('Energia criada após o primeiro impacto');
    previous = current;
  }
  expect(steps).toBeLessThan(30000);
  return { ...impact, ...early, finalDisplacement: cue.x - impact.x };
}

describe('calibração de puxada e seguimento', () => {
  for (const power of [0.15, 0.35, 0.7, 1])
    it.each([1, 400, 1000])(
      'mantém o sentido e a progressão do controle: força ' + power + ', distância %s mm',
      (gap) => {
        const runs = [-1, -0.5, 0, 0.5, 1].map((spin) => fullHit(power, gap, spin));
        const max = DEFAULT_CUE.maxTipOffset * 2.5;
        expect(runs[0]!.ux / runs[0]!.incoming).toBeCloseTo(-max, 8);
        expect(runs[4]!.ux / runs[4]!.incoming).toBeCloseTo(max, 8);
        for (let i = 0; i < runs.length; i++) {
          expect(runs[i]!.y).toBeCloseTo(600, 9);
          if (i) {
            expect(runs[i]!.ux).toBeGreaterThan(runs[i - 1]!.ux);
            // Durante deslizamento de Coulomb a aceleração é constante: dois
            // giros fortes podem dar a mesma posição inicial, mas não o mesmo
            // alcance final. Não exigir uma diferença fisicamente inexistente.
            expect(runs[i]!.displacement).toBeGreaterThanOrEqual(runs[i - 1]!.displacement);
            expect(runs[i]!.finalDisplacement).toBeGreaterThan(runs[i - 1]!.finalDisplacement);
          }
        }
        for (const r of runs.slice(0, 2)) {
          expect(r.displacement).toBeLessThan(0);
          expect(r.vx).toBeLessThanOrEqual(0);
        }
        for (const r of runs.slice(3)) {
          expect(r.displacement).toBeGreaterThan(0);
          expect(r.vx).toBeGreaterThan(0);
        }
      },
    );

  it('a puxada parcial não vira seguimento após a aproximação entrar em rolamento', () => {
    const ball = layout({ 0: [500, 600] })[0]!;
    Object.assign(ball, { vx: 1000, ux: 1000, pendingEffect: { x: 0, y: -0.5, amount: 1.25 } });
    activateCueEffect(ball);
    expect(ball.ux).toBeCloseTo(-125, 10);
    expect(ball.vx).toBe(1000);
    expect(ball.pendingEffect).toBeUndefined();
  });

  it.each([0, 0.7, Math.PI / 2, Math.PI, -2.1])(
    'ativação do efeito respeita a direção da tacada (%s rad)',
    (angle) => {
      const ball = layout({ 0: [500, 600] })[0]!;
      const c = Math.cos(angle),
        s = Math.sin(angle);
      Object.assign(ball, { vx: 1000 * c, vy: 1000 * s, ux: 1000 * c, uy: 1000 * s });
      ball.pendingEffect = { x: 0.6, y: -0.8, amount: 1.25 };
      activateCueEffect(ball);
      expect(ball.ux).toBeCloseTo(-800 * c, 9);
      expect(ball.uy).toBeCloseTo(-800 * s, 9);
      expect(ball.side).toBeCloseTo(-750, 9);
    },
  );
});

describe('transição analítica de deslizamento para rolamento', () => {
  const p = { ...DEFAULT_PHYSICS, rollingFriction: 0, linearDamping: 0, sideSpinDecay: 0 };
  it.each([-2000, 0, 2000, 5000])('converge sem ultrapassar o rolamento, u inicial %s', (u) => {
    const ball = layout({ 0: [500, 600] })[0]!;
    ball.vx = 2000;
    ball.ux = u;
    // v_final = v_inicial - 2/7 (v_inicial - u_inicial).
    const final = ball.vx - (2 / 7) * (ball.vx - ball.ux);
    const sign = Math.sign(ball.vx - ball.ux);
    let slip = Math.abs(ball.vx - ball.ux),
      previous = energy(ball);
    for (let i = 0; i < 2000; i++) {
      applyClothFriction(ball, 0.001, p);
      const next = ball.vx - ball.ux;
      expect(Math.abs(next)).toBeLessThanOrEqual(slip + 1e-8);
      expect(next * sign).toBeGreaterThanOrEqual(-1e-8);
      expect(energy(ball)).toBeLessThanOrEqual(previous + 1e-5);
      slip = Math.abs(next);
      previous = energy(ball);
    }
    expect(ball.vx).toBeCloseTo(final, 7);
    expect(ball.ux).toBeCloseTo(final, 7);
  });

  it('deslizamento oblíquo conserva a combinação 5v+2u até atingir rolamento', () => {
    const ball = layout({ 0: [500, 600] })[0]!;
    Object.assign(ball, { vx: 1800, vy: -700, ux: -900, uy: 1400 });
    const ix = 5 * ball.vx + 2 * ball.ux,
      iy = 5 * ball.vy + 2 * ball.uy;
    for (let i = 0; i < 2000; i++) applyClothFriction(ball, 0.001, p);
    expect(ball.vx).toBeCloseTo(ix / 7, 7);
    expect(ball.vy).toBeCloseTo(iy / 7, 7);
    expect(ball.ux).toBeCloseTo(ball.vx, 9);
    expect(ball.uy).toBeCloseTo(ball.vy, 9);
  });
});
