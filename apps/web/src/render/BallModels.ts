import { CircleGeometry, Group, Mesh, Quaternion, SphereGeometry } from 'three';
import { BALL_RADIUS } from '@sinuca/core';
import type { GameController } from '../game/GameController';
import { orientationToQuaternion } from './coords';
import { createBallTexture } from './textures/ballTexture';
import { createBallMaterial, createBallShadowMaterial } from './BallMaterial';

/** Bolas 3D com acabamento de resina estilizado e sombras de contato no feltro. */
export class BallModels {
  readonly group = new Group();
  private readonly meshes: Mesh[] = [];
  private readonly shadows: Mesh[] = [];
  private readonly q = new Quaternion();

  constructor(maxAnisotropy: number) {
    const geometry = new SphereGeometry(BALL_RADIUS, 64, 48);
    const shadowGeometry = new CircleGeometry(BALL_RADIUS * 1.35, 48).rotateX(-Math.PI / 2);
    const shadowMaterial = createBallShadowMaterial();
    for (let id = 0; id < 16; id++) {
      const material = createBallMaterial(createBallTexture(id, maxAnisotropy));
      const m = new Mesh(geometry, material);
      m.name = `ball-${id}`;
      this.meshes.push(m);
      this.group.add(m);
      const shadow = new Mesh(shadowGeometry, shadowMaterial);
      shadow.name = `ball-shadow-${id}`;
      this.shadows.push(shadow);
      this.group.add(shadow);
    }
  }

  update(game: GameController): void {
    for (const ball of game.balls) {
      const m = this.meshes[ball.id]!;
      const shadow = this.shadows[ball.id]!;
      shadow.visible = ball.active;
      shadow.position.set(ball.x + 2, 0.4, ball.y + 3);
      if (ball.active) {
        m.visible = true;
        m.position.set(ball.x, BALL_RADIUS, ball.y);
        m.quaternion.copy(orientationToQuaternion(ball.orientation, this.q));
        m.scale.setScalar(1);
      } else {
        m.visible = false;
      }
    }
    for (const f of game.falling) {
      const m = this.meshes[f.ball.id]!;
      const k = f.t;
      const ease = k * k;
      m.visible = true;
      m.position.set(
        f.from.x + (f.pocket.center.x - f.from.x) * Math.min(1, k * 1.6),
        BALL_RADIUS - ease * 160,
        f.from.y + (f.pocket.center.y - f.from.y) * Math.min(1, k * 1.6),
      );
    }
  }

  dispose(): void {
    this.meshes[0]!.geometry.dispose();
    this.shadows[0]!.geometry.dispose();
    const shadowMaterial = this.shadows[0]!.material;
    if (!Array.isArray(shadowMaterial)) shadowMaterial.dispose();
    for (const mesh of this.meshes) {
      const material = mesh.material as ReturnType<typeof createBallMaterial>;
      material.uniforms.ballMap!.value.dispose();
      material.dispose();
    }
  }
}
