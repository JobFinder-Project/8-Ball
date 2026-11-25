import type { Ball } from '../ball';
import { DEFAULT_CUE, type CueParams } from '../constants';
import { clamp } from '../math/scalar';

export interface Spin {
  /** -1 (esquerda) a 1 (direita). */
  x: number;
  /** -1 (embaixo, puxa) a 1 (em cima, segue). */
  y: number;
}

export interface ShotInput {
  /** Direção da tacada em radianos, no plano da mesa. */
  angle: number;
  /** 0 a 1. */
  power: number;
  spin: Spin;
}

/** Parâmetros do lançamento casual, sem modificar nenhuma bola. */
export function cueLaunch(input: ShotInput, params: CueParams = DEFAULT_CUE) {
  const power = clamp(input.power, 0, 1);
  let sx = clamp(input.spin.x, -1, 1);
  let sy = clamp(input.spin.y, -1, 1);
  const radius = Math.hypot(sx, sy);
  if (radius > 1) {
    sx /= radius;
    sy /= radius;
  }
  const speed = params.minSpeed + power * (params.maxSpeed - params.minSpeed);
  // Regra do jogo casual: o efeito não muda a trajetória/atrito antes do contato.
  const angle = input.angle;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  const offset = params.maxTipOffset * 2.5;
  return {
    angle,
    speed,
    vx: dx * speed,
    vy: dy * speed,
    ux: 0,
    uy: 0,
    side: 0,
    effect: { x: sx, y: sy, amount: offset },
  };
}

/** Consome o efeito uma única vez, com intensidade relativa à velocidade de chegada. */
export function activateCueEffect(ball: Ball): void {
  const effect = ball.pendingEffect;
  if (!effect) return;
  const speed = Math.hypot(ball.vx, ball.vy);
  // Soma o efeito escolhido ao rolamento natural adquirido no feltro.
  // Efeito zero não apaga o giro natural nem muda uma tacada neutra.
  ball.ux += ball.vx * effect.y * effect.amount;
  ball.uy += ball.vy * effect.y * effect.amount;
  // Ponto à direita do eixo do taco produz torque negativo em torno de z.
  ball.side = -speed * effect.x * effect.amount;
  delete ball.pendingEffect;
}

/**
 * Impacto do taco na branca.
 * Batendo a uma altura b do centro: ω = 5·v·b / (2·R²) ⇒ u = R·ω = 2,5·v·(b/R).
 * Modelo casual: sai na direção da mira, sem efeito selecionado no percurso inicial.
 * A rotação escolhida fica reservada até o primeiro contato com bola ou tabela.
 * Não inclui squirt, swerve ou massé. Depois da ativação, o giro evolui pelo atrito.
 * Retorna a velocidade de saída em mm/s.
 */
export function applyCueStrike(
  cue: Ball,
  input: ShotInput,
  params: CueParams = DEFAULT_CUE,
): number {
  const launch = cueLaunch(input, params);
  cue.vx = launch.vx;
  cue.vy = launch.vy;
  cue.ux = launch.ux;
  cue.uy = launch.uy;
  cue.side = launch.side;
  cue.pendingEffect = launch.effect;
  return launch.speed;
}
