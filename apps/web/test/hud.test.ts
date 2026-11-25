import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameController } from '../src/game/GameController';
import { Hud } from '../src/ui/Hud';

describe('interface da partida', () => {
  it('mostra nova partida, sem controle de som ou créditos na mesa', () => {
    const game = new GameController();
    const html = renderToStaticMarkup(
      createElement(Hud, {
        view: game.getView(),
        onNewGame: () => {},
      }),
    );
    expect(html).toContain('Nova partida');
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).not.toContain('Som:');
    expect(html).not.toContain('audio-credits');
    expect(html).not.toContain('Créditos');
  });

  it('preserva atribuição fora da área visível do jogo', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const metadata = html.match(/<meta\s+name="audio-credits"\s+content="([^"]+)"/);
    expect(metadata).not.toBeNull();
    expect(metadata![1]).toContain('kelsey_w');
    expect(metadata![1]).toContain('https://creativecommons.org/licenses/by/3.0/');
    expect(metadata![1]).toContain('redução de ruído');
  });
});
