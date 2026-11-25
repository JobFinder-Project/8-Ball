import type { Ball } from '../ball';
import { BALL_DIAMETER, BALL_RADIUS, type PhysicsParams } from '../constants';
import type { Segment } from '../table/types';
import { activateCueEffect } from './strike';

export const CONTACT_TOLERANCE = 1e-6;

/**
 * Colisão entre duas bolas de massa igual.
 * Separa a sobreposição e troca a componente normal da velocidade com restituição e.
 * O giro (u) não muda no impacto instantâneo, e é isso que produz o "seguir" e o "puxar":
 * a branca para no choque, mas o giro que ela carrega a acelera em seguida.
 * Retorna a velocidade relativa de aproximação (0 se não houve impacto).
 */
export function resolveBallContact(a: Ball, b: Ball, p: PhysicsParams): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > (BALL_DIAMETER + CONTACT_TOLERANCE) ** 2) return 0;

  const d = Math.sqrt(d2);
  let nx: number, ny: number;
  if (d > 1e-9) {
    nx = dx / d;
    ny = dy / d;
  } else {
    // Estado degenerado: a linha dos centros não existe. Usa o movimento
    // relativo; em repouso, IDs dão uma separação estável sob troca da ordem.
    const vx = a.vx - b.vx,
      vy = a.vy - b.vy;
    const speed = Math.hypot(vx, vy);
    nx = speed > 1e-8 ? vx / speed : a.id < b.id ? 1 : -1;
    ny = speed > 1e-8 ? vy / speed : 0;
  }
  const overlap = Math.max(0, BALL_DIAMETER - d) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;

  const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (approach <= 1e-8) return 0;

  const j = ((1 + p.ballRestitution) / 2) * approach;
  activateCueEffect(a);
  activateCueEffect(b);
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
  return approach;
}

/**
 * Colisão com a tabela (segmento tratado como cápsula de raio R).
 * Reflete a componente normal com restituição, transfere o efeito lateral para a
 * componente tangente e inverte parcialmente o rolamento contra a tabela.
 * Retorna a velocidade normal do impacto (0 se não houve).
 */
export function resolveCushionContact(ball: Ball, s: Segment, p: PhysicsParams): number {
  let t = ((ball.x - s.x1) * s.dx + (ball.y - s.y1) * s.dy) / s.lengthSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = s.x1 + s.dx * t;
  const qy = s.y1 + s.dy * t;
  const ex = ball.x - qx;
  const ey = ball.y - qy;
  const d2 = ex * ex + ey * ey;
  if (d2 > (BALL_RADIUS + CONTACT_TOLERANCE) ** 2) return 0;

  const d = Math.sqrt(d2) || 1e-6;
  const nx = ex / d;
  const ny = ey / d;
  ball.x = qx + nx * BALL_RADIUS;
  ball.y = qy + ny * BALL_RADIUS;

  const vn = ball.vx * nx + ball.vy * ny;
  if (vn >= -1e-8) return 0;

  // O inglês precisa ser ativado neste contato para influenciar seu rebote.
  activateCueEffect(ball);

  ball.vx -= (1 + p.cushionRestitution) * vn * nx;
  ball.vy -= (1 + p.cushionRestitution) * vn * ny;

  const tx = -ny,
    ty = nx;
  // Velocidade da superfície no contato com a borracha: vt - R·ωz.
  // I=2/5·mR² ⇒ massa efetiva tangencial = m/3,5. O impulso troca
  // translação/giro e é limitado pelo impacto normal, sem inventar energia.
  const slip = ball.vx * tx + ball.vy * ty - ball.side;
  const limit = p.cushionFriction * (1 + p.cushionRestitution) * -vn;
  const impulse = Math.max(-limit, Math.min(limit, -slip / 3.5));
  ball.vx += tx * impulse;
  ball.vy += ty * impulse;
  ball.side -= 2.5 * impulse;

  const un = ball.ux * nx + ball.uy * ny;
  ball.ux -= (1 + p.cushionRollReversal) * un * nx;
  ball.uy -= (1 + p.cushionRollReversal) * un * ny;
  return -vn;
}
