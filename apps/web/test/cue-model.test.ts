import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, BALL_RADIUS, createBall } from '@sinuca/core';
import { CUE_LENGTH, cueElevation } from '../src/render/CueModel';

describe('taco acima das bolas próximas', () => {
  it('mantém a inclinação habitual com espaço livre e ignora bolas encaçapadas', () => {
    const behind = createBall(1, 700 - BALL_DIAMETER, 600);
    behind.active = false;
    expect(cueElevation(700, 600, 0, 0, { x: 0, y: 0 }, [behind])).toBe(0.075);
  });

  it.each([
    0,
    Math.PI / 4,
    Math.PI / 2,
    (3 * Math.PI) / 4,
    Math.PI,
    -Math.PI / 4,
    -Math.PI / 2,
    (-3 * Math.PI) / 4,
  ])('não atravessa as bolas ao redor da branca, direção %s', (angle) => {
    const balls = Array.from({ length: 6 }, (_, i) =>
      createBall(
        i + 1,
        700 + Math.cos((i * Math.PI) / 3) * BALL_DIAMETER,
        600 + Math.sin((i * Math.PI) / 3) * BALL_DIAMETER,
      ),
    );
    for (const spin of [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ])
      for (const pull of [0, 120, 240]) {
        const tilt = cueElevation(700, 600, angle, pull, spin, balls);
        expect(Number.isFinite(tilt)).toBe(true);
        expect(tilt).toBeGreaterThanOrEqual(0.075);
        expect(tilt).toBeLessThanOrEqual(Math.PI / 2);
        const before = structuredClone(balls);
        const start = BALL_RADIUS + 6 + pull;
        for (const b of balls) {
          const bx = -(b.x - 700) * Math.cos(angle) - (b.y - 600) * Math.sin(angle);
          const by = -spin.y * BALL_RADIUS * 0.45;
          const bz =
            (b.x - 700) * Math.sin(angle) -
            (b.y - 600) * Math.cos(angle) +
            spin.x * BALL_RADIUS * 0.45;
          for (let s = 0; s <= CUE_LENGTH; s += 8) {
            const radius = 6.6 + 8 * Math.min(1, s / (CUE_LENGTH - 30));
            const distance = Math.hypot(
              bx - (start + s) * Math.cos(tilt),
              by - (start + s) * Math.sin(tilt),
              bz,
            );
            expect(distance).toBeGreaterThan(BALL_RADIUS + radius);
          }
        }
        expect(balls).toEqual(before);
      }
  });
});
