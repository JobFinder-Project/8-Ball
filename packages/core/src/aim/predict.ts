import { CUE_BALL, type Ball } from '../ball';
import { BALL_DIAMETER, BALL_RADIUS } from '../constants';
import type { Segment, TableGeometry } from '../table/types';

export type ShotPrediction =
  | {
      kind: 'ball';
      /** Centro da branca no momento do contato ("bola fantasma"). */
      ghost: { x: number; y: number };
      target: Ball;
      /** Direção que a bola atingida vai tomar. */
      targetDirection: { x: number; y: number };
      /** Direção da branca após o contato (linha tangente), sem considerar o giro. */
      cueDirection: { x: number; y: number };
      /** cos do ângulo de corte: 1 = bola cheia, 0 = raspão. */
      fullness: number;
    }
  | {
      kind: 'cushion';
      ghost: { x: number; y: number };
      reflected: { x: number; y: number };
    }
  | { kind: 'none'; ghost: { x: number; y: number } };

const CONTACT_EPS = 1e-7;

function rayCircle(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
): number {
  const fx = cx - ox;
  const fy = cy - oy;
  const t = fx * dx + fy * dy;
  // Contato inicial (inclusive leve penetração numérica) bloqueia só ao avançar
  // contra o obstáculo. Tangenciar ou se afastar não é uma nova colisão.
  if (Math.hypot(fx, fy) <= r + CONTACT_EPS) return t > 1e-9 ? 0 : Infinity;
  const p2 = fx * fx + fy * fy - t * t;
  if (p2 > r * r) return Infinity;
  const t0 = t - Math.sqrt(r * r - p2);
  // Uma folga pequena ainda é um contato futuro válido.
  return t0 >= 0 ? t0 : Infinity;
}

/** Distância até a branca encostar na cápsula da tabela. */
function rayCushion(ox: number, oy: number, dx: number, dy: number, s: Segment): number {
  const l = Math.sqrt(s.lengthSq);
  const tx = s.dx / l,
    ty = s.dy / l;
  const nx = -ty,
    ny = tx;
  const x = ox - s.x1,
    y = oy - s.y1;
  const normal = x * nx + y * ny;
  const vn = dx * nx + dy * ny;
  let face = Infinity;
  const side = normal >= 0 ? 1 : -1;
  if (side * vn < -1e-9) {
    const t = Math.max(0, (side * BALL_RADIUS - normal) / vn);
    const along = (x + dx * t) * tx + (y + dy * t) * ty;
    if (along >= 0 && along <= l) face = t;
  }
  return Math.min(
    face,
    rayCircle(ox, oy, dx, dy, s.x1, s.y1, BALL_RADIUS),
    rayCircle(ox, oy, dx, dy, s.x2, s.y2, BALL_RADIUS),
  );
}

/**
 * Traça a trajetória da branca em linha reta e informa o primeiro contato.
 * É geometria pura (sem atrito ou giro), igual à linha de mira de uma mesa real.
 */
export function predictShot(
  balls: readonly Ball[],
  table: TableGeometry,
  angle: number,
): ShotPrediction {
  const cue = balls.find((b) => b.id === CUE_BALL)!;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  let tBall = Infinity;
  let hit: Ball | null = null;
  for (const b of balls) {
    if (!b.active || b.id === CUE_BALL) continue;
    const t = rayCircle(cue.x, cue.y, dx, dy, b.x, b.y, BALL_DIAMETER);
    if (t < tBall) {
      tBall = t;
      hit = b;
    }
  }

  let tCushion = Infinity;
  let wall: Segment | null = null;
  for (const s of table.cushions) {
    const t = rayCushion(cue.x, cue.y, dx, dy, s);
    if (t < tCushion) {
      tCushion = t;
      wall = s;
    }
  }

  if (hit && tBall <= tCushion) {
    const gx = cue.x + dx * tBall;
    const gy = cue.y + dy * tBall;
    // No contato inicial pode haver leve sobreposição: usa uma normal unitária.
    const distance = Math.hypot(hit.x - gx, hit.y - gy) || 1;
    const nx = (hit.x - gx) / distance;
    const ny = (hit.y - gy) / distance;
    const fullness = Math.max(0, Math.min(1, dx * nx + dy * ny));
    return {
      kind: 'ball',
      ghost: { x: gx, y: gy },
      target: hit,
      targetDirection: { x: nx, y: ny },
      cueDirection: { x: dx - fullness * nx, y: dy - fullness * ny },
      fullness,
    };
  }

  if (wall) {
    const gx = cue.x + dx * tCushion;
    const gy = cue.y + dy * tCushion;
    let t = ((gx - wall.x1) * wall.dx + (gy - wall.y1) * wall.dy) / wall.lengthSq;
    t = Math.max(0, Math.min(1, t));
    let nx = gx - (wall.x1 + wall.dx * t);
    let ny = gy - (wall.y1 + wall.dy * t);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const dn = dx * nx + dy * ny;
    return {
      kind: 'cushion',
      ghost: { x: gx, y: gy },
      reflected: { x: dx - 2 * dn * nx, y: dy - 2 * dn * ny },
    };
  }

  return {
    kind: 'none',
    ghost: { x: cue.x + dx * table.spec.length, y: cue.y + dy * table.spec.length },
  };
}
