import { describe, expect, it } from 'vitest';
import { createTableGeometry, TABLE_9FT, type Vec2 } from '@sinuca/core';
import { ShapeGeometry } from 'three';
import { shapeFrom } from '../src/render/shapes';
import { cutPocketOpening } from '../src/render/table/pocketContours';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
function contains(points: readonly Vec2[], point: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
describe('recorte geométrico das caçapas', () => {
  it.each([false, true])(
    'preserva o feltro ao redor e recorta somente a abertura (sentido invertido: %s)',
    (reverse) => {
      const polygon = reverse ? [...square].reverse() : square;
      const cut = cutPocketOpening(polygon, { x: 50, y: 0 }, 20);
      expect(contains(cut, { x: 50, y: 10 })).toBe(false);
      for (const point of [
        { x: 20, y: 5 },
        { x: 80, y: 5 },
        { x: 50, y: 25 },
        { x: 50, y: 90 },
      ])
        expect(contains(cut, point)).toBe(true);
    },
  );
  it('recorta o canto mesmo quando a região removida atravessa o fechamento do polígono', () => {
    const cut = cutPocketOpening(square, { x: 0, y: 0 }, 20);
    expect(contains(cut, { x: 5, y: 5 })).toBe(false);
    expect(contains(cut, { x: 25, y: 5 })).toBe(true);
    expect(contains(cut, { x: 5, y: 25 })).toBe(true);
  });
  it('mantém as gargantas da mesa e não desenha triângulos dentro das seis aberturas', () => {
    const table = createTableGeometry(TABLE_9FT);
    const outline = table.pockets.reduce(
      (points, p) => cutPocketOpening(points, p.center, p.radius),
      table.playfield,
    );
    const geometry = new ShapeGeometry(shapeFrom(outline));
    const positions = geometry.getAttribute('position'),
      index = geometry.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      const center = {
        x: ids.reduce((s, id) => s + positions.getX(id), 0) / 3,
        y: -ids.reduce((s, id) => s + positions.getY(id), 0) / 3,
      };
      for (const p of table.pockets)
        expect(Math.hypot(center.x - p.center.x, center.y - p.center.y)).toBeGreaterThan(
          p.radius - 0.05,
        );
    }
    // Esta faixa da garganta lateral era cortada pelo limite y=0 do shader.
    expect(contains(outline, { x: table.spec.length / 2 + 50, y: -15 })).toBe(true);
    expect(contains(outline, { x: table.spec.length / 2 - 50, y: -15 })).toBe(true);
  });
});
