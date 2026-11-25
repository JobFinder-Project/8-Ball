import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, createRandom } from '@sinuca/core';
import { GameController } from '../src/game/GameController';

type Point = { x: number; y: number };

/** Associação ótima (Hungarian): trocar números/cores nunca conta como variedade. */
function matchingRms(a: Point[], b: Point[]): number {
  const n = a.length;
  const u = new Float64Array(n + 1),
    v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1),
    way = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const min = new Float64Array(n + 1).fill(Infinity);
    const used = new Uint8Array(n + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0]!;
      let delta = Infinity,
        j1 = 0;
      for (let j = 1; j <= n; j++)
        if (!used[j]) {
          const cost =
            (a[i0 - 1]!.x - b[j - 1]!.x) ** 2 + (a[i0 - 1]!.y - b[j - 1]!.y) ** 2 - u[i0]! - v[j]!;
          if (cost < min[j]!) {
            min[j] = cost;
            way[j] = j0;
          }
          if (min[j]! < delta) {
            delta = min[j]!;
            j1 = j;
          }
        }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else min[j]! -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0);
  }
  return Math.sqrt(Math.max(0, -v[0]!) / n);
}

describe('repetição da saída pelo jogador', () => {
  it('a comparação geométrica ignora permutações e mede deslocamentos conhecidos', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
    ];
    expect(matchingRms(points, [...points].reverse())).toBe(0);
    expect(matchingRms(points, points.map((p) => ({ x: p.x + 3, y: p.y + 4 })).reverse())).toBe(5);
  });

  it('novas partidas com os mesmos controles não repetem a sequência de movimentos', () => {
    const game = new GameController(undefined, createRandom(7331));
    const trajectories: string[] = [];
    const perInstant = Array.from({ length: 6 }, () => new Set<string>());
    for (let attempt = 0; attempt < 12; attempt++) {
      if (attempt > 0) game.newGame();
      expect({ x: game.cueBall.x, y: game.cueBall.y }).toEqual(game.table.headSpot);
      expect(game.aim).toBe(0);
      expect(game.spin).toEqual({ x: 0, y: 0 });
      game.setPower(1);
      expect(game.shoot()).toBe(true);
      const frames: string[] = [];
      for (let instant = 0; instant < 6; instant++) {
        for (let tick = 0; tick < 250; tick++) game.tick(0.001);
        // Ignora números/cores: compara apenas a coreografia geométrica,
        // arredondada a 1 mm, após 0,25 / 0,5 / ... / 1,5 segundos.
        const frame = game.balls
          .filter((b) => b.active)
          .map((b) => [Math.round(b.x), Math.round(b.y)])
          .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
          .join(';');
        perInstant[instant]!.add(frame);
        frames.push(frame);
      }
      trajectories.push(frames.join('|'));
    }
    expect(new Set(trajectories).size).toBe(12);
    for (const frames of perInstant) expect(frames.size).toBe(12);
  }, 20000);

  it('varia o percurso perceptivelmente, não apenas milímetros ou a rotação do triângulo', () => {
    const game = new GameController(undefined, createRandom(7331));
    const runs: Point[][][] = [];
    for (let attempt = 0; attempt < 32; attempt++) {
      if (attempt) game.newGame();
      const apex = game.balls[1]!,
        eight = game.balls[8]!;
      const angle = Math.atan2(eight.y - apex.y, eight.x - apex.x);
      const c = Math.cos(angle),
        s = Math.sin(angle);
      game.setPower(1);
      expect(game.shoot()).toBe(true);
      const frames: Point[][] = [];
      for (let instant = 0; instant < 3; instant++) {
        for (let tick = 0; tick < 500; tick++) game.tick(0.001);
        // Retira a rotação global; ignora branca, IDs, texturas e cores.
        // Inclui centros nas caçapas para manter associação de todas as 15 bolas.
        frames.push(
          game.balls.slice(1).map((b) => {
            const x = b.x - game.table.footSpot.x,
              y = b.y - game.table.footSpot.y;
            return { x: x * c + y * s, y: -x * s + y * c };
          }),
        );
      }
      runs.push(frames);
    }
    const distances: number[] = [];
    for (let i = 0; i < runs.length; i++)
      for (let j = 0; j < i; j++)
        distances.push(
          runs[i]!.reduce((sum, frame, k) => sum + matchingRms(frame, runs[j]![k]!), 0) / 3,
        );
    distances.sort((a, b) => a - b);
    // Diferença média em 0,5 / 1 / 1,5 s, em diâmetros de bola, não pixels.
    expect(distances[0]).toBeGreaterThan(BALL_DIAMETER / 2);
    expect(distances[Math.floor(distances.length / 2)]).toBeGreaterThan(2 * BALL_DIAMETER);
    expect(distances.filter((d) => d > BALL_DIAMETER).length / distances.length).toBeGreaterThan(
      0.95,
    );
  }, 30000);
});
