# SNIPER FREESTYLE — Arena Neon

Twin-stick shooter roguelite em canvas 2D puro. Sem build, sem npm, sem dependência:
é só abrir o `index.html` no navegador. O placar mundial requer site publicado com API e banco.

## Versão de 40 ondas

- 40 ondas, boss a cada 5: 8 bosses no total. Os novos são Ferreiro Solar,
  Oráculo de Jade, Eclipse Fantasma e Núcleo Infinito, cada um com 3–4 fases.
- 3 skins por classe (12 variantes). Escolha antes de jogar; a preferência fica
  neste navegador. Skins mudam o visual do personagem, não seus atributos.
- Vida inicial: Sniper 2, Guardião 4, Espectro 2, Arcano 2 corações.
  Bosses anteriores também têm menos vida; o aumento por onda é mais lento.
- Antes de publicar, execute `banco/migracoes/001_placar_40_ondas.sql` no Neon
  com o proprietário da tabela. O banco existente pode rejeitar ondas acima de 20.
  Depois publique a API e configure `DATABASE_URL` na Vercel. Sem os dois passos,
  o placar mundial não está ativo.

### Leitura dos tiros e desempenho no celular

- Tiros do jogador são verde-lima (críticos brancos), tiros inimigos são vermelhos
  e tiros de boss são laranja. Formatos: círculo, losango e triângulo. Lasers e
  fragmentos seguem a mesma paleta por origem; projéteis refletidos viram do jogador.
- Projétil que atravessa inimigo ou boss pode acertar o mesmo alvo novamente após
  ricochetear na parede. O limite de perfuração continua valendo em cada acerto.
- Em aparelhos de toque, o canvas usa 75% da resolução interna (960×540 em vez
  de 1280×720), preservando coordenadas e tamanho visual. Partículas simultâneas
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
| **SNIPER** | tiro perfurante, dano altíssimo, 25% de crítico, 2 corações | **TRAÇANTE** — raio que atravessa a arena |
| **GUARDIÃO** | 4 corações, escudo que **reflete** os tiros inimigos, lento | **IMPACTO** — onda de choque que empurra e destroça |
| **ESPECTRO** | escopeta de 5 projéteis, dash que corta, 400 px/s, cura ao matar | **CARNIFICINA** — intangível e cortando por 3 s |
| **ARCANO** | projétil teleguiado, 2 orbes orbitais, ímã de XP enorme | **SINGULARIDADE** — buraco negro que suga e explode |

## Inimigos

`CORREDOR` persegue · `BRUTO` tanque que resiste a 35% do dano · `ATIRADOR` mantém distância e
atira · `KAMIKAZE` pisca, investe e explode · `DIVISOR` racha em 2 ao morrer ·
`ORBITADOR` circula e dá rajada tripla · `COURAÇA` bloqueia tiro pela frente (flanqueie ou ricocheteie).

## Bosses (ondas 5, 10, 15, 20, 25, 30, 35, 40)

1. **SENTINELA CARMESIM** — movimento horizontal → tiro único, leque de 3, anel
2. **SERPENTE DE VÍDEO** — movimento senoidal → leque de 9, invocação
3. **OLHO DO VAZIO** — movimento circular → espiral contínua, anel, invocação
4. **O ARQUITETO** — 4 fases: persegue → senoidal → circular → caótico, com laser em varredura
5. **FERREIRO SOLAR** — leque e anel → perseguição e invocação → movimento caótico e laser
6. **ORÁCULO DE JADE** — espiral orbital → leque senoidal → invocação e laser
7. **ECLIPSE FANTASMA** — laser senoidal → anel e invocação → perseguição e espiral
8. **NÚCLEO INFINITO** — espiral orbital → anel horizontal → laser senoidal → caos

Cada boss troca de fase por faixa de vida, com telégrafo visual e sonoro antes de retomar.

---

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
- Em 14/09/2026, a consulta com `placar_app` confirmou 2 resultados (maior onda 7)
  e a restrição antiga `onda <= 20`. A migração de 40 ondas requer papel
  proprietário; `placar_app` só pode ler e inserir.

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
