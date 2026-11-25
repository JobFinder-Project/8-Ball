import { describe, expect, it } from 'vitest';
import { BALL_DIAMETER, BALL_RADIUS, createBall, predictShot } from '@sinuca/core';
import { Mesh, MeshBasicMaterial } from 'three';
import { GameController } from '../src/game/GameController';
import { AimGuide, MAX_POST_IMPACT_DISTANCE } from '../src/render/AimGuide';

function scene(gap: number) {
  const game = new GameController();
  game.balls = [
    createBall(0, 500, 600, () => 0.5),
    createBall(1, 500 + BALL_DIAMETER + gap, 600, () => 0.5),
  ];
  game.match.ballInHand = false;
  game.aim = 0;
  const guide = new AimGuide(game.table);
  const approach = guide.group.children[0] as Mesh;
  return { game, guide, approach };
}

describe('mira curta com indicação apenas do primeiro impacto', () => {
  it('desenha linhas mais grossas com contorno preto discreto alinhado', () => {
    const { game, guide } = scene(300);
    game.balls[1]!.y += 30;
    guide.update(game, 0, false);
    for (const index of [0, 1, 2]) {
      const line = guide.group.children[index] as Mesh;
      const outline = line.getObjectByName('aim-outline') as Mesh;
      expect(line.visible).toBe(true);
      expect(line.scale.z).toBeGreaterThanOrEqual(5);
      expect(outline).toBeDefined();
      expect(outline.scale.z * line.scale.z).toBeCloseTo(line.scale.z + 3, 6);
      expect(outline.scale.x * line.scale.x).toBeCloseTo(line.scale.x + 3, 6);
      expect(outline.renderOrder).toBeLessThan(line.renderOrder);
      const material = outline.material as MeshBasicMaterial;
      expect(material.color.getHex()).toBe(0x000000);
      expect(material.opacity).toBeGreaterThan(0);
      expect(material.opacity).toBeLessThan(0.7);
    }
    game.aim = -Math.PI / 2;
    guide.update(game, 0, false);
    const reflect = guide.group.children[3] as Mesh;
    expect(reflect.visible).toBe(true);
    expect(reflect.getObjectByName('aim-outline')).toBeDefined();
  });
  it.each([0, 0.001, 1, BALL_RADIUS - 1])(
    'não atravessa nem desenha faixa invertida com folga de %s mm',
    (gap) => {
      const { game, guide, approach } = scene(gap);
      guide.update(game, 0, false);
      expect(approach.visible).toBe(false);
      expect(guide.group.children.some((mesh) => mesh.visible)).toBe(true);
    },
  );

  it('para no primeiro alvo e mostra apenas um trecho curto da saída dele', () => {
    const { game, guide, approach } = scene(100);
    guide.update(game, 0, false);
    expect(approach.visible).toBe(true);
    expect(approach.scale.x).toBeCloseTo(100 - BALL_RADIUS, 6);
    expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(3);
    const target = guide.group.children[1] as Mesh;
    expect(target.visible).toBe(true);
    expect(target.scale.x).toBeLessThanOrEqual(MAX_POST_IMPACT_DISTANCE);
    expect(approach.position.x + approach.scale.x / 2).toBeCloseTo(600, 6);
    game.balls[1]!.x = game.cueBall.x + BALL_DIAMETER;
    guide.update(game, 0, false);
    expect(approach.visible).toBe(false);
  });

  it('ao apontar para longe de uma bola encostada, mostra apenas a aproximação livre', () => {
    const { game, guide, approach } = scene(0);
    guide.update(game, 0, false);
    expect(approach.visible).toBe(false);
    game.aim = Math.PI;
    guide.update(game, 0, false);
    expect(approach.visible).toBe(true);
    expect(approach.position.x).toBeLessThan(game.cueBall.x);
  });

  it.each([0, 0.2, 1])(
    'efeito/força %s não mudam o trecho inicial nem estendem a previsão',
    (power) => {
      const { game, guide, approach } = scene(400);
      const snapshots = [];
      for (const spin of [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]) {
        game.spin = spin;
        game.power = power;
        guide.update(game, 0, false);
        expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(3);
        snapshots.push([approach.rotation.y, approach.scale.x, approach.position.x]);
      }
      expect(
        snapshots.every((value) => JSON.stringify(value) === JSON.stringify(snapshots[0])),
      ).toBe(true);
    },
  );

  it.each([600.01, 1400])('alcança o primeiro alvo mesmo com folga de %s mm', (gap) => {
    const { game, guide, approach } = scene(gap);
    guide.update(game, 0, false);
    expect(approach.scale.x).toBeCloseTo(gap - BALL_RADIUS, 6);
    expect(approach.position.x + approach.scale.x / 2).toBeCloseTo(game.cueBall.x + gap, 6);
    expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(3);
  });

  it('sinaliza alvo ilegal distante e mostra somente um rebote curto de tabela próxima', () => {
    const { game, guide, approach } = scene(1400);
    game.isLegalTarget = () => false;
    guide.update(game, 0, false);
    expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(4);
    expect((guide.group.children[1] as Mesh).visible).toBe(false);
    game.aim = -Math.PI / 2;
    guide.update(game, 0, false);
    expect(approach.scale.x).toBeCloseTo(600 - 2 * BALL_RADIUS, 6);
    expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(3);
    const reflect = guide.group.children[3] as Mesh;
    expect(reflect.visible).toBe(true);
    expect(reflect.scale.x).toBeLessThanOrEqual(MAX_POST_IMPACT_DISTANCE);
  });

  it('não atravessa a tabela quando a branca já está encostada nela', () => {
    const { game, guide, approach } = scene(1400);
    game.cueBall.y = BALL_RADIUS;
    game.aim = -Math.PI / 2;
    guide.update(game, 0, false);
    expect(approach.visible).toBe(false);
    expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(2);
  });

  it.each([0, 0.001, 40])(
    'mantém a direção curta com outra bola a %s mm do alvo, sem prever sua colisão',
    (gap) => {
      const { game, guide } = scene(100);
      const target = game.balls[1]!;
      game.balls.push(createBall(2, target.x + BALL_DIAMETER + gap, target.y));
      guide.update(game, 0, false);
      const outgoing = guide.group.children[1] as Mesh;
      expect(outgoing.visible).toBe(true);
      expect(outgoing.scale.x).toBeCloseTo(MAX_POST_IMPACT_DISTANCE, 6);
      expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(3);
    },
  );

  it('alcança uma tabela distante sem encurtar a aproximação, mantendo o rebote curto', () => {
    const { game, guide, approach } = scene(1400);
    game.aim = Math.PI / 2;
    guide.update(game, 0, false);
    expect(approach.scale.x).toBeCloseTo(
      game.table.spec.width - game.cueBall.y - 2 * BALL_RADIUS,
      6,
    );
    const reflect = guide.group.children[3] as Mesh;
    expect(reflect.visible).toBe(true);
    expect(reflect.scale.x).toBeCloseTo(MAX_POST_IMPACT_DISTANCE, 6);
  });

  it('também ignora bolas no trecho curto de saída da branca em um corte', () => {
    const { game, guide } = scene(300);
    game.balls[1]!.y += 30;
    const prediction = predictShot(game.balls, game.table, game.aim);
    if (prediction.kind !== 'ball') throw new Error('Sem alvo');
    const { ghost, cueDirection } = prediction;
    const magnitude = Math.hypot(cueDirection.x, cueDirection.y);
    const distance = BALL_DIAMETER + 20;
    game.balls.push(
      createBall(
        2,
        ghost.x + (cueDirection.x / magnitude) * distance,
        ghost.y + (cueDirection.y / magnitude) * distance,
      ),
    );
    guide.update(game, 0, false);
    const outgoing = guide.group.children[2] as Mesh;
    expect(outgoing.visible).toBe(true);
    expect(outgoing.scale.x).toBeCloseTo(80 + 180 * magnitude, 6);
    expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(4);
  });

  it('a tabela ainda limita uma indicação de saída próxima da borda', () => {
    const { game, guide } = scene(300);
    game.cueBall.x = game.table.spec.length - 500;
    game.balls[1]!.x = game.table.spec.length - 100;
    guide.update(game, 0, false);
    const outgoing = guide.group.children[1] as Mesh;
    expect(outgoing.visible).toBe(true);
    expect(outgoing.scale.x).toBeCloseTo(100 - BALL_RADIUS, 6);
  });

  it('em um corte, mostra trechos curtos da branca e do alvo, sem curvas extensas', () => {
    const { game, guide } = scene(300);
    game.balls[1]!.y += 30;
    guide.update(game, 0, false);
    for (const index of [1, 2]) {
      const outgoing = guide.group.children[index] as Mesh;
      expect(outgoing.visible).toBe(true);
      expect(outgoing.scale.x).toBeLessThanOrEqual(MAX_POST_IMPACT_DISTANCE);
    }
    expect((guide.group.children[3] as Mesh).visible).toBe(false);
    expect(guide.group.children.filter((mesh) => mesh.visible)).toHaveLength(4);
  });
});
