# SNIPER FREESTYLE — Arena Neon

Twin-stick shooter roguelite em canvas 2D puro. Sem build, sem npm, sem dependência:
é só abrir o `index.html` no navegador. O placar mundial requer site publicado com API e banco.

## A corrida

- **100 ondas**. Boss a cada 5 até a onda 40 e a cada 10 daí em diante. Depois do oitavo a rotação recomeça em versões
  ascendidas, mais resistentes — e a onda 100 é sempre o **CEIFADOR ABSOLUTO**,
  o boss final, que fica fora do rodízio.
- **Teto de 6 corações.** Nenhuma classe, melhoria ou cura passa disso
  (`Jogador.VIDA_MAXIMA`), então nenhuma build vira esponja.
- 3 skins por classe (12 variantes). Escolha antes de jogar; a preferência fica
  neste navegador. Skins mudam o visual do personagem, não seus atributos.
- Arena de 1760×990 unidades, toda visível de uma vez: a câmera fica no centro
  e só treme e dá zoom, nunca acompanha o jogador. O CSS encolhe o canvas para
  caber na tela, então o espaço de fuga cresceu sem ninguém sair do quadro. No
  celular a renderização interna cai para 75% para preservar desempenho.
- Cooperativo: CRIAR SALA abre a tela da sala com código editável e lista de quem
  está dentro; ENTRAR NA SALA pede o código do anfitrião. Detalhes e limites em
  `COOPERATIVO.md`.
- Vida inicial: Sniper 2, Guardião 4, Espectro 2, Arcano 2, Invocador 4 corações.
  Bosses anteriores também têm menos vida; o aumento por onda é mais lento.
- Placar mundial, em três degraus: `/api/placar` do próprio endereço → servidor
  de reserva (`PLACAR_CONFIG.reserva`) → **Data API do Neon**, que fala direto
  com o banco e não depende de servidor nenhum. O terceiro degrau é o que faz o
  placar funcionar mesmo num host estático como a Vercel.
- No Data API não existe segredo no cliente: o token é anônimo, dura uma hora e
  é emitido a quem pedir. Quem manda é o Postgres — o papel `anonymous` só pode
  ler o ranking e inserir uma linha que passe por todas as CHECKs (nome no
  formato certo e sem palavrão, classe válida, onda 1–100, pontos e tempo na
  faixa). UPDATE e DELETE são negados no banco, não no navegador.
- Instalação que já usa o placar de 40 ondas precisa executar
  `banco/migracoes/002_placar_ondas_infinitas.sql` antes de publicar esta API.
  O placar online também exige `DATABASE_URL` no servidor da Vercel.

### Leitura dos tiros e desempenho no celular

- Tiros disparados pelo jogador são verde-lima (críticos brancos). Tiros inimigos
  e de boss preservam as cores próprias de cada entidade e o formato de losango.
  Lasers, fragmentos e projéteis refletidos mantêm suas cores originais.
- Projétil que atravessa inimigo ou boss pode acertar o mesmo alvo novamente após
  ricochetear na parede. O limite de perfuração continua valendo em cada acerto.
- Em aparelhos de toque, o canvas usa 75% da resolução da arena (1320×742 em vez
  de 1760×990), preservando coordenadas e tamanho visual. Partículas simultâneas
  caem de 1500 para 600, rastros emitem menos partículas e efeitos de brilho
  caros saem dos projéteis, partículas e moldura.
- HUD atualiza a cada 100 ms no celular; durante menus, arena redesenha a até
  15 fps. Scanlines ficam ocultas em ponteiros de toque. Jogabilidade segue
  atualizada em cada quadro ativo.

> Se abrir por `file://` e o áudio/fonte não carregar, sirva a pasta:
> `python -m http.server 8123` e acesse `http://localhost:8123`.

---

## O que mudou em relação à versão anterior

| Antes | Agora |
|---|---|
| 1 arquivo de 800 linhas | 5 módulos: `nucleo`, `classes`, `entidades`, `jogo`, `ui` |
| Movimento por quadro (dependia do FPS) | Física por delta-time (roda igual a 60, 144 ou 240 Hz) |
| 1 tipo de inimigo | 7 tipos com comportamento próprio |
| 1 boss com 1 padrão | 8 bosses, cada um com 3–4 fases de movimento e ataque |
| Sem classes | 4 classes jogáveis com arma, defesa e ultimate distintas |
| Sem progressão | XP, níveis e 22 melhorias sorteadas por raridade |
| HUD de texto cru | HUD em DOM: corações, XP, recargas, combo, barra de boss |
| Telas via `innerHTML` | 7 telas reais: menu, classes, ajuda, ajustes, recordes, pausa, fim |
| Sem áudio | Trilha e ~20 efeitos sintetizados no WebAudio (zero arquivo) |
| Sem persistência | Recordes e ajustes salvos em `localStorage` |
| Sem identidade | Nome do jogador na run e **placar mundial** compartilhado |
| Sem feedback de impacto | Partículas, tremor, hitstop, flash, slow-mo, números de dano |
| Só teclado + mouse | Controles de toque em tela: joystick de mover, joystick de mira e botão ATIRAR |

---

## Controles

| Ação | Tecla |
|---|---|
| Mover | `W` `A` `S` `D` (ou setas) |
| Mirar | mouse |
| Atirar | clique esquerdo (segurar) |
| Dash (invencível por instantes) | `ESPAÇO` |
| Escudo / especial do corpo | `Q` (ou `CAPS LOCK`) |
| Possuir / abandonar corpo | `E` |
| Ultimate | `SHIFT` ou clique direito |
| Pausar | `P` ou `ESC` |
| Escolher melhoria | `1` `2` `3` |

### No celular

Os controles em tela aparecem sozinhos em aparelho de toque (`Ajustes → Controles de toque`:
Automático / Sempre visíveis / Nunca — dá pra forçar no PC pra testar).

| Controle | O que faz |
|---|---|
| Joystick esquerdo (**MOVER**) | anda em 360° |
| Joystick direito (**MIRAR**) | mira na direção do dedo e **atira sozinho** enquanto arrasta |
| Botão **ATIRAR** | dispara com **mira automática** no inimigo mais próximo |
| Botões `»` `⛨` `Ψ` `★` | dash, escudo/especial, possessão e ultimate — cada um mostra estado/recarga |
| `❚❚` no centro de baixo | pausa |

Sem joystick de mira e sem dedo no ATIRAR, a mira automática já segue o inimigo mais próximo —
então dá pra jogar com um dedo só, andando e apertando ATIRAR.

---

## Classes

| Classe | Identidade | Ultimate |
|---|---|---|
| **SNIPER** | tiro perfurante, dano altíssimo, 25% de crítico, 2 corações | **TRAÇANTE** — feixe largo que varre a arena |
| **GUARDIÃO** | 4 corações, escudo que **reflete** os tiros inimigos, lento | **IMPACTO** — onda de choque que empurra e destroça |
| **ESPECTRO** | escopeta de 5 projéteis, dash que corta, 400 px/s, cura ao matar | **CARNIFICINA** — intangível e cortando por 3 s |
| **ARCANO** | projétil teleguiado, 2 orbes orbitais, ímã de XP enorme | **SINGULARIDADE** — buraco negro de 480 px que explode numa onda de 700 |
| **INVOCADOR** | 3 corações, tiro teleguiado e 2 drones que caçam sozinhos | **LEGIÃO** — 3 drones extras por 10 s, tropa inteira mais rápida |

O INVOCADOR continua forte, mas deixou de dominar todas as classes. Cada drone orbita a
78 px, procura alvo num raio de 760 px e atira com **65% do dano do dono**, quase
na mesma cadência dele, com tiro teleguiado. Durante a LEGIÃO a tropa atira 20%
mais rápido. A melhoria **MAIS UM NA TROPA** (+1 drone, até 2 vezes) só aparece
para ele — melhoria com `exige` não polui o sorteio das outras classes.

## Possessão

- Inimigo precisa estar vivo, abaixo de **35% da vida** e a até **100 px**.
- Contorno roxo e `E` aparecem quando o alvo está disponível.
- `E` consome o corpo sem contar abate, XP ou drop. Alma mantém pontuação, nível,
  melhorias, onda, multiplicador e identidade cooperativa.
- Durante **12,5 s**, jogador usa vida restante, velocidade, tamanho, colisão,
  aparência e tiro do inimigo. `Q` usa especial derivado do comportamento: investida,
  teleporte ou descarga radial. Melhorias permanentes ainda escalam o dano.
- Barra roxa sobre o corpo mostra tempo; barra inferior mostra vida do corpo.
- `E`, tempo esgotado ou destruição expulsam a alma no mesmo local. Vida original
  volta; destruição concede **1,4 s** de invulnerabilidade para escapar.
- Durante a possessão, inimigos e boss consideram o corpo um aliado e não o atacam.
  No cooperativo, passam a mirar outro jogador que não esteja possuído.
- Busca de alvo percorre jogadores diretamente, sem criar arrays por inimigo/quadro.
  Rastro invisível da alma também fica suspenso durante a possessão para evitar pausas
  de coleta de lixo em ondas cheias.

## Inimigos

Cada uma das doze primeiras ondas estreia um tipo — a onda 1 é só corredor, a 12 fecha a
lista — e o aviso central diz o nome do estreante. Depois disso a mistura é sorteada
entre todos.

| Onda | Tipo | O que faz |
|---|---|---|
| 1 | `CORREDOR` | persegue em linha reta |
| 2 | `ATIRADOR` | mantém distância e atira |
| 3 | `BRUTO` | tanque, resiste a 35% do dano, **2 de dano** no contato |
| 4 | `KAMIKAZE` | carrega, investe e explode por 2 |
| 5 | `DIVISOR` | racha em 2 ao morrer |
| 6 | `ORBITADOR` | circula e solta rajada tripla |
| 7 | `COURAÇA` | escudo frontal **com vida própria** (70, mais a escala da onda; 1,8× no elite). Quebrou, ele acelera 25% e fica exposto |
| 8 | `LANCEIRO` | para, mira e dispara o corpo em linha reta — 3 de dano na investida |
| 9 | `TECELÃO` | espiral contínua de projéteis enquanto recua |
| 10 | `FANTASMA` | teleporta para o lado do jogador |
| 11 | `ENXAME` | rápido, em zigue-zague |
| 12 | `TORRETA` | quase parada, resiste a 50%, rajada de 3 tiros rápidos |

## Dificuldade

A campanha tem duas metades. **Até a onda 50 o jogo é tranquilo**: dá para ler a
tela, aprender o padrão de cada boss e montar a build. **Da 50 em diante ele
acelera de verdade**, e a onda 100 é feita para não ser vencida.

| Onda | Inimigos vivos (teto) | Orçamento da onda | Dureza do boss | Chance de elite |
|---|---|---|---|---|
| 5 | 7 | 8 | 0,00 | — |
| 15 | 10 | 17 | 0,08 | — |
| 25 | 12 | 26 | 0,16 | 1% |
| 40 | 16 | 39 | 0,27 | 13% |
| 50 | 18 | 48 | 0,35 | 21% |
| 60 | 21 | 69 | 0,51 | 29% |
| 75 | 26 | 101 | 0,76 | 32% |
| 90 | 30 | 132 | 1,00 | 32% |

`Boss.dureza` é a curva que comanda a luta de boss: até a onda 50 ela sobe só até
0,35, e daí vai a 1. Ela controla três coisas ao mesmo tempo:

- **Quais ataques ele usa.** `ataquesLiberados` corta a lista da fase: o boss da
  onda 5 usa só o primeiro ataque dela, e os outros vão entrando conforme a
  campanha anda. O mesmo boss parece outro bicho na onda 15 e na 90.
- **Quanta bala cada ataque cospe.** `volume(min, cheio)` interpola: o leque sai
  com 5 tiros cedo e 11 no fim; o anel, 12 e 26; a cruz, 2 braços e 4.
- **O ritmo e o passo.** Intervalo entre ataques 1,6× maior no primeiro boss,
  0,85× no último; velocidade de 80% a 105% do que a tabela pede.

Medido com o boss atirando num alvo parado por 29 s:

| Onda | Boss | Ataques liberados | Pico de balas na tela |
|---|---|---|---|
| 5 | SENTINELA | `unico` | 3 |
| 15 | OLHO DO VAZIO | `espiral` | 14 |
| 30 | ORÁCULO | `espiral` | 9 |
| 60 | SERPENTE | `leque+chuva` | 13 |
| 90 | FERREIRO | `leque3+anel` | 77 |
| 100 | CEIFADOR | arsenal inteiro | 43 + as lâminas letais |

O elite só aparece a partir da onda 25, e a velocidade e a cadência do inimigo
comum crescem na metade do ritmo de antes.

## Vida de boss

`Boss.VIDA_EXTRA` multiplica a vida de **todos** os bosses de uma vez — é o botão
para engrossar ou afinar a luta inteira sem mexer em tabela. Hoje está em **3,0**.

| Onda | Boss | Vida |
|---|---|---|
| 5 | SENTINELA CARMESIM | 2.850 |
| 20 | O ARQUITETO | 20.433 |
| 40 | NÚCLEO INFINITO | 43.548 |
| 50 | TITÃ DE FERRO | 56.981 |
| 70 | RAINHA ESTÁTICA | 80.503 |
| 90 | ÚLTIMO ARAUTO | 117.711 |
| 100 | CEIFADOR ABSOLUTO | 159.716 (e regenera 7% disso por segundo) |

Tempo de matar medido com o jogador imóvel acertando tudo: 39 s no boss da onda
5 com nível 3, ~1,5 min nos da 20 e 40, ~3,5 min no da 70 e ~5 min no da 90.

## Escudo de fase, trilha e o 67

Duas coisas acontecem em toda luta de boss, do primeiro ao último:

- **Escudo de fase.** Sempre que o boss troca de fase ele ergue um escudo
  hexagonal e fica **imune**, continuando a andar e atirar o tempo todo. Dura
  `2 + índice da fase × 0,8` segundos — 2,8 s na segunda fase, 3,6 s na terceira,
  4,4 s na quarta. O contador roda em tempo de relógio, então hitstop não
  encurta. Enquanto durar, nada entra: nem ultimate, nem crítico.
- **ENCAIXA!** O segundo boss da corrida — o da onda 10 — não dá 67: enche a
  tela com **ENCAIXA!** por 3,4 s e toca uma das três falas gravadas em
  `assets/encaixa-*.m4a`, sorteada na hora. São os únicos arquivos de som do
  projeto; todo o resto do áudio continua sintetizado no WebAudio.
- **67.** Qualquer outro boss derrubado enche a tela com um **67 gigante** por 2,6 segundos, e
  o estilo muda de boss para boss — cor, fonte, sombra e faixa de leitura vêm de
  `Jogo.ESTILOS_67`, escolhidos pela posição do boss na tabela. O CEIFADOR tem o
  branco reservado só para ele.
- **A trilha muda junto.** `Som.proximaTrilha()` avança para a próxima das sete
  faixas de `Som.TRILHAS`: raiz, escala, timbre do baixo, timbre do lead e BPM
  mudam de uma para a outra. Cada boss morto deixa a música diferente do que
  estava antes.

## CEIFADOR ABSOLUTO — onda 100

O boss final não entra no rodízio: ele só aparece na última onda, e a regra dele é
outra.

- **~72.000 de vida** na onda 100, contra ~12.000 de um boss de onda 20.
- **Bala 2,1× mais rápida** que a de qualquer outro boss — `velocidadeTiro` no
  `def` multiplica tudo que ele dispara, passando por `Boss.atirar`.
- **Ele não pode ser derrotado, e isso é regra, não bug.** Três números fecham a
  conta: `regenera: 0.07` devolve 7% da barra por segundo (em tempo de relógio,
  então câmera lenta e hitstop não ajudam), `tetoDeDano: 0.004` limita um único
  acerto a 0,4% da barra, e `tetoPorSegundo: 0.02` limita **todo** o dano de um
  segundo a 2%. Como 2% entra e 7% volta, a barra sobe sempre. Testado com a
  build máxima do jogo — todas as melhorias no teto, 14 drones, ultimate a cada
  recarga, três minutos de tiro ininterrupto: a barra nunca desceu de **98,2%**.
  A tela mostra "REGENERAÇÃO ABSOLUTA" no lugar do título e acende uma couraça
  branca quando o acerto é grande demais, para o jogador ver o que está
  acontecendo.
- **EMBOSCADA**, o movimento dele nas quatro fases: ele não teleporta para
  qualquer lugar — ele aparece **nas suas costas**, no lado oposto ao que a sua
  nave está mirando, a 150–240 px, e abre fogo no instante em que chega. A cada
  0,9 s na fúria, 1,5 s fora dela.
- **TODOS OS LADOS**, o ataque de assinatura: dois anéis girados um contra o
  outro, 70 projéteis de uma vez, sem brecha confortável. Some com o `volumeExtra: 1.6`
  do `def` dele, que engrossa **todo** ataque que ele usa em 60%.
- **EXECUÇÃO**, em todas as quatro fases: telegrafo branco com aviso na tela e
  então **três rajadas de cinco lâminas com 99 de dano** — mata com seis corações,
  com escudo, com o que for. Não existe tankar: ou desvia, ou morre.
- Movimentos: investida, teleporte, cerco e caótico — um por fase, do mais lento
  ao mais rápido — somados a parede, caçador, minas, cruz, espiral, chuva e laser.

## Bosses do rodízio (13, um por encontro)

Nenhum se repete na campanha: de 5 em 5 até a onda 40 e de 10 em 10 até a 90.

| # | Onda | Boss | O que ele faz |
|---|---|---|---|
| 1 | 5 | **SENTINELA CARMESIM** | horizontal e tiro único; investida e cerco no fim |
| 2 | 10 | **SERPENTE DE VÍDEO** | senoidal, leque e chuva |
| 3 | 15 | **OLHO DO VAZIO** | circular com espiral contínua; teleporta na fase 2 |
| 4 | 20 | **O ARQUITETO** | 4 fases: laser, parede, teleporte e caos |
| 5 | 25 | **FERREIRO SOLAR** | investida, cerco, minas e invocação |
| 6 | 30 | **ORÁCULO DE JADE** | espiral orbital, cruz giratória e precisão |
| 7 | 35 | **ECLIPSE FANTASMA** | teleporte constante, some e reaparece do seu lado |
| 8 | 40 | **NÚCLEO INFINITO** | 4 fases, o mais duro da primeira volta |
| 9 | 50 | **TITÃ DE FERRO** | lento e gigante (raio 96): investida, parede e minas |
| 10 | 60 | **CORTEJO DE VIDRO** | losango rápido: cruz giratória e precisão, teleportando |
| 11 | 70 | **RAINHA ESTÁTICA** | laser e caçador; movimento caótico |
| 12 | 80 | **ABISMO CARMESIM** | cerco colado, anel atrás de anel e invocação |
| 13 | 90 | **ÚLTIMO ARAUTO** | 4 fases, bala 1,35× mais rápida — o ensaio do CEIFADOR |

## Arquitetura

```
index.html          telas, HUD e ordem de carregamento dos scripts
style.css           design system (tokens em :root, vidro escuro + neon)
manifest.webmanifest  identidade do app (nome, ícone, tela cheia, paisagem)
sw.js               service worker: o jogo abre e roda sem internet
privacidade.html    política de privacidade (a URL que a Play exige)
assets/             ícones e capa da loja, gerados por ferramentas/gerar-icones.py
ferramentas/        scripts de apoio que não vão pro navegador
src/nucleo.js       Mat, Config, Camera, Recordes, Input, Som, Particulas, Textos
src/placar.js       Perfil (nome) e Placar (envio e leitura do placar mundial)
src/placar-config.js  endereço do placar — o único arquivo a mexer pra ligar/desligar
api/placar.js       função da Vercel: valida a run e grava no Postgres do Neon
src/classes.js      CLASSES[] e MELHORIAS[] (dados puros — mexa aqui pra balancear)
src/entidades.js    Jogador, Projetil, Inimigo, Boss, Coletavel
src/jogo.js         estado, loop, ondas, colisões, efeitos de tela, render da arena
src/ui.js           telas, HUD, barra de boss, cartas de melhoria, painel de equipe
src/coop.js         cooperativo online: snapshot, previsão local e interpolação
servidor/salas.js   servidor de salas (WebSocket) + servidor local de arquivos
_original/          a versão antiga, intacta
```

Decisões que sustentam isso:

- **Pool fixo de 1500 partículas** — nenhuma alocação por quadro, sem coleta de lixo no meio do jogo.
- **Delta-time com teto de 50 ms** — voltar de uma aba inativa não teleporta ninguém.
- **`hitstop` e `lentidao`** escalam o `dt` da simulação sem travar a interface.
- **Áudio procedural** — nada de `.mp3`: cada som é um oscilador com envelope, então o jogo
  pesa ~90 KB no total.
- **Remoção por flag `.vivo`**, nunca `splice` em dois lugares: índice de laço não embaralha.

---

## Cooperativo online (2 a 4 pessoas)

Está jogável e roda local. Quem simula a partida é o **anfitrião**, no navegador dele:
ondas, inimigos, bosses, colisões, dano e drops. O servidor de salas só encaminha
mensagem — ele não sabe nada de jogo. Isso deixa a hospedagem barata e faz o modo
rodar em qualquer host que aceite WebSocket.

### Rodar

```
npm install
npm run salas          # ou: node servidor/salas.js 8123
```

Abra `http://localhost:8123` (a mesma porta serve o jogo e as salas).
Anfitrião: **CRIAR SALA COOPERATIVA** → escolhe classe → aparece o código de 8 dígitos.
Convidado: digita o código no menu → **ENTRAR NA SALA** → escolhe classe.

Para jogar pela internet, suba `servidor/salas.js` num host com WebSocket e aponte o
cliente com `window.COOP_URL = 'wss://SEU-HOST/sala'` antes de `src/coop.js`. A função
serverless do placar (`api/placar.js`) não serve pra isso: ela não guarda estado de
partida entre requisições.

### Como não fica aos trancos

O snapshot sai 20 vezes por segundo e a tela roda a 60. Entre um pacote e outro o
convidado faz duas coisas:

1. **Dead reckoning** — empurra o alvo de cada entidade pela velocidade que ela tinha.
2. **Interpolação** — puxa a posição desenhada até esse alvo (salto acima de 260 px
   corta direto, senão dash e respawn viravam deslize pela arena).

A nave do próprio convidado ainda é **prevista localmente** com o input dele
(`Jogador.moverPrevisto`), então o movimento responde na hora; a correção vem depois,
puxando devagar para onde o anfitrião disse. Previsão local nunca cria projétil nem
mexe em temporizador de combate — tiro, dano e progressão são sempre do anfitrião.

Cada entidade leva um `id` (`Jogo.proximoId()`) para o convidado reconhecer a mesma
nave entre dois snapshots. Sem isso não existe interpolação, só teletransporte.

### O que trafega

Só o que o convidado não consegue refazer: `def` de inimigo, `classe`, `skin` e os
rastros ficam de fora e são remontados do lado dele a partir do `tipo`. Uma partida
de 4 inimigos dá ~1,9 KB por snapshot (~37 KB/s por convidado).

### Regras da sala

- 4 jogadores no máximo; o quinto recebe "a sala já está cheia".
- Anfitrião cai ou fecha a aba → a sala morre e os convidados voltam ao menu avisados.
- Convidado não pausa a partida dos outros; quando o anfitrião abre uma carta de
  melhoria, o convidado vê "O ANFITRIÃO ESTÁ ESCOLHENDO UMA MELHORIA…".
- Ping/pong derruba conexão morta; sala sem anfitrião ou parada há 30 min é apagada.
- Comando de convidado é limitado a 40/s e sempre validado por faixa no anfitrião
  (`Coop.validarControle`) — nada do que chega da rede entra cru na simulação.

### O que ainda falta

- **Placar de equipe**: partida cooperativa não entra no ranking solo (nem em recorde
  local). O placar de time precisa ser gravado pelo servidor da partida, não pelo
  navegador — hoje o `api/placar.js` aceita pontuação enviada pelo cliente.
- **Reconexão**: cair derruba pra valer, não devolve o jogador à sala.
- **Hospedagem**: o serviço de salas ainda não tem host escolhido.

---

## Menos apelão, menos explosão, mais leve

Três coisas saíram ou encolheram nesta passada:

- **DILATAÇÃO** (dash congelava o tempo) e **CARGA DE FRAGMENTOS** (inimigo morto
  explodia em estilhaços) saíram do jogo. Eram as duas que decidiam a run sozinhas,
  e a segunda enchia a tela de projétil que ninguém pediu. No lugar entraram SOBRA
  DE CARGA (+0,4 s de escudo) e MAIS UM NA TROPA.
- Cura ao matar do ESPECTRO caiu de 2% para 1%.

### Ultimates (valores atuais)

Depois de uma rodada aparando e outra devolvendo, as ults hoje são as jogadas
mais fortes da partida — área grande e dano que vale o tempo de recarga:

| Ult | Área | Dano |
|---|---|---|
| TRAÇANTE | feixe de 52 px de largura, faixa de acerto de 46 px, arena inteira | 9× o dano do tiro |
| IMPACTO | onda de 820 px, empurrão de 1300, apaga tiro inimigo no caminho | 5× |
| CARNIFICINA | 3,5 s intangível, corte com 90 px de alcance, estouro de 340 px ao ativar | 3,4× por corte |
| SINGULARIDADE | sucção de 480 px e explosão final de 700 px que limpa tiros | 9× |
| LEGIÃO | estouro de 520 px + 5 drones extras por 14 s, tropa 20% mais rápida | 3× no estouro |

Medido com 60 alvos espalhados de 80 a 800 px: IMPACTO e SINGULARIDADE pegam os
60, a LEGIÃO pega 50 e o TRAÇANTE pega 12 na linha — 3.672, 4.800, 6.665 e 2.883
de dano total, respectivamente.
- Partícula: morte de inimigo saiu de ~20+raio para ~8, o baque no jogador de 22
  para 10, a morte de boss de 8 explosões de 40 para 4 de 18, e rastros e auras
  emitem cerca de metade.

### Desempenho

O emissor de partículas varria o pool inteiro (1500 posições) a cada partícula
quando a tela enchia. Agora há uma lista de índices livres: emitir é O(1) e, sem
slot, a partícula simplesmente não nasce. O pool caiu para 900 (400 no celular).

Medido no pior caso de verdade — boss da onda 40 em desespero, 39 inimigos (5
deles guardas elites), 155 projéteis e 714 partículas ao mesmo tempo:
**0,85 ms de lógica e 1,89 ms de render por quadro**, dentro de um orçamento de
16,6 ms. Sobra 6× mesmo na pior cena que o jogo consegue montar.

## Onde balancear

| O quê | Onde |
|---|---|
| Atributos de classe | `src/classes.js` → `CLASSES[].atributos` (`lacaios` = drones do INVOCADOR) |
| Melhorias e raridade | `src/classes.js` → `MELHORIAS[]`, `PESO_RARIDADE` |
| Vida/velocidade/dano de inimigo | `src/entidades.js` → `TIPOS_INIMIGO` |
| Vida e padrões de boss | `src/entidades.js` → `BOSSES` |
| Densidade das ondas | `src/jogo.js` → `prepararOnda()` (`orcamento`) e `tetoSimultaneo` |
| Escala de vida por onda | `src/jogo.js` → `multiplicadorVida()` |
| Progressão até a onda 100 | `src/jogo.js` → `TOTAL_ONDAS`, curvas de onda e `spawnarBoss()` |
| Curva de XP (frequência das melhorias) | `src/entidades.js` → `xpProximo` (`50` e `1.38`) |

Medido no pior caso (onda 19, 34 inimigos, 300 projéteis): **0,14 ms de lógica e 0,27 ms de
render por quadro** — sobra folga de 60× no orçamento de 16,6 ms.

---

## Próximos passos possíveis

1. Placares sazonais separados para comparar runs infinitas.
2. Sinergias entre melhorias (ex.: ricochete + perfuração = tiro que varre a sala).
3. Elite/campeão: versão dourada de inimigo comum com vida e recompensa dobradas.
4. Gamepad via Gamepad API.
5. Arte (ver abaixo) — o jogo hoje é 100% vetorial e não precisa de nenhum arquivo.

---

## Ajuste de dificuldade de 09/09 (segunda rodada)

Pedido: menos telas de melhoria e inimigos menos difíceis.

- **Melhorias caíram ~50%**: XP do próximo nível passou de `18 × 1,24^n` para `50 × 1,38^n`.
  Cadência agora fica em torno de **1 tela por onda** (mais a garantida por boss derrotado).
- **Inimigos**: −15% a −20% de vida em todos os tipos, velocidade menor, `BRUTO` e `KAMIKAZE`
  deixaram de dar 1,5 coração e passaram a dar 1, `KAMIKAZE` avisa 0,85 s antes de investir
  (era 0,55 s), `ATIRADOR` e `ORBITADOR` atiram bem mais devagar e mais lento,
  `DIVISOR` racha em 2 (era 3), tipos difíceis entram uma onda mais tarde.
- **Escala por onda** caiu de +13% para +8,5% de vida por onda.
- **Quantidade**: orçamento por onda de `5 + 2,7×onda` para `4 + 2,2×onda`, teto simultâneo de
  34 para **26**, e spawn mais espaçado.
- **Bosses**: −20% de vida (1250 / 2400 / 4100 / 7000).

---

## Nome do jogador e placar mundial

### Como funciona pra quem joga

1. Na tela de classes existe o campo **SEU NOME NO PLACAR** (12 caracteres, salvo
   no navegador; também editável em Ajustes). Em branco, entra como `ANÔNIMO`.
2. Ao terminar a run — vitória ou derrota — a pontuação vai pro placar e a tela
   final diz se subiu (`🌎 Enviado ao placar mundial`) ou se ficou só local.
3. **RECORDES** tem duas abas: **MUNDIAL** (todos que jogaram) e **NESTE
   APARELHO** (as 8 melhores runs de quem está ali). A linha de quem está
   jogando aparece destacada em ciano no placar mundial.

Se o placar estiver fora do ar, ou o arquivo for aberto sem internet, o jogo não
muda em nada: a run continua salva no aparelho.

### Como está montado

```
navegador (src/placar.js)  →  /api/placar (Vercel)  →  Postgres (Neon)
```

- **Nenhuma credencial de banco vive no navegador.** A página só conhece a rota.
- A função usa o papel `placar_app`, que só tem `SELECT` e `INSERT` na tabela
  `placar_sobrecarga`. Não cria, não altera, não apaga, não vê outra tabela.
- A tabela tem RLS ligado e `CHECK` em toda coluna (faixas de pontos, onda,
  nível, tempo, abates e lista fechada de classes).
- A função rejeita: nome de lista negra, classe inexistente, valor fora de
  faixa, pontuação implausível pra onda alcançada (`30000 × onda + 60000`) e
  reenvio do mesmo nome+pontuação dentro de 2 minutos.
- Banco: projeto Neon `sobrecarga-placar`, região `sa-east-1`, plano grátis.
- Em 14/09/2026, a migração trocou a restrição de `onda <= 20` por `onda <= 40`
  e criou o índice `placar_sobrecarga_ranking_idx`. Os 2 resultados existentes
  foram preservados. O papel `placar_app` continua limitado a ler e inserir.

**O que isso não é:** placar à prova de trapaça. Quem entende de HTTP consegue
mandar uma pontuação plausível na mão. Pra um placar entre amigos, os limites
acima resolvem; pra torneio valendo algo, o caminho seria assinar a run no
servidor.

### Publicar / religar

1. Vercel → *Add New → Project* → importar `enzoenzofernandesoli-star/sniperfreestyle`.
2. Neon → SQL Editor → executar `banco/migracoes/001_placar_40_ondas.sql` com
   o proprietário da tabela. A consulta `select max(onda) from public.placar_sobrecarga`
   confirma acesso, mas não prova o novo limite; teste uma partida na onda 21.
3. Vercel → *Settings → Environment Variables* → criar **`DATABASE_URL`** com a
   string de conexão do papel `placar_app` (está em `api/conexao-local.js`, que
   fica fora do git). Sem essa variável, `/api/placar` responde `503` com recado
   claro e o jogo cai no placar local.
4. Deploy. A partir daí, cada `git push` na `main` redeploya sozinho.
5. Opcional: em `src/placar-config.js`, trocar `url` de `/api/placar` pro
   endereço absoluto (`https://SEU-DOMINIO/api/placar`). Assim a cópia aberta
   direto do arquivo no PC também manda pontuação pro mesmo placar do site.

### Por que o banco tem outro nome

A tabela é `placar_sobrecarga` e o projeto no Neon é `sobrecarga-placar`, de
quando o jogo se chamou SOBRECARGA por algumas horas. São nomes internos que o
jogador nunca vê; renomear obrigaria a mexer no banco em produção sem ganho
nenhum. O mesmo vale pras chaves de `localStorage` (`sniper.*`), que ficaram
desde a primeira versão — trocar apagaria os recordes já salvos.

### Trocar de banco

`api/placar.js` é o único lugar que fala SQL. Pra migrar (Supabase, Postgres
próprio, o que for), basta apontar `DATABASE_URL` pro novo banco e criar a
tabela com as mesmas colunas — o jogo não muda uma linha.

---

## Celular: o que foi arrumado em 10/09

Pedido: a tela de escolher classe ficava apertada, tirar o blur e tirar o scroll da página.

- **Zero `backdrop-filter`.** O blur saiu de todas as camadas (HUD, telas, painéis, joysticks,
  botões). Como não há mais desfoque pra separar o fundo, o vidro ficou mais opaco
  (`--vidro` de `.82` para `.94`) e o fundo das telas quase sólido.
- **A página nunca rola.** `.tela` virou `overflow: hidden`. Quando o conteúdo não cabe, quem
  rola é o miolo (`.painel`, `.menu-caixa`, as grades), com barra fina de 6 px.
- **Escolha de classe no celular deitado** virou **carrossel com encaixe**: um cartão por vez,
  ocupando 94% da largura, e o cartão se reorganiza em **duas colunas** (identidade + atributos
  de um lado, forças/fraquezas + ultimate do outro). Aparece a dica "arraste para ver as 4".
- **Gatilho é a altura, não a largura:** `@media (max-height: 560px)`. Celular deitado tem
  375 px de altura — é a altura que aperta, não a largura. Um notebook com janela baixa ganha
  o mesmo layout, e é bom que ganhe.
- Cabeçalho, nome do jogador (rótulo e campo na mesma linha), cartas de melhoria, tela final,
  ajuda, ajustes e recordes ganharam versão compacta na mesma media query.
- Área segura de notch respeitada via `env(safe-area-inset-*)`.

Conferido em 812×375 (celular deitado) e em 1280×720: sem rolagem de página, sem nenhum
elemento com blur, e nada cortado.

## PWA e app Android

O jogo agora é instalável e roda offline:

- `manifest.webmanifest` — tela cheia, orientação paisagem, ícones 192/512 + maskable.
- `sw.js` — cache do casco (cache primeiro), rede sempre pro `/api/placar`.
- Botão **VOLTAR** do Android navega telas: em jogo pausa, na pausa vai pro menu, no menu sai.
- `ferramentas/gerar-icones.py` desenha os ícones e a capa da loja a partir da mesma nave que
  o jogo desenha no canvas. Rode `python ferramentas/gerar-icones.py` pra regerar.

> **Ao publicar uma versão nova, suba o `VERSAO` no `sw.js`.** Senão quem já abriu o jogo
> continua vendo o casco antigo até o service worker atualizar sozinho. Em
> desenvolvimento, desregistre o service worker nas ferramentas do navegador.

A avaliação completa para a loja — bloqueios, custos, textos prontos, respostas do formulário
de Segurança de Dados e da classificação de conteúdo — está em **[GOOGLE-PLAY.md](GOOGLE-PLAY.md)**.
