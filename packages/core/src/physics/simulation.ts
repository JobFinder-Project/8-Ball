import type { Ball } from '../ball';
import { DEFAULT_PHYSICS, SIMULATION_STEP, type PhysicsParams } from '../constants';
import { orthonormalize } from '../math/mat3';
import type { Segment, TableGeometry } from '../table/types';
import { resolveBallContact, resolveCushionContact } from './collisions';
import { resolveBallCluster } from './cluster';
import type { SimulationEvents } from './events';
import { applyClothFriction } from './friction';
import { integrateOrientation } from './orientation';
import { detectPocket } from './pockets';
import { ballContactTime, cushionContactTime } from './sweep';

export interface Simulation {
  table: TableGeometry;
  balls: Ball[];
  params: PhysicsParams;
  steps: number;
}

export function createSimulation(
  table: TableGeometry,
  balls: Ball[],
  params: PhysicsParams = DEFAULT_PHYSICS,
): Simulation {
  return { table, balls, params, steps: 0 };
}

export function isMoving(balls: readonly Ball[]): boolean {
  for (const b of balls) if (b.active && (b.vx || b.vy || b.ux || b.uy || b.side)) return true;
  return false;
}

/** Avança a simulação um passo de `dt` segundos. */
export function step(
  sim: Simulation,
  dt: number = SIMULATION_STEP,
  events: SimulationEvents = {},
): void {
  const { balls, params, table } = sim;
  // Empates de tempo entre contatos não podem depender da cor/número das bolas
  // nem da ordem recebida do servidor. Mantém a lista pública intacta (índice=id).
  const contactOrder = balls.filter((ball) => ball.active).sort((a, b) => a.x - b.x || a.y - b.y);

  for (const ball of balls) {
    if (!ball.active) continue;
    applyClothFriction(ball, dt, params);
    integrateOrientation(ball, dt);
  }

  // Atrito/giro continuam em passos fixos; dentro de cada passo os impactos
  // ocorrem no instante de contato, não na normal de uma sobreposição tardia.
  let remaining = dt;
  for (let impacts = 0; remaining > 1e-12 && impacts < 64; impacts++) {
    let time = Infinity;
    let pair: [Ball, Ball] | null = null;
    let wall: { ball: Ball; segment: Segment } | null = null;
    for (let i = 0; i < contactOrder.length; i++) {
      const a = contactOrder[i]!;
      if (!a.active) continue;
      for (let j = i + 1; j < contactOrder.length; j++) {
        const b = contactOrder[j]!;
        if (!b.active) continue;
        const at = ballContactTime(a, b, remaining);
        if (at < time) {
          time = at;
          pair = [a, b];
          wall = null;
        }
      }
      if (a.vx === 0 && a.vy === 0) continue;
      for (const segment of table.cushions) {
        const at = cushionContactTime(a, segment, remaining);
        if (at < time) {
          time = at;
          wall = { ball: a, segment };
          pair = null;
        }
      }
    }
    if (!Number.isFinite(time)) break;
    move(time);
    remaining -= time;
    if (pair) {
      resolveBallCluster(contactOrder, pair, params, events);
    } else if (wall) {
      const speed = resolveCushionContact(wall.ball, wall.segment, params);
      if (speed > 0) events.onCushionContact?.(wall.ball, speed);
    }
  }
  move(remaining);

  function move(seconds: number) {
    for (const ball of balls)
      if (ball.active) {
        ball.x += ball.vx * seconds;
        ball.y += ball.vy * seconds;
      }
  }

  // Corrige também sobreposições preexistentes/contatos simultâneos no rack.
  for (let i = 0; i < contactOrder.length; i++) {
    const a = contactOrder[i]!;
    if (!a.active) continue;
    for (let j = i + 1; j < contactOrder.length; j++) {
      const b = contactOrder[j]!;
      if (!b.active) continue;
      const speed = resolveBallContact(a, b, params);
      if (speed > 0) events.onBallContact?.(a, b, speed);
    }
  }

  for (const ball of balls) {
    if (!ball.active) continue;
    for (const s of table.cushions) {
      const speed = resolveCushionContact(ball, s, params);
      if (speed > 0) events.onCushionContact?.(ball, speed);
    }
  }

  for (const ball of balls) {
    if (!ball.active) continue;
    const pocket = detectPocket(ball, table);
    if (pocket) {
      ball.active = false;
      ball.vx = ball.vy = ball.ux = ball.uy = ball.side = 0;
      delete ball.pendingEffect;
      events.onPocket?.(ball, pocket);
    }
  }

  if (++sim.steps % 400 === 0) for (const ball of balls) orthonormalize(ball.orientation);
}

/** Avança `elapsed` segundos em passos fixos. Retorna o tempo que sobrou (menor que um passo). */
export function advance(
  sim: Simulation,
  elapsed: number,
  events?: SimulationEvents,
  maxSteps = 80,
): number {
  let remaining = elapsed;
  let n = 0;
  while (remaining + 1e-12 >= SIMULATION_STEP && n < maxSteps) {
    step(sim, SIMULATION_STEP, events);
    remaining -= SIMULATION_STEP;
    n++;
  }
  return n >= maxSteps ? 0 : Math.max(0, remaining);
}

/** Roda até todas as bolas pararem. Útil para servidor, testes e IA. */
export function simulateUntilRest(
  sim: Simulation,
  events?: SimulationEvents,
  maxSeconds = 60,
): number {
  let t = 0;
  while (isMoving(sim.balls) && t < maxSeconds) {
    step(sim, SIMULATION_STEP, events);
    t += SIMULATION_STEP;
  }
  return t;
}
