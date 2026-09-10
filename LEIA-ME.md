# SOBRECARGA — Arena Neon

> *"Aguenta mais um pouco."*
>
> Antes chamado **Sniper Freestyle**. O nome mudou em 09/09/2026; as chaves de
> `localStorage` (`sniper.*`) ficaram como estavam pra não apagar recorde de ninguém.

Twin-stick shooter roguelite em canvas 2D puro. Sem build, sem npm, sem dependência:
é só abrir o `index.html` no navegador.

> Se abrir por `file://` e o áudio/fonte não carregar, sirva a pasta:
> `python -m http.server 8123` e acesse `http://localhost:8123`.

---

## O que mudou em relação à versão anterior

| Antes | Agora |
|---|---|
| 1 arquivo de 800 linhas | 5 módulos: `nucleo`, `classes`, `entidades`, `jogo`, `ui` |
| Movimento por quadro (dependia do FPS) | Física por delta-time (roda igual a 60, 144 ou 240 Hz) |
| 1 tipo de inimigo | 7 tipos com comportamento próprio |
| 1 boss com 1 padrão | 4 bosses, cada um com 3–4 fases de movimento e ataque |
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
| Escudo | `Q` (ou `CAPS LOCK`) |
| Ultimate | `E`, `SHIFT` ou clique direito |
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
| Botões `»` `⛨` `★` | dash, escudo e ultimate — cada um mostra a própria recarga enchendo |
| `❚❚` no centro de baixo | pausa |

Sem joystick de mira e sem dedo no ATIRAR, a mira automática já segue o inimigo mais próximo —
então dá pra jogar com um dedo só, andando e apertando ATIRAR.

---

## Classes

| Classe | Identidade | Ultimate |
|---|---|---|
| **SNIPER** | tiro perfurante, dano altíssimo, 25% de crítico, 3 corações | **TRAÇANTE** — raio que atravessa a arena |
| **GUARDIÃO** | 6 corações, escudo que **reflete** os tiros inimigos, lento | **IMPACTO** — onda de choque que empurra e destroça |
| **ESPECTRO** | escopeta de 5 projéteis, dash que corta, 400 px/s, cura ao matar | **CARNIFICINA** — intangível e cortando por 3 s |
| **ARCANO** | projétil teleguiado, 2 orbes orbitais, ímã de XP enorme | **SINGULARIDADE** — buraco negro que suga e explode |

## Inimigos

`CORREDOR` persegue · `BRUTO` tanque que resiste a 35% do dano · `ATIRADOR` mantém distância e
atira · `KAMIKAZE` pisca, investe e explode · `DIVISOR` racha em 2 ao morrer ·
`ORBITADOR` circula e dá rajada tripla · `COURAÇA` bloqueia tiro pela frente (flanqueie ou ricocheteie).

## Bosses (ondas 5, 10, 15, 20)

1. **SENTINELA CARMESIM** — movimento horizontal → tiro único, leque de 3, anel
2. **SERPENTE DE VÍDEO** — movimento senoidal → leque de 9, invocação
3. **OLHO DO VAZIO** — movimento circular → espiral contínua, anel, invocação
4. **O ARQUITETO** — 4 fases: persegue → senoidal → circular → caótico, com laser em varredura

Cada boss troca de fase por faixa de vida, com telégrafo visual e sonoro antes de retomar.

---

## Arquitetura

```
index.html          telas, HUD e ordem de carregamento dos scripts
style.css           design system (tokens em :root, vidro escuro + neon)
src/nucleo.js       Mat, Config, Camera, Recordes, Input, Som, Particulas, Textos
src/placar.js       Perfil (nome) e Placar (envio e leitura do placar mundial)
src/placar-config.js  endereço do placar — o único arquivo a mexer pra ligar/desligar
api/placar.js       função da Vercel: valida a run e grava no Postgres do Neon
src/classes.js      CLASSES[] e MELHORIAS[] (dados puros — mexa aqui pra balancear)
src/entidades.js    Jogador, Projetil, Inimigo, Boss, Coletavel
src/jogo.js         estado, loop, ondas, colisões, efeitos de tela, render da arena
src/ui.js           telas, HUD, barra de boss, cartas de melhoria
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

## Onde balancear

| O quê | Onde |
|---|---|
| Atributos de classe | `src/classes.js` → `CLASSES[].atributos` |
| Melhorias e raridade | `src/classes.js` → `MELHORIAS[]`, `PESO_RARIDADE` |
| Vida/velocidade/dano de inimigo | `src/entidades.js` → `TIPOS_INIMIGO` |
| Vida e padrões de boss | `src/entidades.js` → `BOSSES` |
| Densidade das ondas | `src/jogo.js` → `prepararOnda()` (`orcamento`) e `tetoSimultaneo` |
| Escala de vida por onda | `src/jogo.js` → `multiplicadorVida()` |
| Total de ondas | `src/jogo.js` → `TOTAL_ONDAS` |
| Curva de XP (frequência das melhorias) | `src/entidades.js` → `xpProximo` (`50` e `1.38`) |

Medido no pior caso (onda 19, 34 inimigos, 300 projéteis): **0,14 ms de lógica e 0,27 ms de
render por quadro** — sobra folga de 60× no orçamento de 16,6 ms.

---

## Próximos passos possíveis

1. Modo infinito (sobrevivência) com placar separado.
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

**O que isso não é:** placar à prova de trapaça. Quem entende de HTTP consegue
mandar uma pontuação plausível na mão. Pra um placar entre amigos, os limites
acima resolvem; pra torneio valendo algo, o caminho seria assinar a run no
servidor.

### Publicar / religar

1. Vercel → projeto **sobrecarga** → *Settings → Git* → conectar o repositório
   `enzoenzofernandesoli-star/sobrecarga`.
2. Vercel → *Settings → Environment Variables* → criar **`DATABASE_URL`** com a
   string de conexão do papel `placar_app` (está em `api/conexao-local.js`, que
   fica fora do git). Sem essa variável, `/api/placar` responde `503` com recado
   claro e o jogo cai no placar local.
3. Deploy. A partir daí, cada `git push` na `main` redeploya sozinho.
4. Opcional: em `src/placar-config.js`, trocar `url` de `/api/placar` pro
   endereço absoluto (`https://SEU-DOMINIO/api/placar`). Assim a cópia aberta
   direto do arquivo no PC também manda pontuação pro mesmo placar do site.

### Trocar de banco

`api/placar.js` é o único lugar que fala SQL. Pra migrar (Supabase, Postgres
próprio, o que for), basta apontar `DATABASE_URL` pro novo banco e criar a
tabela com as mesmas colunas — o jogo não muda uma linha.
