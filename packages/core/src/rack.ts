import { createBall, CUE_BALL, EIGHT_BALL, type Ball } from './ball';
import { BALL_DIAMETER } from './constants';
import { shuffle } from './math/random';
import type { TableGeometry } from './table/types';

/** Pequena variação da montagem, em torno da bola do ápice (±2°). */
export const RACK_ROTATION_LIMIT = (2 * Math.PI) / 180;
/** Assentamento local em mm; não é folga uniforme nem tolerância oficial. */
export const RACK_SETTLING = 0.15;

/**
 * Monta o triângulo do 8 bolas: bola 1 no ápice, bola 8 no centro da terceira fileira,
 * e uma lisa e uma listrada nos cantos de trás. As demais ficam em ordem aleatória.
 * Cada bola se apoia em pelo menos uma já colocada, sem sobreposição. Pequenas
 * diferenças independentes de assentamento variam a rede de contatos; girar uma
 * malha perfeita ou embaralhar só as cores não produz variedade suficiente.
 * Retorna as 16 bolas ordenadas por número (índice = número da bola; 0 é a branca).
 */
export function createRack(table: TableGeometry, random: () => number = Math.random): Ball[] {
  const solids = shuffle([2, 3, 4, 5, 6, 7], random);
  const stripes = shuffle([9, 10, 11, 12, 13, 14, 15], random);
  const slots: number[] = new Array(15).fill(0);
  slots[0] = 1;
  slots[4] = EIGHT_BALL;
  const solidLeft = random() < 0.5;
  slots[10] = solidLeft ? solids.pop()! : stripes.pop()!;
  slots[14] = solidLeft ? stripes.pop()! : solids.pop()!;
  const rest = shuffle([...solids, ...stripes], random);
  for (let k = 0; k < slots.length; k++) if (!slots[k]) slots[k] = rest.pop()!;

  const angle = (random() * 2 - 1) * RACK_ROTATION_LIMIT;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const balls: Ball[] = [createBall(CUE_BALL, table.headSpot.x, table.headSpot.y, random)];
  const placed: { x: number; y: number }[] = [];
  let k = 0;
  for (let row = 0; row < 5; row++) {
    let y = (-row * BALL_DIAMETER) / 2;
    if (row) y += ((random() * 2 - 1) * RACK_SETTLING) / 2;
    for (let j = 0; j <= row; j++) {
      if (j) y += BALL_DIAMETER + random() * RACK_SETTLING;
      // Encaixa pela frente até tocar o suporte mais restritivo. Na mesma
      // fileira a distância vertical já é >= diâmetro. Assim não há projeções
      // iterativas, sobreposição, rack solto nem tentativas de escolher a saída.
      let x = 0;
      for (const support of placed) {
        const dy = y - support.y;
        if (Math.abs(dy) < BALL_DIAMETER)
          x = Math.max(x, support.x + Math.sqrt(BALL_DIAMETER ** 2 - dy ** 2));
      }
      placed.push({ x, y });
      balls.push(
        createBall(
          slots[k++]!,
          table.footSpot.x + x * cos - y * sin,
          table.footSpot.y + x * sin + y * cos,
          random,
        ),
      );
    }
  }
  return balls.sort((a, b) => a.id - b.id);
}
