import { CylinderGeometry, Group, Mesh, SphereGeometry, type Material } from 'three';
import { BALL_RADIUS, CUE_BALL, type Ball, type Spin } from '@sinuca/core';
import type { Materials } from './materials';

/** Comprimento do taco (58 pol). */
export const CUE_LENGTH = 1473;
const ELEVATION = 0.075;

/** Elevação visual mínima que deixa o taco inteiro acima das outras bolas. */
export function cueElevation(
  x: number,
  y: number,
  angle: number,
  pull: number,
  spin: Spin,
  balls: readonly Ball[],
): number {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  const start = BALL_RADIUS + 6 + pull;
  const clear = (elevation: number) => {
    const cos = Math.cos(elevation),
      sin = Math.sin(elevation);
    for (const ball of balls) {
      if (!ball.active || ball.id === CUE_BALL) continue;
      // Coordenadas relativas ao pivô do taco: +X para trás, Y para cima.
      const bx = -(ball.x - x) * dx - (ball.y - y) * dy;
      const by = -spin.y * BALL_RADIUS * 0.45;
      const bz = (ball.x - x) * dy - (ball.y - y) * dx + spin.x * BALL_RADIUS * 0.45;
      const along = Math.max(start, Math.min(start + CUE_LENGTH, bx * cos + by * sin));
      const distance = Math.hypot(bx - along * cos, by - along * sin, bz);
      // Limite conservador do raio da parte próxima ao contato (ponta → cabo).
      const radius = 6.6 + 8 * Math.min(1, (along - start + 45) / (CUE_LENGTH - 30));
      if (distance < BALL_RADIUS + radius + 2) return false;
    }
    return true;
  };
  if (clear(ELEVATION)) return ELEVATION;
  let low = ELEVATION,
    high = Math.PI / 2;
  for (let i = 0; i < 16; i++) {
    const middle = (low + high) / 2;
    if (clear(middle)) high = middle;
    else low = middle;
  }
  return high;
}

/**
 * Taco montado ao longo de +X local, da ponta (x = 0) ao cabo.
 * yaw: gira em torno da bola; pitch: inclina o taco como numa tacada real.
 */
export class CueModel {
  readonly root = new Group();
  private readonly pitch = new Group();
  private readonly body = new Group();

  constructor(mat: Materials) {
    this.root.add(this.pitch);
    this.pitch.add(this.body);
    this.pitch.rotation.z = ELEVATION;

    const part = (a: number, b: number, ra: number, rb: number, m: Material) => {
      const g = new CylinderGeometry(ra, rb, b - a, 40, 1);
      g.rotateZ(Math.PI / 2);
      g.translate((a + b) / 2, 0, 0);
      const mesh = new Mesh(g, m);
      mesh.castShadow = true;
      this.body.add(mesh);
    };
    // ponta arredondada de couro com giz
    const tipCap = new Mesh(
      new SphereGeometry(6.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mat.tip,
    );
    tipCap.rotation.z = Math.PI / 2;
    tipCap.position.x = 1;
    this.body.add(tipCap);
    part(1, 11, 6.4, 6.5, mat.tip);
    part(11, 33, 6.5, 6.6, mat.ferrule);
    part(33, 740, 6.6, 9.8, mat.shaft);
    part(740, 752, 9.8, 10.2, mat.ring);
    part(752, 760, 10.2, 10.3, mat.ferrule);
    part(760, 1000, 10.3, 11.6, mat.butt);
    part(1000, 1006, 11.6, 11.7, mat.ring);
    part(1006, 1260, 11.7, 13.4, mat.wrap);
    part(1260, 1266, 13.4, 13.5, mat.ring);
    part(1266, CUE_LENGTH - 14, 13.5, 14.6, mat.butt);
    part(CUE_LENGTH - 14, CUE_LENGTH, 14.6, 14.6, mat.bumper);
  }

  /** Posiciona o taco atrás da branca. `pull` é o recuo em mm (força da tacada). */
  update(
    x: number,
    y: number,
    angle: number,
    pull: number,
    spin: Spin,
    visible: boolean,
    balls: readonly Ball[] = [],
  ): void {
    this.root.visible = visible;
    if (!visible) return;
    this.root.position.set(x, BALL_RADIUS, y);
    this.root.rotation.y = Math.PI - angle;
    // Só apresentação: elevar o taco não introduz massé/desvio na física casual.
    this.pitch.rotation.z = cueElevation(x, y, angle, pull, spin, balls);
    this.pitch.position.set(0, spin.y * BALL_RADIUS * 0.45, -spin.x * BALL_RADIUS * 0.45);
    this.body.position.x = BALL_RADIUS + 6 + pull;
  }
}
