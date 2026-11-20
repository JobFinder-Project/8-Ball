import { CanvasTexture, SRGBColorSpace } from 'three';
import { createCanvas } from './noise';

export const BALL_COLORS: Record<number, string> = {
  0: '#f6f2e7',
  1: '#f2b51b',
  2: '#2671bc',
  3: '#e22236',
  4: '#66359a',
  5: '#f27621',
  6: '#249346',
  7: '#8c352b',
  8: '#20262d',
};

export const ballColor = (id: number): string => BALL_COLORS[id > 8 ? id - 8 : id]!;

const IVORY = '#f5f0e2';

/**
 * Textura equirretangular da bola (2:1). A faixa das listradas fica no equador
 * do eixo vertical local e os círculos com número em ±X local (u = 0 e u = 0,5).
 */
export function createBallTexture(id: number, maxAnisotropy: number): CanvasTexture {
  const W = 1024;
  const H = 512;
  const [canvas, ctx] = createCanvas(W, H);
  const stripe = id > 8;
  const color = ballColor(id);

  ctx.fillStyle = id === 0 ? BALL_COLORS[0]! : stripe ? IVORY : color;
  ctx.fillRect(0, 0, W, H);

  if (stripe) {
    const half = H * (28 / 180);
    ctx.fillStyle = color;
    ctx.fillRect(0, H / 2 - half, W, half * 2);
  }

  if (id !== 0) {
    const r = H * (22 / 180);
    const drawBadge = (cx: number) => {
      ctx.fillStyle = IVORY;
      ctx.beginPath();
      ctx.ellipse(cx, H / 2, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#141414';
      ctx.font = `700 ${Math.round(r * (id > 9 ? 1.05 : 1.25))}px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(id), cx, H / 2 + r * 0.06);
      if (id === 6 || id === 9) {
        ctx.fillRect(cx - r * 0.35, H / 2 + r * 0.62, r * 0.7, r * 0.09);
      }
    };
    drawBadge(W / 2);
    // o círculo em u = 0 cruza a emenda: desenha nas duas bordas
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    drawBadge(0);
    drawBadge(W);
    ctx.restore();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}
