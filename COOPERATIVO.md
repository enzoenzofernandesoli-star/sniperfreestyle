# Cooperativo online — plano de implementação

O jogo atual simula toda a partida no navegador e usa um único `Jogo.jogador`.
O Neon já armazena o placar mundial, mas não sincroniza combate. Uma segunda
aba aberta hoje inicia outra partida independente.

## Partida proposta

- Salas privadas por convite para 2 a 4 jogadores na mesma arena.
- Cada pessoa escolhe classe e skin. Todos veem as mesmas ondas, inimigos,
  bosses, projéteis e coletáveis.
- O servidor recebe apenas movimento, mira e ações. Ele decide colisões, dano,
  drops, progressão e fim de partida; envia estados compactos aos clientes.
- Reconexão curta devolve o jogador à sala. Sala vazia expira automaticamente.
- Derrota quando todos morrem. Pontuação da equipe vai ao placar mundial com
  identificação da sala e dos participantes, em seção separada do solo.

## Mudanças necessárias

1. Extrair a simulação de `src/jogo.js`, `src/entidades.js` e `src/classes.js`
   da dependência de canvas, DOM, som e `Input`. O servidor deve executar essa
   simulação sem navegador.
2. Trocar referências a `Jogo.jogador` por coleção de jogadores. Alvos de
   inimigos, colisões, escudos, XP e melhorias precisam considerar cada pessoa.
3. Criar serviço de salas com transporte em tempo real, código de convite,
   limite de participantes e snapshots versionados. Validar frequência e faixa
   de cada comando recebido.
4. Adaptar cliente para interpolar snapshots, enviar comandos e mostrar os
   outros jogadores, saúde e estado de conexão no HUD, inclusive no celular.
5. Gravar placar cooperativo a partir do servidor da partida, sem aceitar
   pontuação informada diretamente pelo navegador.
6. Testar duas ou mais conexões reais, latência, reconexão e perda de rede.

Não usar o Neon como canal de mensagens por quadro. Ele continua como banco de
resultados. A hospedagem do serviço de salas precisa ser escolhida e vinculada
à conta de deploy; a função HTTP atual do placar não oferece estado de partida.

## Estado do ranking

`api/placar.js` já consulta e grava no Neon; a migração para 40 ondas foi
aplicada. Para ficar acessível mundialmente, o site precisa ser publicado com
`DATABASE_URL` configurada no servidor. A API não deve expor essa credencial ao
navegador. O ranking solo atual aceita resultados enviados pelo cliente e,
portanto, ainda não é resistente a pontuações fabricadas.
