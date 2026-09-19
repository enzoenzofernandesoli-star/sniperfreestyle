/* ===========================================================================
   VERSAO.JS — versão do jogo, histórico de atualizações e temporada do ranking.

   Uma coisa importante mora aqui: **a temporada do ranking é o número de
   entradas desta lista**. Publicar uma atualização é acrescentar um item em
   `ATUALIZACOES` — e isso, por si, abre temporada nova e limpa o ranking, no
   mundial e no local. Não existe botão de zerar placar: quem zera é a versão.

   A lista mais recente vem primeiro. `itens` é o que o jogador sente, não o
   que mudou no código: ninguém liga para refatoração.
   =========================================================================== */

/* Este arquivo é lido de fora, por requisição, para descobrir se o servidor já
   tem versão mais nova que a que está rodando na tela do jogador — é assim que
   o aviso de atualização aparece sem ninguém ir procurar (JOGO.versaoDoServidor).

   O verificador procura a PRIMEIRA linha que começa com quatro espaços e o
   campo de versão, que é exatamente como a lista abaixo é escrita. Por isso:
   mantenha a versão mais recente no topo, com a indentação de sempre, e não
   escreva esse campo em comentário nenhum deste arquivo — comentário com a
   mesma forma seria lido no lugar da versão de verdade, e o aviso pararia de
   funcionar em silêncio. Um teste guarda essa regra. */
const ATUALIZACOES = [
  {
    versao: '2.0.0',
    data: '18/09/2026',
    titulo: 'Fim da Linha',
    itens: [
      'Depois do último boss existe mais uma coisa. Não vou dizer o que é.',
      'A POSSESSÃO foi removida. A tecla E agora é atalho da ultimate, junto com SHIFT.',
      'Emoji comprado na loja virou o seu corpo: você É o emoji, ele não fica mais flutuando em cima da nave.',
      'Lojinha ficou mais caro em tudo: de duas a três vezes o preço antigo.',
      'Botão ATUALIZAR no menu, com o histórico completo de versões.',
      'Saiu versão nova? Um aviso desce na tela sozinho, no menu ou no meio da luta.',
      'Ranking agora tem temporada: cada atualização começa um placar novo, mundial e local.'
    ]
  },
  {
    versao: '1.4.0',
    data: 'setembro de 2026',
    titulo: 'Loja, Cooperativo e as 100 ondas',
    itens: [
      'Lojinha de cosméticos com moeda que cai de inimigo: cor de nave, cor de tiro, acessório e emoji.',
      'Cooperativo de até 4 jogadores por código de sala.',
      'Campanha esticada para 100 ondas, com 14 bosses e o CEIFADOR ABSOLUTO no fim.',
      'Quinta classe: INVOCADOR, que luta com drones.',
      'Inimigo elite, novos tipos e dificuldade que continua subindo depois da onda 40.'
    ]
  },
  {
    versao: '1.1.0',
    data: '10/09/2026',
    titulo: 'Celular de verdade',
    itens: [
      'Telas refeitas para celular deitado, com a escolha de classe em carrossel.',
      'Blur removido de toda a interface.',
      'A página deixou de rolar: quando não cabe, rola só o conteúdo.',
      'Virou aplicativo instalável, que abre e joga sem internet.'
    ]
  },
  {
    versao: '1.0.0',
    data: '09/09/2026',
    titulo: 'Arena Neon',
    itens: [
      'Reescrita completa: classes jogáveis, bosses com fases, melhorias por nível e placar mundial.',
      'Áudio sintetizado no navegador, sem nenhum arquivo de som.',
      'Controles de toque com dois joysticks e botão de tiro.'
    ]
  }
];

const JOGO = {
  get versao() { return ATUALIZACOES[0].versao; },
  get data() { return ATUALIZACOES[0].data; },
  get notas() { return ATUALIZACOES[0]; },

  // Temporada = quantidade de versões publicadas. T4 é a atual porque a lista
  // tem quatro entradas; o próximo item aqui vira T5 e o ranking recomeça.
  get temporada() { return 'T' + ATUALIZACOES.length; },

  CHAVE: 'sniper.versao',

  /* Compara a versão guardada no aparelho com a de agora. Devolve:
       'igual'     — mesma versão de antes
       'primeira'  — nunca abriu o jogo neste navegador
       'nova'      — atualizou desde a última vez que jogou               */
  situacao() {
    let anterior = null;
    try { anterior = localStorage.getItem(JOGO.CHAVE); } catch (e) { anterior = null; }
    if (!anterior) return 'primeira';
    return anterior === JOGO.versao ? 'igual' : 'nova';
  },

  /* --------------------- Versão nova no servidor ---------------------- */
  /* Compara duas versões 'x.y.z' número por número. Devolve 1 se `a` é mais
     nova, -1 se é mais velha, 0 se são iguais. Comparar como texto erraria:
     '2.10.0' é maior que '2.9.0', mas vem antes na ordem alfabética. */
  comparar(a, b) {
    const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  },

  /* Lê a versão que está NO SERVIDOR agora. Dois cuidados:

     - `?atualizacao=` no endereço: é o sinal que faz o service worker deixar o
       pedido passar direto para a rede. Sem isso ele responde do cache e o
       jogo rodando nunca descobriria que saiu versão nova — que é justamente o
       que este código existe para descobrir.
     - `cache: 'no-store'`: o mesmo cuidado, do lado do navegador.

     Devolve null quando não deu (sem rede, arquivo movido, resposta estranha):
     não saber a versão do servidor nunca pode virar erro na cara de quem joga. */
  async versaoDoServidor() {
    try {
      const resposta = await fetch('src/versao.js?atualizacao=' + Date.now(), { cache: 'no-store' });
      if (!resposta.ok) return null;
      const texto = await resposta.text();
      const achou = texto.match(/^ {4}versao: '([0-9]+(?:\.[0-9]+)*)'/m);
      return achou ? achou[1] : null;
    } catch (e) {
      return null;
    }
  },

  /* true quando o servidor tem versão mais nova que a que está rodando. */
  async temAtualizacao() {
    const doServidor = await JOGO.versaoDoServidor();
    if (!doServidor) return false;
    JOGO.versaoNoServidor = doServidor;
    return JOGO.comparar(doServidor, JOGO.versao) > 0;
  },

  anotarVersao() {
    try { localStorage.setItem(JOGO.CHAVE, JOGO.versao); } catch (e) { /* modo privado */ }
  },

  /* Busca atualização de verdade: joga fora o cache do service worker e
     recarrega do servidor. É o que o botão ATUALIZAR faz. */
  async atualizarAgora() {
    try {
      if ('serviceWorker' in navigator) {
        const registros = await navigator.serviceWorker.getRegistrations();
        for (const r of registros) await r.unregister();
      }
      if (window.caches) {
        const nomes = await caches.keys();
        for (const n of nomes) await caches.delete(n);
      }
    } catch (e) { /* sem service worker: recarregar já resolve */ }
    // O parâmetro obriga o navegador a buscar o HTML novo em vez do guardado.
    const url = location.origin + location.pathname + '?atualizado=' + Date.now();
    location.replace(url);
  }
};
