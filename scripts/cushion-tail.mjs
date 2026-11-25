/** Pequena sala difusa, aplicada offline APÓS a limpeza. Não gera ruído de fundo. */
export function extendCushionTail(dry, rate = 44100) {
  const length = Math.max(dry.length, Math.ceil(1.2 * rate));
  const room = new Float32Array(length);
  const damping = 1 - Math.exp((-2 * Math.PI * 3200) / rate);
  for (const seconds of [0.0211, 0.0263, 0.0307, 0.0349, 0.0397, 0.0431]) {
    const delay = new Float32Array(Math.round(seconds * rate));
    const feedback = Math.pow(10, (-3 * delay.length) / rate / 0.8);
    let filtered = 0;
    for (let i = 0; i < length; i++) {
      const index = i % delay.length;
      const echo = delay[index];
      filtered += damping * (echo - filtered);
      delay[index] = (dry[i] ?? 0) + feedback * filtered;
      room[i] += echo / 6;
    }
  }
  // Difusão: evita repetições isoladas que soariam como várias batidas.
  for (const seconds of [0.0043, 0.0067]) {
    const delay = new Float32Array(Math.round(seconds * rate));
    for (let i = 0; i < length; i++) {
      const index = i % delay.length;
      const output = delay[index] - 0.5 * room[i];
      delay[index] = room[i] + 0.5 * output;
      room[i] = output;
    }
  }
  return Float32Array.from(room, (wet, i) => (dry[i] ?? 0) + 0.22 * wet);
}
