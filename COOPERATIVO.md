# Cooperativo online — estado e decisões

Jogável desde 14/09/2026, rodando local e no Render. Arena de 1760×990 unidades, a
mesma do modo solo: todo mundo divide uma única tela fixa, sem câmera que rola.

## A escolha que define tudo: quem é a autoridade

O plano original era extrair a simulação do navegador e rodá-la no servidor. Não foi
esse o caminho. **A autoridade é o anfitrião**: ele roda a partida inteira no próprio
navegador — ondas, inimigos, bosses, colisões, dano, drops, progressão — e manda
snapshots. O servidor de salas (`servidor/salas.js`) só encaminha mensagem e cuida da
sala; nenhum estado de jogo mora lá.

O motivo é prático. Rodar a simulação no servidor exigiria arrancar `src/jogo.js`,
`src/entidades.js` e `src/classes.js` da dependência de canvas, DOM, som e `Input` —
uma reescrita grande, que trava o modo até ficar pronta e ainda obriga a manter duas
versões do mesmo código. Com o anfitrião como autoridade o cooperativo ficou de pé sem
tocar na simulação, e o servidor ficou barato o bastante para caber em qualquer host
com WebSocket.

O preço, escrito aqui para ninguém se enganar depois: **o anfitrião pode trapacear**.
Ele roda o jogo na própria máquina. Enquanto for sala privada entre amigos, tudo bem.
No dia em que a pontuação cooperativa valer ranking público, a simulação precisa sair
do navegador — e aí o trabalho do plano original volta à mesa.

## Como a sala funciona na tela

O menu tem **CRIAR SALA** e **ENTRAR NA SALA**; os dois abrem a tela `data-tela="sala"`.

1. Quem cria vê um código sugerido, já editável — pode digitar o que quiser (4 a 8
   letras ou números) ou sortear outro — e clica em ABRIR A SALA.
2. A sala abre na hora, antes de qualquer escolha de classe, e o código fica grande na
   tela com um botão COPIAR. É esse código que o amigo digita em ENTRAR NA SALA.
3. Quem entra aparece no painel da sala dos dois lados, com nome e classe. Enquanto
   não escolher classe, a linha dele fica como "escolhendo classe…".
4. A largada é do anfitrião: COMEÇAR A PARTIDA só aparece para ele, e só funciona
   depois que ele escolheu a própria classe.
5. Quem entrar com a partida já rolando não espera nada: assim que escolhe a classe,
   o anfitrião cria a nave e manda o snapshot — o convidado cai direto na arena.

O painel da sala é publicado pelo anfitrião (mensagem `lobby`), como todo o resto: o
servidor não sabe quem está na sala além das conexões que precisa encaminhar.

### Mensagens do protocolo

| Mensagem | Direção | Para quê |
|---|---|---|
| `criar {codigo?}` | anfitrião → servidor | abre a sala; sem código o servidor sorteia um |
| `criada {codigo}` | servidor → anfitrião | código confirmado |
| `entrar {codigo, nome}` | convidado → servidor | entra na sala, ainda sem classe |
| `entrou {id, nome}` | servidor → os dois | avisa quem chegou |
| `pronto {classe, skin}` | convidado → anfitrião | escolheu classe |
| `lobby {lista}` | anfitrião → convidados | painel da sala |
| `comecou` | anfitrião → convidados | largada |
| `controle` / `estado` | convidado ↔ anfitrião | comando a 30/s e snapshot a 20/s; inclui possessão |

## Onde as salas moram

O jogo decide sozinho com quem falar, nesta ordem:

1. o que estiver em SERVIDOR DE SALAS (AVANÇADO), salvo em `sniper.coopServidor`;
2. `window.COOP_URL`, se alguma página definir;
3. o próprio endereço, quando ele hospeda WebSocket — `localhost`, IP de rede local
   ou `*.onrender.com`;
4. senão, `Coop.SERVIDOR_PADRAO` — hoje `wss://sniper-salas.onrender.com/sala`.

É a regra 4 que faz o site da Vercel jogar online: ele serve só arquivo estático,
mas as salas vêm do Render. Trocou de servidor? Muda `SERVIDOR_PADRAO` em
`src/coop.js`, um lugar só.

## Jogar pela internet, não só na rede local

O servidor de salas é WebSocket e precisa de um processo vivo. **A Vercel não hospeda
isso**: no `sniperfreestyle.vercel.app` o jogo abre, mas a sala não conecta. Duas
saídas:

- **Mesma rede**: rode `npm run salas` e todo mundo abre o IP da máquina, ex.
  `http://192.168.0.10:8123`. Funciona sem mais nada.
- **Pela internet, pelo Render**: o repositório tem `render.yaml`. No Render, New →
  Blueprint → aponte para este repositório → Apply. O mesmo processo serve o jogo e
  as salas na mesma porta, então quem abrir `https://sniper-salas.onrender.com` joga
  online sem configurar nada. Para jogar pelo endereço da Vercel, cole
  `wss://sniper-salas.onrender.com/sala` em SERVIDOR DE SALAS (AVANÇADO) — fica salvo
  no aparelho em `sniper.coopServidor`.
  O plano gratuito hiberna depois de 15 minutos parado: a primeira sala depois da
  soneca demora uns 50 segundos. Qualquer outro host com WebSocket (Railway, Fly,
  VPS) serve do mesmo jeito.

## O que está pronto

- Salas privadas por código de convite escolhido pelo anfitrião, 2 a 4 pessoas.
- Cada um escolhe classe e skin; todos veem as mesmas ondas, inimigos, bosses,
  projéteis e coletáveis, com os mesmos números.
- Possessão continua autoritativa no anfitrião. Convidado envia `possessao`/`especial`;
  snapshot devolve tipo, vida, raio, velocidade e tempo do corpo. Previsão local só
  move a aparência recebida — nunca decide entrada, saída, dano ou ataque.
- Corpo possuído sai da lista de alvos hostis. Inimigos e boss miram outro jogador
  não possuído; se todos estiverem disfarçados, seguram movimento e ataque.
- Seleção de alvo não materializa listas temporárias; isso evita travadas no anfitrião
  quando muitos inimigos recalculam a facção durante a possessão.
- Comando do convidado (movimento, mira, tiro, dash, escudo, ult) sobe a 30/s; o
  anfitrião valida faixa e frequência antes de usar (`Coop.validarControle`).
- Snapshot a 20/s, ~1,9 KB numa partida de 4 inimigos. Não trafega o que o convidado
  refaz sozinho: tabela de inimigo, classe, skin e rastro são remontados do lado dele.
- Convidado interpola e faz dead reckoning entre snapshots, e prevê a própria nave
  localmente (`Jogador.moverPrevisto`) — previsão que nunca cria projétil nem mexe em
  temporizador de combate.
- HUD: painel de equipe com apelido, classe e vida de cada um; etiqueta com nome e
  barra de vida em cima de cada colega na arena; estado da sala; botão de sair.
- XP de coletável vai para a equipe inteira. Quando um convidado sobe de nível, o
  anfitrião aplica uma melhoria sorteada na hora — carta só abre para quem hospeda, e
  enquanto ela está aberta o convidado vê o aviso de espera em vez de tela travada.
- Derrota só quando todo mundo cai; quem morre fica "CAÍDO" e a partida continua.
- Anfitrião cai → a sala morre e os convidados voltam ao menu avisados. Ping/pong
  derruba conexão morta; sala sem anfitrião ou parada há 30 min é apagada.

## O que falta

1. **Placar de equipe.** Partida cooperativa hoje não entra em ranking nenhum, nem no
   recorde local — de propósito. Gravar pontuação de time exige o servidor da partida
   fazendo o insert, não o navegador. Enquanto a autoridade for o anfitrião, isso não
   fecha.
2. **Reconexão.** Cair derruba pra valer. O servidor já guarda o id do cliente; falta
   uma janela curta em que o mesmo id volta para a mesma vaga.
3. **Hospedagem.** O serviço de salas não tem host escolhido nem vinculado à conta de
   deploy. A função HTTP do placar não serve: ela não guarda estado entre requisições.
4. **Latência real.** Tudo foi validado em rede local (duas e três abas). Falta medir
   com latência e perda de pacote de internet de verdade.

## Estado do ranking solo

`api/placar.js` consulta e grava no Neon. Modo infinito exige aplicar
`banco/migracoes/002_placar_ondas_infinitas.sql`. Para valer mundialmente o site precisa ser publicado com `DATABASE_URL`
configurada no servidor — a API nunca expõe essa credencial ao navegador. O ranking
solo ainda aceita resultado enviado pelo cliente e, portanto, não resiste a pontuação
fabricada; isso é anterior ao cooperativo e continua aberto.

## Como testar

`npm test` cobre o serviço de salas de verdade (cria sala, lota em 4, recusa o quinto,
encaminha comando e snapshot, derruba a sala quando o anfitrião cai) e a camada de
rede do cliente (validação de comando, round-trip do snapshot, reaproveitamento de
entidade por id, previsão local sem efeito colateral).

Para testar na mão: `npm run salas`, abra `http://localhost:8123` em duas abas, crie a
sala numa e entre pela outra com o código.
