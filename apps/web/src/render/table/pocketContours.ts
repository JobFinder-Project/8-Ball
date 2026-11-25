import type { Vec2 } from '@sinuca/core';

/** Recorta um disco que atravessa a borda de um polígono simples.
 * A borda que ficaria dentro do disco é substituída pelo arco da abertura.
 * O feltro das gargantas permanece até esse arco, sem recortes no shader.
 */
export function cutPocketOpening(polygon: readonly Vec2[], center: Vec2, radius: number): Vec2[] {
  if (polygon.length < 3) return [...polygon];
  const nodes: Vec2[] = [];
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!,
      b = polygon[(i + 1) % polygon.length]!;
    area += a.x * b.y - b.x * a.y;
    nodes.push({ ...a });
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const fx = a.x - center.x,
      fy = a.y - center.y;
    const aa = dx * dx + dy * dy;
    if (aa < 1e-12) continue;
    const bb = fx * dx + fy * dy;
    const discriminant = bb * bb - aa * (fx * fx + fy * fy - radius * radius);
    if (discriminant <= 1e-8) continue;
    const root = Math.sqrt(discriminant);
    for (const t of [(-bb - root) / aa, (-bb + root) / aa])
      if (t > 1e-9 && t < 1 - 1e-9) nodes.push({ x: a.x + dx * t, y: a.y + dy * t });
  }
  const inside = nodes.map((a, i) => {
    const b = nodes[(i + 1) % nodes.length]!;
    return Math.hypot((a.x + b.x) / 2 - center.x, (a.y + b.y) / 2 - center.y) < radius - 1e-8;
  });
  const start = inside.indexOf(false);
  if (start < 0) return [];
  if (!inside.includes(true)) return [...polygon];
  const result: Vec2[] = [];
  const push = (point: Vec2) => {
    const last = result.at(-1);
    if (!last || Math.hypot(last.x - point.x, last.y - point.y) > 1e-7) result.push(point);
  };
  let entry: Vec2 | null = null;
  for (let k = 0; k <= nodes.length; k++) {
    const i = (start + k) % nodes.length,
      point = nodes[i]!;
    if (inside[i]) {
      if (!entry) {
        entry = point;
        push(point);
      }
      continue;
    }
    if (entry) {
      const from = Math.atan2(entry.y - center.y, entry.x - center.x);
      let delta = Math.atan2(point.y - center.y, point.x - center.x) - from;
      if (area > 0) {
        while (delta >= 0) delta -= Math.PI * 2;
      } else {
        while (delta <= 0) delta += Math.PI * 2;
      }
      const steps = Math.max(1, Math.ceil((Math.abs(delta) * 128) / (Math.PI * 2)));
      for (let j = 1; j <= steps; j++) {
        const angle = from + (delta * j) / steps;
        push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
      }
      entry = null;
    }
    push(point);
  }
  if (
    result.length > 1 &&
    Math.hypot(result[0]!.x - result.at(-1)!.x, result[0]!.y - result.at(-1)!.y) < 1e-7
  )
    result.pop();
  return result;
}
