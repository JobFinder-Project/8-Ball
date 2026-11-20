# Roadmap do projeto

Última atualização: 19/11/2026.

Objetivo imediato: polir a experiência de sinuca antes de ampliar o projeto para partidas online, personagens 3D e outros jogos. O nome e a temática definitiva ficam para uma etapa posterior.

## Prioridades e andamento

P0 identifica os problemas críticos de apresentação e jogabilidade. P1 cobre a mesa e o acompanhamento das bolas encaçapadas. P2 reúne o polimento complementar.

| ID    | Prioridade   | Entrega                                        | Estado                          |
| ----- | ------------ | ---------------------------------------------- | ------------------------------- |
| P0-01 | Crítica      | Aparência, acabamento e sombras das bolas      | Concluída e aprovada pelo autor |
| P0-02 | Crítica      | Áudio de sinuca com gravações reais            | Em andamento                    |
| P0-03 | Crítica      | Consistência da física e dos efeitos           | Pendente                        |
| P0-04 | Crítica      | Mira reconhecendo bolas encostadas             | Pendente                        |
| P1-01 | Alta         | Geometria e acabamento das caçapas             | Pendente                        |
| P1-02 | Alta         | Compartimento e animação das bolas encaçapadas | Pendente                        |
| P1-03 | Alta         | Dimensões e proporções da mesa                 | Pendente                        |
| P2-01 | Complementar | Polimento audiovisual e de animação            | Pendente                        |

Ordem de trabalho: concluir o áudio, corrigir a mira encostada e calibrar a física. Na etapa da mesa, confirmar primeiro suas dimensões para então finalizar caçapas e compartimento. O restante do polimento vem após essas entregas.

## P0-01 — Aparência das bolas e iluminação

Problemas relatados: cores lavadas, pouco contraste e volume, material com aparência de 3D cru, vários pontos de brilho e sombras elípticas sobrepostas.

- [x] Usar a referência visual fornecida pelo autor para orientar o acabamento.
- [x] Criar um material próprio das bolas com brilho amplo, transição suave e bordas sombreadas.
- [x] Ajustar as cores e a leitura dos círculos com números.
- [x] Substituir as sombras duplas das bolas por sombras curtas de contato com o feltro.
- [x] Preservar a iluminação geral da mesa.
- [x] Conferir paisagem, retrato, rotação das texturas, movimento e encaçapamento.
- [x] Obter aprovação visual do autor.

Critério de conclusão: bolas legíveis e com acabamento aprovado no tamanho real de jogo. A entrega foi aprovada; alterações futuras devem preservar esse resultado como referência.

## P0-02 — Áudio de jogo

Problema relatado: tacada, colisão, tabela e caçapa usam ruído sintetizado improvisado, sem a identidade sonora de uma mesa de sinuca.

- [ ] Selecionar gravações de sinuca com origem e licença documentadas.
- [ ] Preparar sons distintos para taco–branca, bola–bola e bola–tabela.
- [ ] Adicionar som de entrada na caçapa, queda e contato no interior da mesa.
- [ ] Variar amostras e ajustar volume e timbre conforme a intensidade do impacto.
- [ ] Permitir colisões simultâneas na saída sem eliminar os sons ou saturar a mistura.
- [ ] Carregar e decodificar as amostras sem bloquear a partida.
- [ ] Manter o botão de som e a liberação de áudio pelo primeiro gesto do usuário.
- [ ] Conferir funcionamento nas versões normal e HTML autocontido.
- [ ] Validar tecnicamente e obter aprovação auditiva do autor.

Critério de conclusão: cada evento tem som reconhecível, impactos fracos e fortes soam diferentes, caçapas têm queda audível e uma saída não produz distorção ou uma sequência de sons idênticos. O retorno sonoro deverá acompanhar a futura animação do compartimento quando ela existir.

## P0-03 — Física e efeito

Problemas relatados: comportamento inconsistente de puxada, seguimento, efeito lateral e colisões. O núcleo já possui passo fixo e testes, mas alguns comportamentos são aproximações.

- [ ] Montar cenários reproduzíveis por posição, direção, força e efeito.
- [ ] Verificar puxada, seguimento e transição de deslizamento para rolamento em diferentes distâncias e forças.
- [ ] Verificar cortes e contatos com bolas paradas e em movimento.
- [ ] Calibrar perda e transferência do giro lateral nas tabelas.
- [ ] Avaliar o atrito tangencial e a transferência de giro entre bolas.
- [ ] Verificar colisões múltiplas, bolas encostadas e estabilidade do triângulo na saída.
- [ ] Cobrir impactos nos bicos, rejeição na boca da caçapa e bolas correndo junto à tabela.
- [ ] Adicionar testes de regressão dos defeitos reproduzidos antes de calibrar os parâmetros.
- [ ] Comparar os resultados com referências físicas confiáveis, sem assumir que outro jogo está correto.

Critério de conclusão: tacadas equivalentes têm resultados consistentes; o giro conserva seu sentido esperado; colisões não criam energia, travamentos ou sobreposições persistentes. A calibração das bocas e bicos deve ser revista junto com P1-01 e P1-03.

## P0-04 — Mira atravessando bola encostada

Problema identificado: a previsão de trajetória ignora interseções a distância zero e pode atravessar uma bola que já toca a branca.

- [ ] Tratar contato inicial e pequenas sobreposições numéricas.
- [ ] Distinguir mira em direção à bola, para longe dela e tangente ao contato.
- [ ] Exibir a bola fantasma e as direções previstas sem desenhar uma linha invertida ou atravessando a bola.
- [ ] Criar testes para contato exato, quase contato e presença de outro alvo atrás da bola encostada.

Critério de conclusão: a mira reconhece o primeiro obstáculo inclusive quando ele já está encostado na branca, e permite apontar para longe sem indicar colisão falsa.

## P1-01 — Caçapas: visual, bordas e lógica

Problemas relatados: discos pretos aparentes no fundo, bordas retas ou irregulares e divergência entre recortes circulares do modelo visual e segmentos usados pela física.

- [ ] Derivar boca, garganta, bicos e recortes visuais de uma geometria comum.
- [ ] Arredondar e dar espessura coerente ao acabamento dos bicos e do couro.
- [ ] Ajustar tubo, profundidade, fundo e oclusão para representar um buraco com volume.
- [ ] Conferir o limite de captura da bola dentro da boca de cada caçapa.
- [ ] Verificar entradas e rejeições em caçapas laterais e de canto.

Critério de conclusão: o que o jogador vê coincide com a área física de contato e queda; não há anéis flutuantes, recortes quebrados ou um disco preto parecendo um objeto sobre a mesa.

Dependência: confirmar as dimensões em P1-03 antes de finalizar a geometria.

## P1-02 — Bolas encaçapadas e compartimento

Problema relatado: há uma queda curta, mas a bola desaparece depois; os indicadores do HUD não substituem um compartimento visível.

- [ ] Definir a posição de uma calha, bandeja ou compartimento de coleta.
- [ ] Registrar a ordem de encaçapamento, separada do estado das regras.
- [ ] Animar queda, deslocamento e acomodação no compartimento.
- [ ] Sincronizar os sons de queda e contato entre bolas com a animação.
- [ ] Tratar a branca recolocada, a bola 8 reposta e a limpeza da bandeja em uma nova partida.
- [ ] Manter a leitura dos grupos e do estado da partida no HUD.

Critério de conclusão: é possível identificar as bolas já encaçapadas e acompanhar seu destino, sem duplicar bolas ou manter no compartimento uma bola devolvida à mesa.

Dependências: áudio de P0-02 e espaço visual definido junto com P1-03.

## P1-03 — Dimensões e proporções da mesa

Problema relatado: a mesa parece ter o tamanho errado. A área jogável atual usa 2540 × 1270 mm, equivalente à especificação de 9 pés existente no projeto; isso não confirma que trilhos, borrachas, caçapas e enquadramento tenham as proporções desejadas.

- [ ] Escolher a mesa-alvo: 7, 8 ou 9 pés.
- [ ] Separar dimensões da área jogável, largura das borrachas e largura dos trilhos.
- [ ] Parametrizar bocas, gargantas, bicos e profundidades, reduzindo medidas fixas espalhadas.
- [ ] Conferir a proporção entre bola, mesa e abertura das caçapas.
- [ ] Revalidar enquadramento, rack, marcações e colocação da branca.

Critério de conclusão: proporções visuais e medidas físicas correspondem à mesa escolhida, com bom aproveitamento da tela em paisagem e retrato.

## P2-01 — Polimento complementar

- [ ] Refinar animação de queda, rotação e resposta visual nas caçapas.
- [ ] Revisar feltro, madeira e acabamento da mesa mantendo as bolas já aprovadas.
- [ ] Refinar variações sonoras e mixagem após testar partidas completas.
- [ ] Conferir desempenho e legibilidade em celular e computador.
- [ ] Revisar acessibilidade dos controles e feedback da interface.

Critério de conclusão: partidas completas mantêm a qualidade visual e sonora, sem repetição excessiva, artefatos ou quedas perceptíveis de desempenho.

## Referências e reutilização

- A imagem enviada pelo autor é a referência principal para o acabamento das bolas. A aprovação visual atual estabelece a base do projeto.
- `referencia/PoolGuideline-main` é um overlay Android de mira; não fornece uma implementação completa de mesa, física ou áudio de sinuca.
- `referencia/8Ball-Pool-main` pode servir para consultas pontuais, mas sua implementação não deve substituir automaticamente o núcleo atual.
- Registrar origem, autor, licença e adaptações de qualquer código ou asset incorporado. Reutilizar apenas elementos que tragam uma melhoria comprovada.

## Após o polimento da sinuca

Estas frentes fazem parte da visão do projeto, mas não bloqueiam o roadmap atual:

- Partidas com amigos em servidor autoritativo, usando o núcleo compartilhado para validar as jogadas.
- Personagens 3D jogando, ambientação e direção artística com temática de máfia.
- Outros jogos dentro do mesmo ambiente.
- Nome definitivo e identidade do projeto.

## Validação de cada entrega

Verificar tipos, compilação e testes relevantes à alteração. Para mudanças visuais ou sonoras, conferir o resultado no navegador e registrar uma comparação ou amostra para revisão do autor. Uma implementação tecnicamente validada pode continuar aguardando aprovação estética ou auditiva.
