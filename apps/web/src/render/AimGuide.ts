import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry } from 'three';
import { BALL_RADIUS, predictShot, type TableGeometry, type Vec2 } from '@sinuca/core';
import type { GameController } from '../game/GameController';

const Y = BALL_RADIUS;
const WHITE = 0xffffff;
const RED = 0xff5a4a;
const GOLD = 0xe7b54d;
const LINE_WIDTH = 6;
const SECONDARY_WIDTH = 5;
const OUTLINE_WIDTH = 1.5;
/** Apenas uma indicação curta da primeira saída, nunca uma cadeia de impactos. */
export const MAX_POST_IMPACT_DISTANCE = 260;

function basic(color: number, opacity: number) {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

/** Faixa plana de largura `w` entre dois pontos da mesa. */
function setSegment(m: Mesh, x1: number, y1: number, x2: number, y2: number, w: number): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  m.visible = len > 0.5;
  m.position.set((x1 + x2) / 2, Y, (y1 + y2) / 2);
  m.scale.set(len, 1, w);
  m.rotation.y = -Math.atan2(dy, dx);
  const outline = m.getObjectByName('aim-outline');
  if (outline && len > 0.5) {
    outline.scale.set((len + 2 * OUTLINE_WIDTH) / len, 1, (w + 2 * OUTLINE_WIDTH) / w);
  }
}

/** Aproximação até o primeiro contato e indicações curtas de direção após ele. */
export class AimGuide {
  readonly group = new Group();
  private readonly quad = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly main = this.make(basic(WHITE, 0.9), true);
  private readonly target = this.make(basic(WHITE, 0.95), true);
  private readonly cuePath = this.make(basic(WHITE, 0.45), true);
  private readonly reflect = this.make(basic(WHITE, 0.45), true);
  private readonly crossA = this.make(basic(RED, 1));
  private readonly crossB = this.make(basic(RED, 1));
  private readonly ghost = new Mesh(
    new RingGeometry(BALL_RADIUS - 2, BALL_RADIUS + 2, 64).rotateX(-Math.PI / 2),
    basic(WHITE, 0.9),
  );
  private readonly handRing = new Mesh(
    new RingGeometry(BALL_RADIUS + 9, BALL_RADIUS + 13, 64).rotateX(-Math.PI / 2),
    basic(WHITE, 0.8),
  );
  private readonly pocketRings: Mesh[] = [];
  private readonly kitchen = new Mesh(
    new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    basic(WHITE, 0.05),
  );

  constructor(private readonly table: TableGeometry) {
    for (const m of [this.ghost, this.handRing, this.kitchen]) {
      m.renderOrder = 10;
      this.group.add(m);
    }
    const { headStringX, spec } = table;
    this.kitchen.scale.set(headStringX, 1, spec.width);
    this.kitchen.position.set(headStringX / 2, 0.5, spec.width / 2);
    this.kitchen.renderOrder = 1;
    for (const p of table.pockets) {
      const ring = new Mesh(
        new RingGeometry(p.radius + 8, p.radius + 15, 64).rotateX(-Math.PI / 2),
        basic(GOLD, 0.9),
      );
      ring.position.set(p.center.x, 60, p.center.y);
      ring.renderOrder = 11;
      this.pocketRings.push(ring);
      this.group.add(ring);
    }
  }

  private make(material: MeshBasicMaterial, outlined = false): Mesh {
    const m = new Mesh(this.quad, material);
    m.renderOrder = 10;
    if (outlined) {
      const outline = new Mesh(this.quad, basic(0x000000, material.opacity * 0.65));
      outline.name = 'aim-outline';
      outline.renderOrder = 9;
      m.add(outline);
    }
    this.group.add(m);
    return m;
  }

  private hideAll(): void {
    for (const c of this.group.children) c.visible = false;
  }

  private outgoing(
    mesh: Mesh,
    game: GameController,
    origin: Vec2,
    direction: Vec2,
    length: number,
    width: number,
  ): void {
    const magnitude = Math.hypot(direction.x, direction.y);
    if (magnitude < 0.02) return;
    const dx = direction.x / magnitude,
      dy = direction.y / magnitude;
    // É só uma indicação de direção: ignora outras bolas, inclusive encostadas,
    // sem calcular colisões em cadeia. Apenas a tabela pode cortar o trecho.
    const next = predictShot(
      [{ ...game.cueBall, x: origin.x, y: origin.y }],
      this.table,
      Math.atan2(dy, dx),
    );
    const distance = Math.max(0, (next.ghost.x - origin.x) * dx + (next.ghost.y - origin.y) * dy);
    const travel = Math.min(length, MAX_POST_IMPACT_DISTANCE, distance);
    setSegment(mesh, origin.x, origin.y, origin.x + dx * travel, origin.y + dy * travel, width);
  }

  update(game: GameController, time: number, draggingCue: boolean): void {
    this.hideAll();
    if (!game.canAct) return;
    const cue = game.cueBall;
    const m = game.match;

    // caçapas: piscando enquanto precisa cantar, fixa na escolhida
    const calling = game.getView().needsPocketCall;
    for (const p of this.table.pockets) {
      const ring = this.pocketRings[p.id]!;
      if (calling) {
        ring.visible = true;
        (ring.material as MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 0.006) * 0.3;
      } else if (m.calledPocket === p.id) {
        ring.visible = true;
        (ring.material as MeshBasicMaterial).opacity = 1;
      }
    }

    if (m.ballInHand) {
      this.handRing.visible = true;
      this.handRing.position.set(cue.x, 1, cue.y);
      this.handRing.rotation.y = time * 0.001;
      if (m.ballInHandKitchenOnly) this.kitchen.visible = true;
    }
    if (draggingCue) return;

    const p = predictShot(game.balls, this.table, game.aim);
    const dx = Math.cos(game.aim),
      dy = Math.sin(game.aim);
    // O ponto de contato pode estar no centro da branca ou sob sua superfície.
    // Nesse caso não existe trecho visível de aproximação para desenhar.
    const contactDistance = Math.max(0, (p.ghost.x - cue.x) * dx + (p.ghost.y - cue.y) * dy);
    const travel = contactDistance;
    const reachedContact = p.kind !== 'none';
    if (travel > BALL_RADIUS) {
      setSegment(
        this.main,
        cue.x + dx * BALL_RADIUS,
        cue.y + dy * BALL_RADIUS,
        cue.x + dx * travel,
        cue.y + dy * travel,
        LINE_WIDTH,
      );
    }
    this.ghost.visible = reachedContact;
    this.ghost.position.set(p.ghost.x, Y, p.ghost.y);

    if (reachedContact && p.kind === 'ball') {
      if (!game.isLegalTarget(p.target.id)) {
        const s = BALL_RADIUS * 0.7;
        setSegment(this.crossA, p.ghost.x - s, p.ghost.y - s, p.ghost.x + s, p.ghost.y + s, 6);
        setSegment(this.crossB, p.ghost.x + s, p.ghost.y - s, p.ghost.x - s, p.ghost.y + s, 6);
        return;
      }
      this.outgoing(
        this.target,
        game,
        p.target,
        p.targetDirection,
        80 + 180 * p.fullness,
        LINE_WIDTH,
      );
      const tangent = Math.hypot(p.cueDirection.x, p.cueDirection.y);
      this.outgoing(
        this.cuePath,
        game,
        p.ghost,
        p.cueDirection,
        80 + 180 * tangent,
        SECONDARY_WIDTH,
      );
    } else if (reachedContact && p.kind === 'cushion') {
      this.outgoing(
        this.reflect,
        game,
        p.ghost,
        p.reflected,
        MAX_POST_IMPACT_DISTANCE,
        SECONDARY_WIDTH,
      );
    }
  }
}
