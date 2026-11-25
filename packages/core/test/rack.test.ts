import { describe, expect, it } from 'vitest';
import {
  BALL_DIAMETER,
  createRack,
  createRandom,
  createSimulation,
  applyCueStrike,
  step,
  isMoving,
  ShotRecorder,
  groupOf,
  RACK_ROTATION_LIMIT,
  RACK_SETTLING,
} from '../src';
import { table } from './helpers';

describe('montagem do triângulo', () => {
  it.each([1, 2, 3, 4, 5, 27, 32, 100])(
    'rack fechado, legal e sem sobreposição (semente %s)',
    (seed) => {
      const balls = createRack(table, createRandom(seed));
      expect(balls.map((b) => b.id)).toEqual(Array.from({ length: 16 }, (_, id) => id));
      expect({ x: balls[0]!.x, y: balls[0]!.y }).toEqual(table.headSpot);
      expect({ x: balls[1]!.x, y: balls[1]!.y }).toEqual(table.footSpot);
      const objects = balls.slice(1);
      let contacts = 0;
      for (let i = 0; i < objects.length; i++)
        for (let j = i + 1; j < objects.length; j++) {
          const a = objects[i]!,
            b = objects[j]!;
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          expect(distance).toBeGreaterThanOrEqual(BALL_DIAMETER - 1e-8);
          if (Math.abs(distance - BALL_DIAMETER) < 1e-8) contacts++;
        }
      // Rede apoiada, não a mesma malha rígida de 30 contatos em toda partida.
      expect(contacts).toBeGreaterThanOrEqual(14);
      expect(contacts).toBeLessThan(30);
      const connected = new Set([balls[1]!]);
      for (let pass = 0; pass < 15; pass++)
        for (const a of objects)
          if ([...connected].some((b) => Math.hypot(a.x - b.x, a.y - b.y) <= BALL_DIAMETER + 1e-8))
            connected.add(a);
      expect(connected.size).toBe(15);
      const eight = balls[8]!,
        apex = balls[1]!;
      expect(
        Math.abs(Math.hypot(eight.x - apex.x, eight.y - apex.y) - Math.sqrt(3) * BALL_DIAMETER),
      ).toBeLessThan(4 * RACK_SETTLING);
      const angle = Math.atan2(eight.y - apex.y, eight.x - apex.x);
      expect(Math.abs(angle)).toBeLessThanOrEqual(RACK_ROTATION_LIMIT + 0.01);
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const back = objects.filter(
        (b) =>
          (b.x - apex.x) * cos + (b.y - apex.y) * sin > ((3.9 * Math.sqrt(3)) / 2) * BALL_DIAMETER,
      );
      back.sort((a, b) => a.y - b.y);
      expect(back).toHaveLength(5);
      expect(groupOf(back[0]!.id)).not.toBe(groupOf(back[4]!.id));
    },
  );

  it('a mesma semente repete a montagem, mas outras sementes mudam a geometria', () => {
    const rack = createRack(table, createRandom(1));
    expect(createRack(table, createRandom(1))).toEqual(rack);
    const other = createRack(table, createRandom(2));
    const geometry = (balls: ReturnType<typeof createRack>) =>
      balls
        .slice(1)
        .map((b) => [b.x, b.y])
        .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
    expect(geometry(other)).not.toEqual(geometry(rack));
  });

  it('mil montagens ficam compactas, apoiadas e sem sobreposição', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const objects = createRack(table, createRandom(seed)).slice(1);
      const apex = objects.find((b) => b.id === 1)!,
        eight = objects.find((b) => b.id === 8)!;
      const angle = Math.atan2(eight.y - apex.y, eight.x - apex.x);
      const c = Math.cos(angle),
        s = Math.sin(angle);
      const local = objects
        .map((b) => {
          const dx = b.x - apex.x,
            dy = b.y - apex.y;
          return { x: dx * c + dy * s, y: -dx * s + dy * c };
        })
        .sort((a, b) => a.x - b.x || a.y - b.y);
      const connected = new Set([0]);
      for (let i = 0; i < local.length; i++) {
        const a = local[i]!;
        const row = Math.round(a.x / ((Math.sqrt(3) / 2) * BALL_DIAMETER));
        expect(Math.abs(a.x - ((row * Math.sqrt(3)) / 2) * BALL_DIAMETER)).toBeLessThan(1);
        const column = Math.round(a.y / BALL_DIAMETER + row / 2);
        expect(Math.abs(a.y - (column - row / 2) * BALL_DIAMETER)).toBeLessThan(1);
        for (let j = 0; j < i; j++) {
          const b = local[j]!,
            d = Math.hypot(a.x - b.x, a.y - b.y);
          expect(d).toBeGreaterThanOrEqual(BALL_DIAMETER - 1e-8);
          if (connected.has(j) && d <= BALL_DIAMETER + 1e-8) connected.add(i);
        }
      }
      expect(connected.size).toBe(15);
    }
  });

  it('replay da mesma semente é reprodutível para validação, sem sortear forças durante a tacada', () => {
    const original = createRack(table, createRandom(10));
    const copies = [structuredClone(original), structuredClone(original)];
    for (const balls of copies) {
      const sim = createSimulation(table, balls);
      applyCueStrike(balls[0]!, { angle: 0, power: 1, spin: { x: 0, y: 0 } });
      for (let i = 0; i < 1000; i++) step(sim);
    }
    expect(copies[0]).toEqual(copies[1]);
  });

  it('saída padrão tem dispersão, variação entre montagens e não força falta da branca', () => {
    let scratches = 0,
      near = 0;
    const layouts = new Set<string>();
    const count = 16;
    for (let seed = 1; seed <= count; seed++) {
      const balls = createRack(table, createRandom(seed));
      const sim = createSimulation(table, balls);
      const recorder = new ShotRecorder(false);
      const energy = () =>
        balls.reduce(
          (sum, b) =>
            sum +
            0.5 * (b.vx * b.vx + b.vy * b.vy) +
            0.2 * (b.ux * b.ux + b.uy * b.uy + b.side * b.side),
          0,
        );
      applyCueStrike(balls[0]!, { angle: 0, power: 1, spin: { x: 0, y: 0 } });
      let previous = energy(),
        steps = 0;
      while (isMoving(balls) && steps < 15000) {
        step(sim, 0.001, recorder);
        steps++;
        const current = energy();
        if (current > previous + 1e-4)
          throw new Error('Energia criada na saída da semente ' + seed);
        previous = current;
      }
      expect(steps).toBeLessThan(15000);
      expect(recorder.record.firstContact).toBe(1);
      expect(recorder.record.ballsToCushion.size).toBeGreaterThanOrEqual(4);
      if (!balls[0]!.active) scratches++;
      const objects = balls.filter((b) => b.id !== 0 && b.active);
      near += objects.filter(
        (b) => Math.hypot(b.x - table.footSpot.x, b.y - table.footSpot.y) < 300,
      ).length;
      layouts.add(
        objects
          .map((b) => [Math.round(b.x), Math.round(b.y)])
          .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
          .join(';'),
      );
      for (let i = 0; i < objects.length; i++)
        for (let j = i + 1; j < objects.length; j++) {
          expect(
            Math.hypot(objects[i]!.x - objects[j]!.x, objects[i]!.y - objects[j]!.y),
          ).toBeGreaterThan(BALL_DIAMETER - 0.5);
        }
    }
    expect(scratches).toBeLessThan(count);
    expect(near / count).toBeLessThan(4);
    expect(layouts.size).toBeGreaterThan(count / 2);
  }, 20000);

  it('trocar apenas os números das bolas não muda a física da saída', () => {
    const original = createRack(table, createRandom(4));
    const swapped = structuredClone(original)
      .map((b) => ({ ...b, id: b.id === 0 ? 0 : 16 - b.id }))
      .sort((a, b) => a.id - b.id);
    const run = (balls: typeof original) => {
      const sim = createSimulation(table, balls);
      applyCueStrike(balls[0]!, { angle: 0, power: 1, spin: { x: 0, y: 0 } });
      for (let i = 0; i < 500; i++) step(sim);
    };
    run(original);
    run(swapped);
    for (const b of original) {
      const other = swapped.find((s) => s.id === (b.id === 0 ? 0 : 16 - b.id))!;
      for (const field of ['x', 'y', 'vx', 'vy', 'ux', 'uy', 'side'] as const)
        expect(other[field]).toBeCloseTo(b[field], 6);
      expect(other.active).toBe(b.active);
    }
  });
});
