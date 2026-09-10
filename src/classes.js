/* ===========================================================================
   CLASSES.JS — as 4 classes jogáveis e a árvore de melhorias (roguelite).
   =========================================================================== */

/* Estrutura de atributos usada pelo Jogador:
   vidaMax .......... corações (1 = 1 coração)
   velocidade ....... aceleração alvo em px/s
   cadencia ......... segundos entre tiros
   dano ............. dano por projétil
   projeteis ........ projéteis por tiro
   espalhamento ..... radianos de abertura total
   balaVel .......... px/s
   balaRaio ......... px
   perfuracao ....... quantos inimigos o projétil atravessa
   ricochete ........ quantas vezes quica na parede
   homing ........... 0..1 força de perseguição
   critChance ....... 0..1
   critMult ......... multiplicador
   dashRecarga ...... segundos
   escudoRecarga .... segundos
   escudoDuracao .... segundos
   ultRecarga ....... segundos
   ima .............. raio de atração de XP
   regen ............ vida por segundo
   orbes ............ orbes orbitais que dão dano de contato
*/

const CLASSES = [
  {
    id: 'sniper',
    nome: 'SNIPER',
    apelido: 'Precisão cirúrgica',
    cor: '#31e0ff',
    cor2: '#0b7fa8',
    icone: 'M',
    descricao: 'Tiro perfurante de dano alto e cadência baixa. Crítico natural. Morre rápido se deixar chegar perto.',
    forcas: ['Dano por tiro altíssimo', 'Perfura 2 inimigos', '25% de crítico'],
    fraquezas: ['Cadência lenta', 'Vida baixa'],
    somTiro: 'sniper',
    ult: { nome: 'TRAÇANTE', descricao: 'Raio que atravessa a arena inteira e marca todo alvo tocado.' },
    atributos: {
      vidaMax: 3, velocidade: 300, cadencia: 0.42, dano: 34, projeteis: 1,
      espalhamento: 0, balaVel: 1500, balaRaio: 5, perfuracao: 2, ricochete: 0,
      homing: 0, critChance: 0.25, critMult: 2.4,
      dashRecarga: 1.5, escudoRecarga: 12, escudoDuracao: 2.5, ultRecarga: 22,
      ima: 130, regen: 0, orbes: 0
    }
  },
  {
    id: 'guardiao',
    nome: 'GUARDIÃO',
    apelido: 'Parede com gatilho',
    cor: '#ffc93c',
    cor2: '#a8730b',
    icone: 'G',
    descricao: 'Muita vida e escudo que REFLETE projéteis inimigos. Lento, mas quase não morre.',
    forcas: ['6 corações', 'Escudo reflete tiros', 'Recarrega escudo rápido'],
    fraquezas: ['Movimento lento', 'Dano médio'],
    somTiro: 'pesado',
    ult: { nome: 'IMPACTO', descricao: 'Onda de choque que empurra e destroça tudo em volta.' },
    atributos: {
      vidaMax: 6, velocidade: 225, cadencia: 0.3, dano: 16, projeteis: 1,
      espalhamento: 0.05, balaVel: 950, balaRaio: 8, perfuracao: 1, ricochete: 0,
      homing: 0, critChance: 0.08, critMult: 1.8,
      dashRecarga: 2.2, escudoRecarga: 7, escudoDuracao: 4, ultRecarga: 20,
      ima: 120, regen: 0.05, orbes: 0
    },
    escudoReflete: true
  },
  {
    id: 'espectro',
    nome: 'ESPECTRO',
    apelido: 'Sangue e velocidade',
    cor: '#ff4d6d',
    cor2: '#8a0f31',
    icone: 'E',
    descricao: 'Escopeta de curto alcance e dash que corta. Velocíssimo, frágil, cura ao matar.',
    forcas: ['5 projéteis por tiro', 'Dash causa dano', 'Cura 2% ao matar'],
    fraquezas: ['Só 3 corações', 'Alcance curto'],
    somTiro: 'shotgun',
    ult: { nome: 'CARNIFICINA', descricao: 'Fica intangível e corta tudo que tocar por 3 segundos.' },
    atributos: {
      vidaMax: 3, velocidade: 400, cadencia: 0.36, dano: 9, projeteis: 5,
      espalhamento: 0.5, balaVel: 1050, balaRaio: 4, perfuracao: 0, ricochete: 0,
      homing: 0, critChance: 0.14, critMult: 2,
      dashRecarga: 0.75, escudoRecarga: 14, escudoDuracao: 2, ultRecarga: 24,
      ima: 170, regen: 0, orbes: 0
    },
    dashCorta: true,
    alcanceCurto: 340,
    curaPorMorte: 0.02
  },
  {
    id: 'arcano',
    nome: 'ARCANO',
    apelido: 'Controle total',
    cor: '#b06dff',
    cor2: '#5a1fa8',
    icone: 'A',
    descricao: 'Orbes teleguiados e dois satélites que trituram quem se aproxima. Escala melhor que todos.',
    forcas: ['Projétil teleguiado', '2 orbes orbitais', 'Ímã de XP enorme'],
    fraquezas: ['Projétil lento', 'Dano inicial baixo'],
    somTiro: 'arcano',
    ult: { nome: 'SINGULARIDADE', descricao: 'Buraco negro que suga todos os inimigos e explode.' },
    atributos: {
      vidaMax: 3, velocidade: 310, cadencia: 0.26, dano: 12, projeteis: 1,
      espalhamento: 0.08, balaVel: 620, balaRaio: 7, perfuracao: 0, ricochete: 1,
      homing: 0.75, critChance: 0.1, critMult: 2,
      dashRecarga: 1.8, escudoRecarga: 11, escudoDuracao: 3, ultRecarga: 26,
      ima: 260, regen: 0, orbes: 2
    }
  }
];

function classePorId(id) {
  for (const c of CLASSES) if (c.id === id) return c;
  return CLASSES[0];
}

/* --------------------------- Melhorias (upgrades) ------------------------ */
/* raridade: 'comum' | 'raro' | 'epico' | 'lendario'                         */

const MELHORIAS = [
  {
    id: 'dano', nome: 'PÓLVORA NEGRA', icone: '✦', raridade: 'comum', max: 8,
    texto: '+18% de dano',
    aplicar: (p) => { p.attr.dano *= 1.18; }
  },
  {
    id: 'cadencia', nome: 'GATILHO SOLTO', icone: '⚡', raridade: 'comum', max: 8,
    texto: '+15% de cadência de tiro',
    aplicar: (p) => { p.attr.cadencia *= 0.85; }
  },
  {
    id: 'velocidade', nome: 'BOTAS LEVES', icone: '➤', raridade: 'comum', max: 6,
    texto: '+12% de velocidade',
    aplicar: (p) => { p.attr.velocidade *= 1.12; }
  },
  {
    id: 'vida', nome: 'PLACA DE AÇO', icone: '❤', raridade: 'comum', max: 6,
    texto: '+1 coração (e cura 1)',
    aplicar: (p) => { p.attr.vidaMax += 1; p.vida = Math.min(p.attr.vidaMax, p.vida + 1); }
  },
  {
    id: 'projetil', nome: 'CANO DUPLO', icone: '⋔', raridade: 'raro', max: 4,
    texto: '+1 projétil por tiro',
    aplicar: (p) => { p.attr.projeteis += 1; p.attr.espalhamento = Math.max(0.14, p.attr.espalhamento + 0.1); }
  },
  {
    id: 'perfuracao', nome: 'PONTA DE TUNGSTÊNIO', icone: '⇴', raridade: 'raro', max: 4,
    texto: 'Projétil atravessa +1 inimigo',
    aplicar: (p) => { p.attr.perfuracao += 1; }
  },
  {
    id: 'ricochete', nome: 'QUICA-QUICA', icone: '⟲', raridade: 'raro', max: 3,
    texto: 'Projétil quica +1 vez nas paredes',
    aplicar: (p) => { p.attr.ricochete += 1; }
  },
  {
    id: 'crit', nome: 'OLHO DE ÁGUIA', icone: '◎', raridade: 'raro', max: 5,
    texto: '+10% de crítico',
    aplicar: (p) => { p.attr.critChance = Math.min(0.85, p.attr.critChance + 0.1); }
  },
  {
    id: 'critdano', nome: 'EXECUÇÃO', icone: '☠', raridade: 'epico', max: 4,
    texto: '+60% de dano crítico',
    aplicar: (p) => { p.attr.critMult += 0.6; }
  },
  {
    id: 'dash', nome: 'REATOR DE DASH', icone: '»', raridade: 'comum', max: 5,
    texto: '-22% na recarga do dash',
    aplicar: (p) => { p.attr.dashRecarga *= 0.78; }
  },
  {
    id: 'escudo', nome: 'CAPACITOR', icone: '⛨', raridade: 'raro', max: 5,
    texto: '-25% na recarga do escudo',
    aplicar: (p) => { p.attr.escudoRecarga *= 0.75; }
  },
  {
    id: 'ult', nome: 'NÚCLEO INSTÁVEL', icone: '★', raridade: 'epico', max: 4,
    texto: '-25% na recarga da ultimate',
    aplicar: (p) => { p.attr.ultRecarga *= 0.75; }
  },
  {
    id: 'orbe', nome: 'SATÉLITE', icone: '◉', raridade: 'epico', max: 4,
    texto: '+1 orbe orbital que causa dano',
    aplicar: (p) => { p.attr.orbes += 1; p.sincronizarOrbes(); }
  },
  {
    id: 'regen', nome: 'SIMBIOSE', icone: '✚', raridade: 'epico', max: 4,
    texto: 'Regenera 0.06 coração/s',
    aplicar: (p) => { p.attr.regen += 0.06; }
  },
  {
    id: 'ima', nome: 'ÍMÃ GRAVITACIONAL', icone: '◈', raridade: 'comum', max: 4,
    texto: '+70 de raio de coleta de XP',
    aplicar: (p) => { p.attr.ima += 70; }
  },
  {
    id: 'xp', nome: 'APRENDIZ RÁPIDO', icone: '✧', raridade: 'raro', max: 4,
    texto: '+25% de XP ganho',
    aplicar: (p) => { p.multXP += 0.25; }
  },
  {
    id: 'explode', nome: 'CARGA DE FRAGMENTOS', icone: '✹', raridade: 'lendario', max: 3,
    texto: 'Inimigo morto explode em estilhaços',
    aplicar: (p) => { p.explodeAoMatar += 1; }
  },
  {
    id: 'balavel', nome: 'ACELERADOR', icone: '↠', raridade: 'comum', max: 5,
    texto: '+20% de velocidade do projétil',
    aplicar: (p) => { p.attr.balaVel *= 1.2; }
  },
  {
    id: 'homing', nome: 'MIRA MAGNÉTICA', icone: '⌖', raridade: 'epico', max: 3,
    texto: 'Projétil persegue o inimigo mais próximo',
    aplicar: (p) => { p.attr.homing = Math.min(1.2, p.attr.homing + 0.4); }
  },
  {
    id: 'tempo', nome: 'DILATAÇÃO', icone: '⧖', raridade: 'lendario', max: 2,
    texto: 'O dash congela o tempo por 0.35s',
    aplicar: (p) => { p.dashCongela += 0.35; }
  },
  {
    id: 'vampiro', nome: 'SEDE', icone: '🩸', raridade: 'lendario', max: 3,
    texto: '8% de chance de curar ao matar',
    aplicar: (p) => { p.vampirismo += 0.08; }
  },
  {
    id: 'espinho', nome: 'COURAÇA DE ESPINHOS', icone: '✜', raridade: 'raro', max: 3,
    texto: 'Refleti dano em quem te tocar',
    aplicar: (p) => { p.espinhos += 18; }
  }
];

const PESO_RARIDADE = { comum: 100, raro: 55, epico: 26, lendario: 9 };
const COR_RARIDADE = {
  comum: '#8fe3ff', raro: '#7cff9b', epico: '#c58bff', lendario: '#ffb347'
};

/* Sorteia 3 melhorias válidas (respeitando nível máximo de cada uma). */
function sortearMelhorias(jogador, quantidade) {
  quantidade = quantidade || 3;
  const disponiveis = MELHORIAS.filter((m) => (jogador.melhorias[m.id] || 0) < m.max);
  const sorteadas = [];
  const usadas = {};
  let tentativas = 0;
  while (sorteadas.length < quantidade && disponiveis.length && tentativas++ < 400) {
    const pesoTotal = disponiveis.reduce((s, m) => s + (usadas[m.id] ? 0 : PESO_RARIDADE[m.raridade]), 0);
    let r = Math.random() * pesoTotal;
    for (const m of disponiveis) {
      if (usadas[m.id]) continue;
      r -= PESO_RARIDADE[m.raridade];
      if (r <= 0) { usadas[m.id] = true; sorteadas.push(m); break; }
    }
  }
  return sorteadas;
}
