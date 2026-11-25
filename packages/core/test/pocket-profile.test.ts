import { describe, expect, it } from 'vitest';
import { BALL_RADIUS, createSimulation, detectPocket, step } from '../src';
import { layout, table } from './helpers';

describe('perfil das caçapas', () => {
  it('todas as faces visíveis dos bicos têm segmentos físicos coincidentes', () => {
    expect(table.cushionShapes).toHaveLength(6);
    for (const shape of table.cushionShapes) {
      // Cinco pontos em cada curva, mais a face reta e dois pontos do fundo.
      expect(shape).toHaveLength(12);
      for (let i = 0; i < 9; i++) {
        const a = shape[i]!,
          b = shape[i + 1]!;
        expect(
          table.cushions.some((s) => s.x1 === a.x && s.y1 === a.y && s.x2 === b.x && s.y2 === b.y),
        ).toBe(true);
      }
    }
  });

  it.each([0, 1, 2, 3, 4, 5])(
    'abertura %s aceita entrada central e não captura lateral distante',
    (id) => {
      const p = table.pockets[id]!;
      const ball = layout({ 0: [p.throat.x - p.axis.x * 400, p.throat.y - p.axis.y * 400] })[0]!;
      ball.vx = p.axis.x * 1500;
      ball.vy = p.axis.y * 1500;
      const sim = createSimulation(table, [ball]);
      let captured = -1;
      for (let i = 0; i < 2000 && ball.active; i++)
        step(sim, 0.001, { onPocket: (_b, pocket) => (captured = pocket.id) });
      expect(captured).toBe(id);
      const far = layout({
        0: [
          p.throat.x + p.axis.x * 2 - p.axis.y * (p.radius + BALL_RADIUS),
          p.throat.y + p.axis.y * 2 + p.axis.x * (p.radius + BALL_RADIUS),
        ],
      })[0]!;
      expect(detectPocket(far, { ...table, pockets: [p] })).toBeNull();
    },
  );

  it.each([0, 1, 2, 3, 4, 5])('bico próximo da caçapa %s bloqueia a bola', (id) => {
    const pocket = table.pockets[id]!;
    const jaw = table.cushions
      .filter(
        (s) =>
          s.lengthSq < 4000 &&
          Math.hypot((s.x1 + s.x2) / 2 - pocket.center.x, (s.y1 + s.y2) / 2 - pocket.center.y) <
            160,
      )
      .reduce((best, s) => {
        const distance = (v: typeof s) =>
          Math.hypot((v.x1 + v.x2) / 2 - pocket.center.x, (v.y1 + v.y2) / 2 - pocket.center.y);
        return distance(s) > distance(best) ? s : best;
      });
    const x = (jaw.x1 + jaw.x2) / 2,
      y = (jaw.y1 + jaw.y2) / 2;
    const length = Math.sqrt(jaw.lengthSq);
    let nx = -jaw.dy / length,
      ny = jaw.dx / length;
    if (nx * (table.centerSpot.x - x) + ny * (table.centerSpot.y - y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const ball = layout({ 0: [x + nx * (BALL_RADIUS + 8), y + ny * (BALL_RADIUS + 8)] })[0]!;
    ball.vx = -nx * 800;
    ball.vy = -ny * 800;
    const sim = createSimulation(table, [ball]);
    let contacts = 0;
    for (let i = 0; i < 100 && !contacts && ball.active; i++)
      step(sim, 0.001, { onCushionContact: () => contacts++ });
    expect(contacts).toBeGreaterThan(0);
    expect(ball.active).toBe(true);
    expect(ball.vx * nx + ball.vy * ny).toBeGreaterThan(0);
  });
});
