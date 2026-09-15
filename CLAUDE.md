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
| `GOOGLE-PLAY.md` | Publicação Android, PWA, ícones, política |

O roteiro de trabalho e os próximos passos ficam no Segundo Cérebro, em
`Desktop\Segundo cerebro\Playbooks\Sniper-Cooperativo.md`.

## Comandos

```
npm install
npm run salas      # jogo + salas cooperativas em http://localhost:8123
npm test           # 16 testes (node --test), incluindo WebSocket real
```

Sala cooperativa na mão: abrir `http://localhost:8123` em duas abas, CRIAR SALA numa,
ENTRAR NA SALA na outra com o código de 8 dígitos.

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
