import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, DEFAULT_PHYSICS, createRandom, createRack } from '../src';
import { resolveBallCluster } from '../src/physics/cluster';
import { layout, table } from './helpers';
const energy = (balls: ReturnType<typeof layout>) =>
  balls.reduce((s, b) => s + 0.5 * (b.vx * b.vx + b.vy * b.vy), 0);
const momentum = (balls: ReturnType<typeof layout>) => [
  balls.reduce((s, b) => s + b.vx, 0),
  balls.reduce((s, b) => s + b.vy, 0),
];

describe('grupo de contatos simultâneos', () => {
  it('um impacto cheio entre duas bolas simétricas não favorece um lado', () => {
    const balls = layout({
      0: [700, 600],
      1: [700 + (Math.sqrt(3) / 2) * BALL_DIAMETER, 600 - BALL_DIAMETER / 2],
      2: [700 + (Math.sqrt(3) / 2) * BALL_DIAMETER, 600 + BALL_DIAMETER / 2],
    });
    balls[0]!.vx = 9000;
    const before = energy(balls),
      p = momentum(balls);
    resolveBallCluster(balls, [balls[0]!, balls[1]!], DEFAULT_PHYSICS, {});
    expect(balls[0]!.vy).toBeCloseTo(0, 5);
    expect(balls[1]!.vx).toBeCloseTo(balls[2]!.vx, 5);
    expect(balls[1]!.vy).toBeCloseTo(-balls[2]!.vy, 5);
    expect(energy(balls)).toBeLessThan(before);
    const after = momentum(balls);
    expect(after[0]).toBeCloseTo(p[0]!, 6);
    expect(after[1]).toBeCloseTo(p[1]!, 6);
  });

  it.each([0, 0.5, 0.94, 1])(
    'grupo passivo conserva momento e não cria energia (restituição %s)',
    (restitution) => {
      const random = createRandom(17);
      for (let trial = 0; trial < 32; trial++) {
        const balls = layout({
          0: [700, 600],
          1: [700 + BALL_DIAMETER, 600],
          2: [700 + 2 * BALL_DIAMETER, 600],
        });
        for (const b of balls) {
          b.vx = (random() * 2 - 1) * 9000;
          b.vy = (random() * 2 - 1) * 9000;
        }
        const before = energy(balls),
          p = momentum(balls);
        const tangents = balls.map((b) => b.vy);
        const angularBefore = balls.reduce((s, b) => s + b.x * b.vy - b.y * b.vx, 0);
        resolveBallCluster(
          balls,
          [balls[0]!, balls[1]!],
          { ...DEFAULT_PHYSICS, ballRestitution: restitution },
          {},
        );
        expect(energy(balls)).toBeLessThanOrEqual(before + 1e-4);
        const after = momentum(balls);
        expect(after[0]).toBeCloseTo(p[0]!, 6);
        expect(after[1]).toBeCloseTo(p[1]!, 6);
        expect(balls.map((b) => b.vy)).toEqual(tangents);
        expect(balls.reduce((s, b) => s + b.x * b.vy - b.y * b.vx, 0)).toBeCloseTo(
          angularBefore,
          5,
        );
      }
    },
  );

  it('transmite o impulso pelo rack fechado sem deixar contatos se aproximando', () => {
    const balls = createRack(table, createRandom(5));
    balls[0]!.x = balls[1]!.x - BALL_DIAMETER;
    balls[0]!.y = balls[1]!.y;
    balls[0]!.vx = 9000;
    const before = energy(balls),
      p = momentum(balls);
    let events = 0;
    resolveBallCluster(balls, [balls[0]!, balls[1]!], DEFAULT_PHYSICS, {
      onBallContact: () => events++,
    });
    expect(events).toBeGreaterThan(2);
    expect(events).toBeLessThanOrEqual(31);
    expect(energy(balls)).toBeLessThan(before);
    const after = momentum(balls);
    expect(after[0]).toBeCloseTo(p[0]!, 6);
    expect(after[1]).toBeCloseTo(p[1]!, 6);
    for (let i = 0; i < balls.length; i++)
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]!,
          b = balls[j]!,
          dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy);
        if (d > BALL_DIAMETER + 1e-6) continue;
        expect(((a.vx - b.vx) * dx + (a.vy - b.vy) * dy) / d).toBeLessThan(1e-5);
      }
  });
});
