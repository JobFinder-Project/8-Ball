import { describe, expect, it } from 'vitest';
import {
  advance,
  applyCueStrike,
  BALL_DIAMETER,
  createSimulation,
  cueLaunch,
  DEFAULT_CUE,
  DEFAULT_PHYSICS,
  isMoving,
  predictShot,
  resolveBallContact,
  resolveCushionContact,
  step,
  stopBall,
  type Spin,
} from '../src';
import { layout, table } from './helpers';

const spins: Spin[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 0.98, y: -0.15 },
];

describe('efeito casual ativado somente no primeiro impacto', () => {
  it.each([0.15, 0.5, 1])(
    'lançamento lateral tem o mesmo ângulo independentemente da força (%s)',
    (power) => {
      const launch = cueLaunch({ angle: 0.7, power, spin: { x: 1, y: 0 } });
      expect(launch.angle).toBe(0.7);
      expect([launch.ux, launch.uy, launch.side]).toEqual([0, 0, 0]);
      expect(launch.effect.x).toBe(1);
    },
  );

  it('limita a distância radial do ponto do taco mesmo com entradas diagonais', () => {
    const launch = cueLaunch({ angle: 0, power: 1, spin: { x: 1, y: 1 } });
    expect(Math.hypot(launch.effect.x, launch.effect.y)).toBeCloseTo(1, 10);
    expect(launch.effect.amount).toBe(DEFAULT_CUE.maxTipOffset * 2.5);
  });

  for (const power of [0.2, 0.5, 1])
    it.each(spins)(
      'primeiro impacto coincide com a mira na força ' + power + ' e efeito %j',
      (spin) => {
        const balls = layout({ 0: [700, 600], 1: [1100, 625] });
        const input = { angle: 0, power, spin };
        const prediction = predictShot(balls, table, input.angle);
        expect(prediction.kind).toBe('ball');
        applyCueStrike(balls[0]!, input);
        const sim = createSimulation(table, balls);
        let found = false;
        for (let i = 0; i < 5000 && !found; i++)
          step(sim, 0.001, {
            onBallContact: (a, b) => {
              found = true;
              const p = prediction;
              if (p.kind !== 'ball') throw new Error('Sem alvo');
              expect(p.ghost.x).toBeCloseTo(balls[0]!.x, 6);
              expect(p.ghost.y).toBeCloseTo(balls[0]!.y, 6);
              const target = a.id === 0 ? b : a,
                l = Math.hypot(target.vx, target.vy);
              expect(p.targetDirection.x).toBeCloseTo(target.vx / l, 6);
              expect(p.targetDirection.y).toBeCloseTo(target.vy / l, 6);
            },
          });
        expect(found).toBe(true);
      },
    );

  it('regressão do vídeo: o efeito não muda a aproximação nem o primeiro alvo', () => {
    const angle = Math.atan2(1100 - 220, 160 - 2000);
    const contact = (spin: Spin) => {
      const balls = layout({ 0: [2000, 220], 1: [160, 1100] });
      const sim = createSimulation(table, balls);
      applyCueStrike(balls[0]!, { angle, power: 1, spin });
      let snapshot: number[] | null = null;
      for (let i = 0; i < 2000 && !snapshot; i++)
        step(sim, 0.001, {
          onBallContact: () => {
            snapshot = [balls[0]!.x, balls[0]!.y, balls[1]!.vx, balls[1]!.vy];
          },
        });
      expect(snapshot).not.toBeNull();
      return snapshot;
    };
    expect(contact({ x: 0.98, y: -0.15 })).toEqual(contact({ x: 0, y: 0 }));
  });

  it.each(spins)('antes do impacto, posição e velocidade independem do efeito %j', (spin) => {
    const run = (chosen: Spin) => {
      const balls = layout({ 0: [700, 600], 1: [1800, 600] });
      const cue = balls[0]!;
      applyCueStrike(cue, { angle: 0, power: 0.5, spin: chosen });
      const sim = createSimulation(table, balls);
      for (let i = 0; i < 100; i++) step(sim);
      expect(cue.pendingEffect).toBeDefined();
      expect(cue.side).toBe(0);
      return [cue.x, cue.y, cue.vx, cue.vy, cue.ux, cue.uy];
    };
    expect(run(spin)).toEqual(run({ x: 0, y: 0 }));
  });

  it('consome o efeito no primeiro contato e não o reaplica nos seguintes', () => {
    const balls = layout({ 0: [700, 600], 1: [1100, 600] });
    const cue = balls[0]!;
    applyCueStrike(cue, { angle: 0, power: 0.5, spin: { x: 0.8, y: -0.6 } });
    const sim = createSimulation(table, balls);
    let first = false;
    for (let i = 0; i < 1000 && !first; i++)
      step(sim, 0.001, {
        onBallContact: () => {
          first = true;
          expect(cue.pendingEffect).toBeUndefined();
          expect(cue.side).toBeLessThan(0);
          expect(cue.ux).toBeLessThan(0);
        },
      });
    expect(first).toBe(true);
    const side = cue.side;
    // Outro impacto cheio não deve reinicializar o giro com a velocidade nova.
    balls[1]!.x = cue.x + BALL_DIAMETER;
    balls[1]!.y = cue.y;
    balls[1]!.vx = -2000;
    step(sim);
    expect(cue.pendingEffect).toBeUndefined();
    expect(cue.side).toBeGreaterThan(side);
    expect(cue.side).toBeLessThan(0);
  });

  it('descarta o efeito reservado se a branca parar sem tocar em nada', () => {
    const balls = layout({ 0: [700, 600] });
    const cue = balls[0]!;
    applyCueStrike(cue, { angle: 0, power: 0.01, spin: { x: 0, y: -1 } });
    const sim = createSimulation(table, balls);
    for (let i = 0; i < 5000 && isMoving(balls); i++) step(sim);
    expect(isMoving(balls)).toBe(false);
    expect(cue.pendingEffect).toBeUndefined();
  });

  it('efeito neutro não apaga o rolamento natural no contato', () => {
    const cue = layout({ 0: [700, 600] })[0]!;
    applyCueStrike(cue, { angle: 0, power: 0.5, spin: { x: 0, y: 0 } });
    cue.ux = 1200;
    const target = layout({ 1: [700 + BALL_DIAMETER, 600] })[0]!;
    resolveBallContact(cue, target, DEFAULT_PHYSICS);
    expect(cue.ux).toBe(1200);
    expect(cue.pendingEffect).toBeUndefined();
  });

  it.each([-1, 1])('ativa o efeito já no primeiro rebote de tabela (%s)', (x) => {
    const cue = layout({ 0: [500, 28.575] })[0]!;
    applyCueStrike(cue, { angle: -Math.PI / 2, power: 0.5, spin: { x, y: 0 } });
    expect(cue.side).toBe(0);
    resolveCushionContact(cue, table.cushions[1]!, DEFAULT_PHYSICS);
    expect(cue.pendingEffect).toBeUndefined();
    expect(Math.sign(cue.vx)).toBe(x);
  });

  it('a caçapa descarta efeito reservado, sem ativá-lo', () => {
    const balls = layout({ 0: [1270, 200] });
    const cue = balls[0]!;
    applyCueStrike(cue, { angle: -Math.PI / 2, power: 0.3, spin: { x: 1, y: 0 } });
    let contacts = 0;
    const sim = createSimulation(table, balls);
    for (let i = 0; i < 3000 && cue.active; i++)
      step(sim, 0.001, {
        onCushionContact: () => contacts++,
        onBallContact: () => contacts++,
      });
    expect(cue.active).toBe(false);
    expect(contacts).toBe(0);
    expect(cue.pendingEffect).toBeUndefined();
    expect(cue.side).toBe(0);
  });

  it('recolocar/parar a branca não deixa efeito de uma tacada anterior', () => {
    const cue = layout({ 0: [700, 600] })[0]!;
    applyCueStrike(cue, { angle: 0, power: 1, spin: { x: 1, y: 0 } });
    stopBall(cue);
    expect(cue.pendingEffect).toBeUndefined();
  });

  for (const power of [0.2, 0.5, 1])
    it.each([-1, 1])('sentido vertical %s é mantido após contato na força ' + power, (y) => {
      const balls = layout({ 0: [700, 600], 1: [1100, 600] });
      applyCueStrike(balls[0]!, { angle: 0, power, spin: { x: 0, y } });
      const sim = createSimulation(table, balls);
      let found = false,
        rotation = 0;
      for (let i = 0; i < 3000 && !found; i++)
        step(sim, 0.001, {
          onBallContact: () => {
            found = true;
            rotation = balls[0]!.ux;
          },
        });
      expect(found).toBe(true);
      expect(rotation * y).toBeGreaterThan(0);
    });

  it('deixa o giro lateral dissipar, em vez de congelá-lo ao parar a translação', () => {
    const ball = layout({ 0: [500, 600] })[0]!;
    ball.side = 100;
    const sim = createSimulation(table, [ball]);
    expect(isMoving([ball])).toBe(true);
    for (let i = 0; i < 50; i++) step(sim);
    expect(ball.side).toBe(0);
    expect(isMoving([ball])).toBe(false);
  });

  it('a frequência dos quadros não muda a simulação em passos fixos', () => {
    const snapshots = [30, 60, 120].map((fps) => {
      const balls = layout({ 0: [500, 600], 1: [1000, 640] });
      const sim = createSimulation(table, balls, { ...DEFAULT_PHYSICS });
      applyCueStrike(balls[0]!, { angle: 0, power: 0.5, spin: { x: 0.4, y: -0.6 } });
      let accumulator = 0;
      for (let i = 0; i < fps; i++) accumulator = advance(sim, accumulator + 1 / fps);
      return {
        steps: sim.steps,
        balls: balls.map((b) => [b.x, b.y, b.vx, b.vy, b.ux, b.uy, b.side]),
      };
    });
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
  });
});
