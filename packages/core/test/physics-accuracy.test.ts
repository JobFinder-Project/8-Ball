import { describe, expect, it } from 'vitest';
import {
  applyCueStrike,
  BALL_DIAMETER,
  BALL_RADIUS,
  createSimulation,
  DEFAULT_PHYSICS,
  predictShot,
  resolveBallContact,
  resolveCushionContact,
  step,
  type Ball,
} from '../src';
import { layout, table } from './helpers';
const topRail = table.cushions.find((s) => s.y1 === 0 && s.y2 === 0 && s.x1 <= 500 && s.x2 >= 500)!;

const energy = (b: Ball) =>
  0.5 * (b.vx ** 2 + b.vy ** 2) + 0.2 * (b.ux ** 2 + b.uy ** 2 + b.side ** 2);

describe('precisão dos impactos e energia', () => {
  it('recupera centros coincidentes em repouso sem inventar um impacto', () => {
    const balls = layout({ 0: [700, 600], 1: [700, 600] });
    const speed = resolveBallContact(balls[0]!, balls[1]!, DEFAULT_PHYSICS);
    expect(speed).toBe(0);
    expect(Math.hypot(balls[1]!.x - balls[0]!.x, balls[1]!.y - balls[0]!.y)).toBeCloseTo(
      BALL_DIAMETER,
      7,
    );
    expect(balls.reduce((sum, b) => sum + energy(b), 0)).toBe(0);
  });

  it.each([false, true])(
    'normal de recuperação de centros coincidentes respeita o movimento (ordem invertida: %s)',
    (reverse) => {
      const balls = layout({ 0: [700, 600], 1: [700, 600] });
      balls[0]!.vx = 9000;
      balls[0]!.vy = 3000;
      const before = balls.reduce((sum, b) => sum + energy(b), 0);
      const [a, b] = reverse ? [balls[1]!, balls[0]!] : [balls[0]!, balls[1]!];
      expect(resolveBallContact(a, b, DEFAULT_PHYSICS)).toBeGreaterThan(0);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(BALL_DIAMETER, 7);
      expect(balls[1]!.vx).toBeGreaterThan(balls[0]!.vx);
      expect(balls.reduce((sum, ball) => sum + energy(ball), 0)).toBeLessThan(before);
      expect(resolveBallContact(a, b, DEFAULT_PHYSICS)).toBe(0);
    },
  );

  it.each([0.2, 0.5, 1])(
    'transfere movimento por três bolas encostadas sem sobreposição persistente (força %s)',
    (power) => {
      const balls = layout({
        0: [700, 600],
        1: [700 + BALL_DIAMETER, 600],
        2: [700 + 2 * BALL_DIAMETER, 600],
      });
      applyCueStrike(balls[0]!, { angle: 0, power, spin: { x: 0, y: 0 } });
      const sim = createSimulation(table, balls);
      const contacts = new Set<string>();
      const before = balls.reduce((sum, b) => sum + energy(b), 0);
      for (let i = 0; i < 100; i++)
        step(sim, 0.001, { onBallContact: (a, b) => contacts.add([a.id, b.id].sort().join('-')) });
      expect(contacts.has('0-1')).toBe(true);
      expect(contacts.has('1-2')).toBe(true);
      expect(balls[2]!.vx).toBeGreaterThan(0);
      for (let i = 1; i < balls.length; i++)
        expect(balls[i]!.x - balls[i - 1]!.x).toBeGreaterThanOrEqual(BALL_DIAMETER - 1e-6);
      expect(balls.reduce((sum, b) => sum + energy(b), 0)).toBeLessThan(before);
    },
  );
  it.each([0.2, 0.5, 1])('o corte real coincide com a normal prevista (força %s)', (power) => {
    const balls = layout({ 0: [500, 600], 1: [1000, 640] });
    const prediction = predictShot(balls, table, 0);
    if (prediction.kind !== 'ball') throw new Error('Esperava bola');
    applyCueStrike(balls[0]!, { angle: 0, power, spin: { x: 0, y: 0 } });
    const sim = createSimulation(table, balls);
    let direction: number | null = null;
    for (let i = 0; i < 5000 && direction === null; i++)
      step(sim, 0.001, {
        onBallContact: () => {
          direction = Math.atan2(balls[1]!.vy, balls[1]!.vx);
        },
      });
    expect(direction).not.toBeNull();
    expect(direction!).toBeCloseTo(
      Math.atan2(prediction.targetDirection.y, prediction.targetDirection.x),
      5,
    );
  });

  it('não perde um raspão rápido mesmo se não houver sobreposição ao final do passo', () => {
    const balls = layout({ 0: [500, 600], 1: [504.5, 600 + BALL_DIAMETER - 0.01] });
    balls[0]!.vx = 9000;
    const sim = createSimulation(table, balls, {
      ...DEFAULT_PHYSICS,
      slidingFriction: 0,
      rollingFriction: 0,
      linearDamping: 0,
    });
    let contacts = 0;
    step(sim, 0.001, { onBallContact: () => contacts++ });
    expect(contacts).toBe(1);
    expect(balls[1]!.vy).toBeGreaterThan(0);
  });

  it('usa a velocidade relativa quando as duas bolas estão em movimento', () => {
    const balls = layout({ 0: [500, 600], 1: [565, 600] });
    balls[0]!.vx = 9000;
    balls[1]!.vx = -9000;
    const sim = createSimulation(table, balls, {
      ...DEFAULT_PHYSICS,
      slidingFriction: 0,
      rollingFriction: 0,
      linearDamping: 0,
    });
    const before = balls.reduce((sum, b) => sum + energy(b), 0);
    let contacts = 0;
    step(sim, 0.001, {
      onBallContact: (a, b) => {
        contacts++;
        expect(b.x - a.x).toBeCloseTo(BALL_DIAMETER, 7);
      },
    });
    expect(contacts).toBe(1);
    expect(balls[0]!.vx).toBeLessThan(0);
    expect(balls[1]!.vx).toBeGreaterThan(0);
    expect(balls.reduce((sum, b) => sum + energy(b), 0)).toBeLessThan(before);
  });

  it('resolve o contato na ponta de um bico pela normal exata, não pela posição final', () => {
    const wall = { x1: 1000, y1: 500, x2: 1200, y2: 500, dx: 200, dy: 0, lengthSq: 40000 };
    const y = 500 + BALL_RADIUS - 0.01;
    const balls = layout({ 0: [995.5, y] });
    balls[0]!.vx = 9000;
    const sim = createSimulation({ ...table, cushions: [wall], pockets: [] }, balls, {
      ...DEFAULT_PHYSICS,
      slidingFriction: 0,
      rollingFriction: 0,
      linearDamping: 0,
    });
    let contacts = 0;
    step(sim, 0.001, {
      onCushionContact: (ball) => {
        contacts++;
        expect(ball.x).toBeCloseTo(1000 - Math.sqrt(BALL_RADIUS ** 2 - (y - 500) ** 2), 7);
        expect(Math.hypot(ball.x - 1000, ball.y - 500)).toBeCloseTo(BALL_RADIUS, 7);
      },
    });
    expect(contacts).toBe(1);
    expect(balls[0]!.vy).toBeGreaterThan(0);
  });

  it('um rebote não cria energia com giro contrário ao deslocamento tangencial', () => {
    const ball = layout({ 0: [500, BALL_RADIUS - 0.001] })[0]!;
    ball.vx = 9000;
    ball.vy = -100;
    ball.side = 11000;
    const wall = topRail;
    const before = energy(ball);
    resolveCushionContact(ball, wall, DEFAULT_PHYSICS);
    expect(energy(ball)).toBeLessThanOrEqual(before + 1e-6);
  });

  it.each([-1, 1])('o sinal do giro na tabela corresponde ao ponto do taco (%s)', (side) => {
    const ball = layout({ 0: [500, BALL_RADIUS - 0.001] })[0]!;
    applyCueStrike(ball, { angle: -Math.PI / 2, power: 0.5, spin: { x: side, y: 0 } });
    resolveCushionContact(ball, topRail, DEFAULT_PHYSICS);
    expect(Math.sign(ball.vx)).toBe(side);
  });

  it('nenhuma combinação da matriz de rebotes cria energia', () => {
    for (const vx of [-9000, -1000, 0, 1000, 9000])
      for (const vy of [-9000, -1000, -100])
        for (const side of [-11250, -5000, 0, 5000, 11250]) {
          const ball = layout({ 0: [500, BALL_RADIUS - 0.001] })[0]!;
          Object.assign(ball, { vx, vy, side, ux: 4500, uy: -3000 });
          const before = energy(ball);
          resolveCushionContact(ball, topRail, DEFAULT_PHYSICS);
          expect(energy(ball)).toBeLessThanOrEqual(before + 1e-6);
          expect(ball.vy).toBeGreaterThan(0);
        }
  });

  it.each([
    [-1000, 0],
    [0, 1000],
  ])('não repete impactos ao se afastar/tangenciar (%s,%s)', (vx, vy) => {
    const balls = layout({ 0: [500, 600], 1: [500 + BALL_DIAMETER, 600] });
    Object.assign(balls[0]!, { vx, vy });
    const sim = createSimulation(table, balls, {
      ...DEFAULT_PHYSICS,
      slidingFriction: 0,
      rollingFriction: 0,
      linearDamping: 0,
    });
    let contacts = 0;
    for (let i = 0; i < 10; i++) step(sim, 0.001, { onBallContact: () => contacts++ });
    expect(contacts).toBe(0);
  });
});
