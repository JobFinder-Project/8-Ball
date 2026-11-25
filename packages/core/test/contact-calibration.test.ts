import { describe, expect, it } from 'vitest';
import {
  BALL_DIAMETER,
  BALL_RADIUS,
  createSimulation,
  DEFAULT_PHYSICS,
  resolveCushionContact,
  step,
  type Ball,
  type Segment,
} from '../src';
import { layout, table } from './helpers';

const energy = (b: Ball) =>
  0.5 * (b.vx ** 2 + b.vy ** 2) + 0.2 * (b.ux ** 2 + b.uy ** 2 + b.side ** 2);
const passive = {
  ...DEFAULT_PHYSICS,
  slidingFriction: 0,
  rollingFriction: 0,
  linearDamping: 0,
  sideSpinDecay: 0,
};
const isolated = { ...table, cushions: [], pockets: [] };

describe('cortes e colisões com as duas bolas em movimento', () => {
  for (const movingTarget of [false, true])
    it.each([150, 900, 3000, 9000])(
      'confere normal, tangente, energia e momento: alvo móvel ' + movingTarget + ', velocidade %s',
      (speed) => {
        for (const degrees of [-170, -90, -60, -15, 0, 15, 60, 90, 170]) {
          const angle = (degrees * Math.PI) / 180;
          const nx = Math.cos(angle),
            ny = Math.sin(angle),
            tx = -ny,
            ty = nx;
          const av = { x: speed * (0.8 * nx + 0.7 * tx), y: speed * (0.8 * ny + 0.7 * ty) };
          const bv = movingTarget
            ? { x: speed * (-0.2 * nx - 0.3 * tx), y: speed * (-0.2 * ny - 0.3 * ty) }
            : { x: 0, y: 0 };
          const toi = 0.0005;
          const balls = layout({
            0: [1000 - av.x * toi, 600 - av.y * toi],
            1: [1000 + BALL_DIAMETER * nx - bv.x * toi, 600 + BALL_DIAMETER * ny - bv.y * toi],
          });
          const [a, b] = balls as [Ball, Ball];
          Object.assign(a, { vx: av.x, vy: av.y, ux: 700, uy: -400, side: 800 });
          Object.assign(b, { vx: bv.x, vy: bv.y, ux: -500, uy: 200, side: -600 });
          const incoming = balls.map((ball) => ({ ...ball }));
          const before = energy(a) + energy(b);
          const approach = (av.x - bv.x) * nx + (av.y - bv.y) * ny;
          const impulse = ((1 + passive.ballRestitution) * approach) / 2;
          let events = 0;
          step(createSimulation(isolated, balls, passive), 0.001, {
            onBallContact: () => {
              events++;
              expect(a.x).toBeCloseTo(1000, 7);
              expect(a.y).toBeCloseTo(600, 7);
              expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(BALL_DIAMETER, 7);
            },
          });
          expect(events).toBe(1);
          expect(a.vx).toBeCloseTo(av.x - impulse * nx, 7);
          expect(a.vy).toBeCloseTo(av.y - impulse * ny, 7);
          expect(b.vx).toBeCloseTo(bv.x + impulse * nx, 7);
          expect(b.vy).toBeCloseTo(bv.y + impulse * ny, 7);
          expect(a.vx + b.vx).toBeCloseTo(av.x + bv.x, 7);
          expect(a.vy + b.vy).toBeCloseTo(av.y + bv.y, 7);
          expect(energy(a) + energy(b)).toBeLessThanOrEqual(before + 1e-5);
          for (let i = 0; i < 2; i++) {
            const ball = balls[i]!,
              old = incoming[i]!;
            expect(ball.vx * tx + ball.vy * ty).toBeCloseTo(old.vx * tx + old.vy * ty, 7);
            expect([ball.ux, ball.uy, ball.side]).toEqual([old.ux, old.uy, old.side]);
          }
        }
      },
    );
});

describe('giro lateral e perda de energia na tabela', () => {
  for (const speed of [300, 1500, 6000])
    it.each([0, 15, 45, 75])(
      'respeita atrito e simetria: velocidade ' + speed + ', incidência %s°',
      (degrees) => {
        for (const sideRatio of [-1.25, -0.5, 0, 0.5, 1.25]) {
          const angle = (degrees * Math.PI) / 180;
          const vn = -speed * Math.cos(angle),
            vt = speed * Math.sin(angle);
          const side = speed * sideRatio;
          let reference: { normal: number; tangent: number; side: number } | null = null;
          // Quatro orientações e ambas as ordens dos endpoints do segmento.
          for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
            for (const reverse of [false, true]) {
              const nx = Math.cos(rotation),
                ny = Math.sin(rotation),
                tx = -ny,
                ty = nx;
              const x1 = 1200 - 200 * tx,
                y1 = 600 - 200 * ty;
              const x2 = 1200 + 200 * tx,
                y2 = 600 + 200 * ty;
              const segment: Segment = reverse
                ? { x1: x2, y1: y2, x2: x1, y2: y1, dx: x1 - x2, dy: y1 - y2, lengthSq: 160000 }
                : { x1, y1, x2, y2, dx: x2 - x1, dy: y2 - y1, lengthSq: 160000 };
              const ball = layout({ 0: [1200 + nx * BALL_RADIUS, 600 + ny * BALL_RADIUS] })[0]!;
              Object.assign(ball, {
                vx: vn * nx + vt * tx,
                vy: vn * ny + vt * ty,
                side,
                ux: 300 * nx,
                uy: 300 * ny,
              });
              const before = energy(ball),
                slip = vt - side;
              expect(resolveCushionContact(ball, segment, DEFAULT_PHYSICS)).toBeCloseTo(-vn, 7);
              const normal = ball.vx * nx + ball.vy * ny,
                tangent = ball.vx * tx + ball.vy * ty;
              const impulse = tangent - vt;
              expect(normal).toBeCloseTo(-vn * DEFAULT_PHYSICS.cushionRestitution, 7);
              expect(Math.abs(impulse)).toBeLessThanOrEqual(
                DEFAULT_PHYSICS.cushionFriction * (1 + DEFAULT_PHYSICS.cushionRestitution) * -vn +
                  1e-7,
              );
              expect(ball.side - side).toBeCloseTo(-2.5 * impulse, 7);
              expect(Math.abs(tangent - ball.side)).toBeLessThanOrEqual(Math.abs(slip) + 1e-7);
              expect((tangent - ball.side) * slip).toBeGreaterThanOrEqual(-1e-5);
              expect(energy(ball)).toBeLessThanOrEqual(before + 1e-5);
              if (reference) {
                expect(normal).toBeCloseTo(reference.normal, 7);
                expect(tangent).toBeCloseTo(reference.tangent, 7);
                expect(ball.side).toBeCloseTo(reference.side, 7);
              } else reference = { normal, tangent, side: ball.side };
              // Apenas um impulso por aproximação: um contato já saindo não repete som/efeito.
              expect(resolveCushionContact(ball, segment, DEFAULT_PHYSICS)).toBe(0);
            }
        }
      },
    );
});
