# SNIPER FREESTYLE — instruções do projeto

Twin-stick shooter roguelite em canvas 2D vanilla. Sem build, sem framework, sem npm no
navegador: `index.html` abre no duplo clique. O `npm` aqui serve só ao servidor de salas e
aos testes.

Repositório: `https://github.com/enzoenzofernandesoli-star/sniperfreestyle`

## Leia antes de mexer

| Arquivo | Quando |
|---|---|
| `LEIA-ME.md` | Sempre. Arquitetura, controles, classes, bosses e a tabela "Onde balancear" |
| `COOPERATIVO.md` | Qualquer coisa de sala, online, multiplayer ou snapshot |
| `src/versao.js` | Publicar versão, mexer no histórico ou na temporada do ranking |
| `GOOGLE-PLAY.md` | Publicação Android, PWA, ícones, política |
| `HISTORIA.md` | Qualquer coisa de narrativa: nome, fala, personagem, região, ato |

O roteiro de trabalho e os próximos passos ficam no Segundo Cérebro, em
`Desktop\Segundo cerebro\Playbooks\Sniper-Cooperativo.md`.

## Comandos

```
npm install
npm run salas      # jogo + salas cooperativas em http://localhost:8123
npm test           # 43 testes (node --test), incluindo WebSocket real
node ferramentas/medir-dano.js         # bancada de dano por classe
node ferramentas/medir-dano.js --ult   # o mesmo, com as ultimates
```

Sala cooperativa na mão: abrir `http://localhost:8123` em duas abas, CRIAR SALA numa,
ENTRAR NA SALA na outra com o código de 8 dígitos.

## Regras que já foram decididas (não desfaça sem pedir)

- **Possessão não existe mais.** Foi removida em 18/09/2026 a pedido do Enzo. A tecla `E` é
  atalho da ultimate. Reintroduzir exige refazer o "corpo é aliado" na busca de alvo do
  cooperativo.
- **Emoji da loja É o corpo do jogador**, não um adesivo acima da nave. Com emoji equipado a
  nave não é desenhada; cano da arma, disco de cor e acessório continuam.
- **Temporada do ranking sai de `src/versao.js`**: a temporada é o número de entradas em
  `ATUALIZACOES`. Acrescentar uma entrada zera o placar mundial e o local. Não crie botão de
  zerar placar.
- **O ESPECTADOR** (`secreto: true`) é invencível por regra: `receberDano` devolve sem tocar
  na barra. Não "conserte" isso, não dê vida balanceada a ele e não o coloque em rodízio
  nenhum. Ele aparece duas vezes: na onda 100, no Interstício, onde **conversa e não luta**
  (durante `segredo.fase === 'conversa'` o laço nem chama o `atualizar` dele), e na onda 200,
  onde luta e não pode ser vencido. A vitória das 100 ondas continua sendo registrada antes
  da primeira aparição.

- **`Jogo.onda` conta 1 a 200 corrido e não reinicia.** A contagem que recomeça no Ato II é só
  a da tela (`Jogo.ondaDoAto`, `Jogo.rotuloDaOnda`, `UI.rotuloOnda`). Reiniciar o número de
  verdade quebraria de uma vez a escala de vida, a chance de elite e o encontro de boss.

- **Ato II conta no ranking** (pedido do Enzo, 18/09/2026). Quem atravessou a fenda venceu a
  Arena: `Jogo.atravessou` faz a morte em NÁDIR registrar `venceu: true`. A run entra duas
  vezes de propósito — uma na onda 100, quando a vitória é ganha, e outra no fim real, com
  mais pontos. Teto de onda do placar é 200 na API **e** no banco (migração 005): baixar um
  sem o outro recusa em silêncio justamente as melhores runs.

- **Em NÁDIR cresce a pressão, não a `dureza`.** `dureza` manda em volume de projétil, leque e
  quantos ataques a fase libera, medidos no teto do Ato I; esticar para 1,9 dá anel de 89
  projéteis. O que sobe é `Boss.pressao` (1,0 → 1,4), que é frequência de ataque, mais a vida
  (~1,12× por encontro, ancorada nos 154.392 do CEIFADOR) e `Boss.pesoDoNivel` (até +30% de
  vida pelo nível do jogador, só no Ato II).
- **`HISTORIA.md` é a fonte da verdade da narrativa.** Nome de inimigo, fala, cor de ato,
  quem aparece em qual região: sai de lá. Inventar narrativa fora dela cria contradição —
  se algo precisa mudar, muda o arquivo primeiro.

- **Os atos não se misturam.** `ato: 1` é a Arena Neon (ondas 1–100), `ato: 2` é NÁDIR
  (101–200). `Jogo.tiposDaOnda` é a única porta de sorteio de inimigo, e ela filtra por ato:
  nenhum bicho do Ato I aparece em NÁDIR e nenhuma ruína vaza para a Arena. Isso é pedido do
  Enzo, de 18/09/2026, e um teste varre as 200 ondas. Inimigo novo nasce com `ato` — sem ele
  o filtro assume Ato I e o bicho vaza para a Arena em silêncio.

- **As cinco ruínas são as classes jogáveis apodrecidas**, uma por classe, com o jeito de
  lutar preservado: quem jogou de SNIPER reconhece o tiro que está tomando. Corpo comido vem
  de `podre: true`, sorteado **uma vez** no construtor (`mordidas`), nunca no desenho.

- **O aviso de atualização é obrigatório.** Pedido do Enzo em 18/09/2026: saiu versão nova, a
  faixa desce na tela sozinha, sem o jogador ir procurar. Duas coisas a sustentam e quebram em
  silêncio: `sw.js` deixa passar direto todo pedido com `?atualizacao=` na query, e nenhum
  comentário de `src/versao.js` pode conter uma linha na forma `    versao: '...'` — o
  verificador lê a primeira que encontra. Teste guarda a segunda.

- **Partida encerrada não se reescreve**: `derrota()` sai fora se o estado já é `gameover` ou
  `vitoria`. Sem isso, a segunda chamada no mesmo quadro trocava o final do segredo por um
  GAME OVER comum.

- **Balanceamento se mede, não se chuta.** `node ferramentas/medir-dano.js`
  (e `--ult`) põe cada classe na frente de um boss e conta o dano que entra.
  Antes de mexer em dano de classe ou vida de boss, rode e compare.
- **ESPECTRO fica na faixa das outras classes** (nerf de 18/09, pedido do Enzo):
  no máximo ~1,35× a segunda classe no tiro, e a CARNIFICINA na mesma ordem de
  grandeza das outras ultimates. O eco da ult **não fere boss** — é arma de
  multidão. Três testes travam isso.
- **Vida de boss sobe em passo constante (~1,33× por encontro).** Sem degrau no
  meio da campanha: era isso que fazia o boss da onda 30 virar parede. O
  CEIFADOR fica fora da conta porque regenera.

## Convenções

- **Português** em nome de variável, comentário e mensagem de commit.
- Comentário só onde a intenção não é óbvia — e explicando *por quê*, não *o quê*.
- Remoção de entidade por flag `.vivo`, nunca `splice` em dois lugares.
- Pool fixo de partículas: nada de alocação por quadro.
- Delta-time com teto de 50 ms.
- Áudio é sintetizado no WebAudio. A única exceção são as falas de
  `assets/encaixa-*.m4a`, que tocam na queda do boss da onda 10; fora delas,
  nenhum arquivo de som entra no projeto.
- Arte é vetorial, desenhada em código. Imagem só nos ícones da loja.
- Migration de banco sempre versionada em `banco/migracoes/`, nunca SQL solto.

## Invariantes do cooperativo

Quebrar qualquer um destes quebra o modo online:

- A autoridade é o **anfitrião**. Ele simula tudo e manda snapshot; `servidor/salas.js` só
  encaminha e não guarda estado de jogo.
- `Jogador.moverPrevisto` (previsão local do convidado) **nunca** cria projétil nem mexe em
  temporizador de combate. Tiro, dano, dash e progressão são sempre do anfitrião.
- Toda entidade nova recebe `id` no construtor via `Jogo.proximoId()`. Sem id não há
  interpolação — a entidade é recriada a cada pacote e teletransporta.
- Nada vindo da rede entra cru na simulação: comando de convidado passa por
  `Coop.validarControle` (faixa e frequência) antes de tocar em qualquer coisa.
- Partida cooperativa não entra em ranking nenhum, nem no recorde local, enquanto a
  autoridade for o navegador do anfitrião.
- Não trafega o que o convidado remonta sozinho: `def` de inimigo, `classe`, `skin` e rastro
  são reconstruídos do lado dele a partir do `tipo`.

## Cores de tiro

Só os tiros disparados pelo jogador usam a paleta nova (`CORES_TIRO`: lima, branco no
crítico). Tiro, laser e reflexão de inimigo e de boss mantêm as cores e formas originais.
Jogador, inimigo e boss nunca compartilham a mesma cor de projétil.

## Nomes internos que parecem errados e não são

O jogo se chamou SOBRECARGA por algumas horas em 09/09/2026 e voltou ao nome antigo. Ficaram
com o nome de lá, de propósito: a tabela `placar_sobrecarga` no Neon, o projeto
`sobrecarga-placar` e o prefixo `sniper.` no `localStorage`. São nomes internos que o jogador
nunca vê — renomear em produção custa e não entrega nada. Não "arrumar".

## Credencial

`api/conexao-local.js` fica fora do Git e guarda a string do Neon. Nunca commitar, nunca
imprimir, nunca mandar pro navegador — o jogo só conhece a rota `/api/placar`.

## Gravar no Segundo Cérebro

Coisa nova construída ou decidida aqui entra também em
`Desktop\Segundo cerebro\Log\construcoes.md` e `Log\decisoes.md`, com a data, antes da
resposta acabar. Mudança de estado do projeto vai em `03-Projetos-Ativos.md`.
