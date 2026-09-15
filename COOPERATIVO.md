# Cooperativo online — estado e decisões

Jogável desde 14/09/2026, rodando local. Arena de 1280×720 unidades, a mesma do
modo solo: os dois jogadores dividem uma única tela fixa, sem câmera que rola.

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

## O que está pronto

- Salas privadas por código de convite, 2 a 4 pessoas na mesma arena.
- Cada um escolhe classe e skin; todos veem as mesmas ondas, inimigos, bosses,
  projéteis e coletáveis, com os mesmos números.
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

`api/placar.js` consulta e grava no Neon; a migração para 40 ondas já foi aplicada em
produção. Para valer mundialmente o site precisa ser publicado com `DATABASE_URL`
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
