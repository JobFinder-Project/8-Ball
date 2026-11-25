/** Reservado para o futuro menu principal; não faz parte da interface da partida. */
export function AudioCredits() {
  return (
    <details className="audio-credits">
      <summary aria-label="Créditos de áudio" title="Créditos de áudio">
        ⓘ
      </summary>
      <div className="audio-credits-panel">
        <strong>Gravações de áudio</strong>
        <p>
          Colisões: kelsey_w —{' '}
          <a
            href="https://freesound.org/people/kelsey_w/sounds/467054/"
            target="_blank"
            rel="noreferrer"
          >
            Pool Ball Hit
          </a>
          ,{' '}
          <a
            href="https://freesound.org/people/kelsey_w/sounds/467048/"
            target="_blank"
            rel="noreferrer"
          >
            Hit 2
          </a>{' '}
          e{' '}
          <a
            href="https://freesound.org/people/kelsey_w/sounds/467053/"
            target="_blank"
            rel="noreferrer"
          >
            Hit 3
          </a>
          .{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          . Adaptações: recorte, conversão mono, redução de ruído, filtros leves, normalização e
          fades.
        </p>
        <p>
          Tabela:{' '}
          <a
            href="https://freesound.org/people/mccarthy%40bedmas.com/sounds/42364/"
            target="_blank"
            rel="noreferrer"
          >
            mccarthy@bedmas.com
          </a>{' '}
          (limpeza de ruído e reverberação adicionada). Tacadas:{' '}
          <a
            href="https://freesound.org/people/csaszi/sounds/350918/"
            target="_blank"
            rel="noreferrer"
          >
            csaszi
          </a>
          . Caçapas e retorno:{' '}
          <a
            href="https://freesound.org/people/AmberdeMeillon/sounds/443057/"
            target="_blank"
            rel="noreferrer"
          >
            AmberdeMeillon
          </a>
          .{' '}
          <a
            href="https://creativecommons.org/publicdomain/zero/1.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC0 1.0
          </a>
          .
        </p>
      </div>
    </details>
  );
}
