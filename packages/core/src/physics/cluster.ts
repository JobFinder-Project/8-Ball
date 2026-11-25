import type { Ball } from '../ball';
import { BALL_DIAMETER, type PhysicsParams } from '../constants';
import { CONTACT_TOLERANCE, resolveBallContact } from './collisions';
import type { SimulationEvents } from './events';
import { activateCueEffect } from './strike';

/** Resolve o grupo de contatos ligado ao impacto, com impulsos acumulados. */
export function resolveBallCluster(
  balls: readonly Ball[],
  pair: readonly [Ball, Ball],
  params: PhysicsParams,
  events: SimulationEvents,
): void {
  const contacts: {
    a: Ball;
    b: Ball;
    nx: number;
    ny: number;
    approach: number;
    impulse: number;
    target: number;
  }[] = [];
  for (let i = 0; i < balls.length; i++)
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]!,
        b = balls[j]!;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy);
      if (d < 1e-9 || d > BALL_DIAMETER + CONTACT_TOLERANCE) continue;
      const nx = dx / d,
        ny = dy / d;
      const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      contacts.push({
        a,
        b,
        nx,
        ny,
        approach,
        impulse: 0,
        target: -params.ballRestitution * Math.max(0, approach),
      });
    }
  const connected = new Set<Ball>(pair);
  let added = true;
  while (added) {
    added = false;
    for (const c of contacts)
      if (connected.has(c.a) !== connected.has(c.b)) {
        connected.add(c.a);
        connected.add(c.b);
        added = true;
      }
  }
  const group = contacts.filter((c) => connected.has(c.a) && connected.has(c.b));
  if (group.length < 2) {
    const speed = resolveBallContact(pair[0], pair[1], params);
    if (speed > 0) events.onBallContact?.(pair[0], pair[1], speed);
    return;
  }
  for (const c of group)
    if (c.approach > 1e-8) {
      activateCueEffect(c.a);
      activateCueEffect(c.b);
    }
  const members = [...connected];
  const meanX = members.reduce((sum, ball) => sum + ball.vx, 0) / members.length;
  const meanY = members.reduce((sum, ball) => sum + ball.vy, 0) / members.length;
  const relativeEnergy = () =>
    members.reduce((sum, ball) => sum + (ball.vx - meanX) ** 2 + (ball.vy - meanY) ** 2, 0);
  const before = relativeEnergy();
  const incoming = members.map((ball) => ({ ball, vx: ball.vx, vy: ball.vy }));
  let restitution = params.ballRestitution;
  // O alvo de restituição é o da chegada, não é recalculado a cada iteração.
  // Limita o impulso ACUMULADO, permitindo desfazer excessos de outra restrição.
  for (let attempt = 0; attempt < 9; attempt++) {
    for (const state of incoming) {
      state.ball.vx = state.vx;
      state.ball.vy = state.vy;
    }
    for (const c of group) {
      c.impulse = 0;
      c.target = -restitution * Math.max(0, c.approach);
    }
    for (let iteration = 0; iteration < 512; iteration++) {
      let largest = 0;
      for (const c of group) {
        const approach = (c.a.vx - c.b.vx) * c.nx + (c.a.vy - c.b.vy) * c.ny;
        const total = Math.max(0, c.impulse + (approach - c.target) / 2);
        const impulse = total - c.impulse;
        c.impulse = total;
        largest = Math.max(largest, Math.abs(impulse));
        c.a.vx -= impulse * c.nx;
        c.a.vy -= impulse * c.ny;
        c.b.vx += impulse * c.nx;
        c.b.vy += impulse * c.ny;
      }
      if (largest < 1e-8) break;
    }
    if (relativeEnergy() <= before + 1e-6) break;
    // Contatos que já se afastavam podem tornar a restituição múltipla
    // incompatível com passividade. Refaz apenas com menos restituição, até
    // compressão inelástica no último caso: não escala velocidades tangenciais
    // nem altera o momento linear/angular com uma correção arbitrária.
    restitution = attempt === 7 ? 0 : restitution * 0.5;
  }
  for (const c of group)
    if (c.impulse > 1e-7) {
      const speed = Math.max(c.approach, (2 * c.impulse) / (1 + restitution));
      events.onBallContact?.(c.a, c.b, speed);
    }
}
