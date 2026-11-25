import type { Ball } from '../ball';
import { BALL_DIAMETER, BALL_RADIUS } from '../constants';
import type { Segment } from '../table/types';
import { CONTACT_TOLERANCE } from './collisions';

/** Tempo de entrada em um círculo, com velocidade constante neste subpasso. */
function circleTime(x: number, y: number, vx: number, vy: number, radius: number, maxTime: number) {
  const speed2 = vx * vx + vy * vy;
  const dot = x * vx + y * vy;
  // Usa o mesmo limiar de velocidade normal do resolvedor (dot tem unidade
  // distância × velocidade), evitando eventos de tempo zero por resíduo do grupo.
  if (speed2 < 1e-16 || dot >= -radius * 1e-8) return Infinity;
  const distance2 = x * x + y * y;
  if (distance2 <= (radius + CONTACT_TOLERANCE) ** 2) return 0;
  const c = distance2 - radius * radius;
  const discriminant = dot * dot - speed2 * c;
  if (discriminant <= 0) return Infinity; // tangência exata não troca impulso
  // Forma estável da menor raiz, evitando cancelar dois números quase iguais.
  const time = c / (-dot + Math.sqrt(discriminant));
  return time >= 0 && time <= maxTime ? time : Infinity;
}

export function ballContactTime(a: Ball, b: Ball, maxTime: number): number {
  return circleTime(a.x - b.x, a.y - b.y, a.vx - b.vx, a.vy - b.vy, BALL_DIAMETER, maxTime);
}

/** Cápsula: duas faces paralelas e duas extremidades circulares. */
export function cushionContactTime(ball: Ball, s: Segment, maxTime: number): number {
  if (ball.vx === 0 && ball.vy === 0) return Infinity;
  const length = Math.sqrt(s.lengthSq);
  const tx = s.dx / length,
    ty = s.dy / length;
  const nx = -ty,
    ny = tx;
  const x = ball.x - s.x1,
    y = ball.y - s.y1;
  const along = x * tx + y * ty;
  const normal = x * nx + y * ny;
  const vn = ball.vx * nx + ball.vy * ny;
  const vt = ball.vx * tx + ball.vy * ty;
  let best = Math.min(
    circleTime(x, y, ball.vx, ball.vy, BALL_RADIUS, maxTime),
    circleTime(ball.x - s.x2, ball.y - s.y2, ball.vx, ball.vy, BALL_RADIUS, maxTime),
  );
  if (Math.abs(vn) > 1e-8) {
    const side = normal >= 0 ? 1 : -1;
    if (side * vn < 0) {
      const time = Math.max(0, (side * BALL_RADIUS - normal) / vn);
      const hitAlong = along + vt * time;
      if (time <= maxTime && hitAlong >= 0 && hitAlong <= length) best = Math.min(best, time);
    }
  }
  return best;
}
