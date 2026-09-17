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
   lacaios .......... drones que seguem o jogador e atiram sozinhos
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
    ult: { nome: 'TRAÇANTE', descricao: 'Feixe largo que varre a arena inteira e destroça a linha toda.' },
    atributos: {
      vidaMax: 2, velocidade: 300, cadencia: 0.42, dano: 34, projeteis: 1,
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
    descricao: 'Mais vida e escudo que REFLETE projéteis inimigos. Lento, mas resistente.',
    forcas: ['4 corações', 'Escudo reflete tiros', 'Recarrega escudo rápido'],
    fraquezas: ['Movimento lento', 'Dano médio'],
    somTiro: 'pesado',
    ult: { nome: 'IMPACTO', descricao: 'Onda de 820 px que arremessa os inimigos e apaga os tiros no caminho.' },
    atributos: {
      vidaMax: 4, velocidade: 225, cadencia: 0.3, dano: 16, projeteis: 1,
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
    descricao: 'A classe mais forte do jogo, e a que mais cobra por isso: o dano só existe colado no inimigo. Escopeta de alcance curtíssimo, dash que corta e cura a cada abate.',
    forcas: ['5 projéteis de 13 de dano por tiro', 'Dash corta quem encostar', 'Cura 2,5% da vida a cada abate', 'CARNIFICINA praticamente zera a arena'],
    fraquezas: ['Só 2 corações', 'Alcance curtíssimo: 360 px', 'Errou a distância, morreu'],
    somTiro: 'shotgun',
    ult: { nome: 'CARNIFICINA', descricao: 'O mundo entra em câmera lenta e só você não. 5 s intangível, foice de 175 px, ecos que cortam sozinhos, onda a cada abate e estouro final do tamanho da chacina.' },
    atributos: {
      vidaMax: 2, velocidade: 430, cadencia: 0.32, dano: 13, projeteis: 5,
      espalhamento: 0.5, balaVel: 1100, balaRaio: 5, perfuracao: 1, ricochete: 0,
      homing: 0, critChance: 0.22, critMult: 2.3,
      dashRecarga: 0.62, escudoRecarga: 12, escudoDuracao: 2, ultRecarga: 19,
      ima: 190, regen: 0, orbes: 0
    },
    dashCorta: true,
    alcanceCurto: 360,
    curaPorMorte: 0.025
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
      vidaMax: 2, velocidade: 310, cadencia: 0.26, dano: 12, projeteis: 1,
      espalhamento: 0.08, balaVel: 620, balaRaio: 7, perfuracao: 0, ricochete: 1,
      homing: 0.75, critChance: 0.1, critMult: 2,
      dashRecarga: 1.8, escudoRecarga: 11, escudoDuracao: 3, ultRecarga: 26,
      ima: 260, regen: 0, orbes: 2
    }
  },
  {
    id: 'invocador',
    nome: 'INVOCADOR',
    apelido: 'Nunca sozinho',
    cor: '#7cf2a0',
    cor2: '#1d6b45',
    icone: 'I',
    descricao: 'Dois drones caçam sozinhos enquanto o INVOCADOR sustenta a linha com tiro teleguiado.',
    forcas: ['2 drones: a bala deles é um tiro seu', '3 corações', 'Tiro teleguiado que atravessa', 'Melhoria própria: até +2 drones'],
    fraquezas: ['Cadência pessoal média', 'Drone leva um tempo para virar a mira'],
    somTiro: 'arcano',
    ult: { nome: 'LEGIÃO', descricao: 'Chama três drones extras por 10 s e acelera a tropa inteira.' },
    atributos: {
      vidaMax: 3, velocidade: 315, cadencia: 0.38, dano: 14, projeteis: 1,
      espalhamento: 0.04, balaVel: 980, balaRaio: 6, perfuracao: 1, ricochete: 0,
      homing: 0.5, critChance: 0.18, critMult: 2.1,
      dashRecarga: 1.5, escudoRecarga: 10, escudoDuracao: 2.8, ultRecarga: 24,
      ima: 200, regen: 0, orbes: 0, lacaios: 2
    }
  }
];

// Variantes cosméticas: não alteram atributos nem pontuação.
const SKINS = {
  sniper: [
    { id: 'original', nome: 'Original', cor: '#31e0ff', cor2: '#0b7fa8' },
    { id: 'polar', nome: 'Polar', cor: '#e6fbff', cor2: '#5289a9' },
    { id: 'solar', nome: 'Solar', cor: '#ff9f43', cor2: '#87371c' }
  ],
  guardiao: [
    { id: 'original', nome: 'Original', cor: '#ffc93c', cor2: '#a8730b' },
    { id: 'ferro', nome: 'Ferro', cor: '#c7d5e0', cor2: '#52677b' },
    { id: 'jade', nome: 'Jade', cor: '#65f0ad', cor2: '#1c7658' }
  ],
  espectro: [
    { id: 'original', nome: 'Original', cor: '#ff4d6d', cor2: '#8a0f31' },
    { id: 'veneno', nome: 'Veneno', cor: '#b6ff49', cor2: '#4d7916' },
    { id: 'sombra', nome: 'Sombra', cor: '#b28aff', cor2: '#4c2b77' }
  ],
  arcano: [
    { id: 'original', nome: 'Original', cor: '#b06dff', cor2: '#5a1fa8' },
    { id: 'aurora', nome: 'Aurora', cor: '#6cf5e9', cor2: '#225c79' },
    { id: 'rubi', nome: 'Rubi', cor: '#ff6588', cor2: '#87284f' }
  ],
  invocador: [
    { id: 'original', nome: 'Original', cor: '#7cf2a0', cor2: '#1d6b45' },
    { id: 'enxofre', nome: 'Enxofre', cor: '#ffe14d', cor2: '#7a6410' },
    { id: 'abissal', nome: 'Abissal', cor: '#6db6ff', cor2: '#1c3f70' }
  ]
};

function skinDaClasse(classeId, skinId) {
  return SKINS[classeId].find((skin) => skin.id === skinId) || SKINS[classeId][0];
}

function classePorId(id) {
  for (const c of CLASSES) if (c.id === id) return c;
  return CLASSES[0];
}

/* --------------------------- Melhorias (upgrades) ------------------------ */
/* raridade: 'comum' | 'raro' | 'epico' | 'lendario'                         */

const MELHORIAS = [
  {
    id: 'dano', nome: 'PÓLVORA NEGRA', icone: '✦', raridade: 'comum', max: 4,
    texto: '+15% de dano',
    aplicar: (p) => { p.attr.dano *= 1.15; }
  },
  {
    id: 'cadencia', nome: 'GATILHO SOLTO', icone: '⚡', raridade: 'comum', max: 4,
    texto: '+15% de cadência de tiro',
    aplicar: (p) => { p.attr.cadencia *= 0.85; }
  },
  {
    id: 'velocidade', nome: 'BOTAS LEVES', icone: '➤', raridade: 'comum', max: 3,
    texto: '+12% de velocidade',
    aplicar: (p) => { p.attr.velocidade *= 1.12; }
  },
  {
    id: 'vida', nome: 'PLACA DE AÇO', icone: '❤', raridade: 'comum', max: 3,
    texto: '+1 coração (e cura 1), até o teto de 6',
    aplicar: (p) => { p.attr.vidaMax = Math.min(Jogador.VIDA_MAXIMA, p.attr.vidaMax + 1); p.vida = Math.min(p.attr.vidaMax, p.vida + 1); }
  },
  {
    id: 'projetil', nome: 'CANO DUPLO', icone: '⋔', raridade: 'raro', max: 3,
    texto: '+1 projétil por tiro',
    aplicar: (p) => { p.attr.projeteis += 1; p.attr.espalhamento = Math.max(0.14, p.attr.espalhamento + 0.1); }
  },
  {
    id: 'perfuracao', nome: 'PONTA DE TUNGSTÊNIO', icone: '⇴', raridade: 'raro', max: 3,
    texto: 'Projétil atravessa +1 inimigo',
    aplicar: (p) => { p.attr.perfuracao += 1; }
  },
  {
    id: 'ricochete', nome: 'QUICA-QUICA', icone: '⟲', raridade: 'raro', max: 2,
    texto: 'Projétil quica +1 vez nas paredes',
    aplicar: (p) => { p.attr.ricochete += 1; }
  },
  {
    id: 'crit', nome: 'OLHO DE ÁGUIA', icone: '◎', raridade: 'raro', max: 3,
    texto: '+10% de crítico',
    aplicar: (p) => { p.attr.critChance = Math.min(0.85, p.attr.critChance + 0.1); }
  },
  {
    id: 'critdano', nome: 'EXECUÇÃO', icone: '☠', raridade: 'epico', max: 3,
    texto: '+60% de dano crítico',
    aplicar: (p) => { p.attr.critMult += 0.6; }
  },
  {
    id: 'dash', nome: 'REATOR DE DASH', icone: '»', raridade: 'comum', max: 3,
    texto: '-22% na recarga do dash',
    aplicar: (p) => { p.attr.dashRecarga *= 0.78; }
  },
  {
    id: 'escudo', nome: 'CAPACITOR', icone: '⛨', raridade: 'raro', max: 3,
    texto: '-25% na recarga do escudo',
    aplicar: (p) => { p.attr.escudoRecarga *= 0.75; }
  },
  {
    id: 'ult', nome: 'NÚCLEO INSTÁVEL', icone: '★', raridade: 'epico', max: 3,
    texto: '-25% na recarga da ultimate',
    aplicar: (p) => { p.attr.ultRecarga *= 0.75; }
  },
  {
    id: 'orbe', nome: 'SATÉLITE', icone: '◉', raridade: 'epico', max: 3,
    texto: '+1 orbe orbital que causa dano',
    aplicar: (p) => { p.attr.orbes += 1; p.sincronizarOrbes(); }
  },
  {
    id: 'regen', nome: 'SIMBIOSE', icone: '✚', raridade: 'epico', max: 2,
    texto: 'Regenera 0.025 coração/s',
    aplicar: (p) => { p.attr.regen += 0.025; }
  },
  {
    id: 'ima', nome: 'ÍMÃ GRAVITACIONAL', icone: '◈', raridade: 'comum', max: 3,
    texto: '+70 de raio de coleta de XP',
    aplicar: (p) => { p.attr.ima += 70; }
  },
  {
    id: 'xp', nome: 'APRENDIZ RÁPIDO', icone: '✧', raridade: 'raro', max: 3,
    texto: '+25% de XP ganho',
    aplicar: (p) => { p.multXP += 0.25; }
  },
  {
    id: 'lacaio', nome: 'MAIS UM NA TROPA', icone: '⌬', raridade: 'epico', max: 2,
    texto: '+1 drone (só para o INVOCADOR)',
    exige: (p) => p.classe.id === 'invocador',
    aplicar: (p) => { p.attr.lacaios = (p.attr.lacaios || 0) + 1; p.sincronizarLacaios(); }
  },
  {
    id: 'balavel', nome: 'ACELERADOR', icone: '↠', raridade: 'comum', max: 3,
    texto: '+20% de velocidade do projétil',
    aplicar: (p) => { p.attr.balaVel *= 1.2; }
  },
  {
    id: 'homing', nome: 'MIRA MAGNÉTICA', icone: '⌖', raridade: 'epico', max: 2,
    texto: 'Projétil persegue o inimigo mais próximo',
    aplicar: (p) => { p.attr.homing = Math.min(1.2, p.attr.homing + 0.4); }
  },
  {
    id: 'sobra', nome: 'SOBRA DE CARGA', icone: '⧖', raridade: 'raro', max: 3,
    texto: '+0.4s de duração no escudo',
    aplicar: (p) => { p.attr.escudoDuracao += 0.4; }
  },
  {
    id: 'vampiro', nome: 'SEDE', icone: '❖', raridade: 'lendario', max: 2,
    texto: '5% de chance de curar ao matar',
    aplicar: (p) => { p.vampirismo += 0.05; }
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
// Melhoria já pegada perde peso a cada cópia: a carta ainda pode repetir, mas as
// três opções tendem a trazer coisa nova em vez do mesmo +dano de sempre.
function pesoMelhoria(jogador, m) {
  const tem = jogador.melhorias[m.id] || 0;
  return PESO_RARIDADE[m.raridade] * Math.pow(0.45, tem);
}

function sortearMelhorias(jogador, quantidade) {
  quantidade = quantidade || 3;
  const disponiveis = MELHORIAS.filter((m) => (jogador.melhorias[m.id] || 0) < m.max
    && (!m.exige || m.exige(jogador)));
  const sorteadas = [];
  const usadas = {};
  let tentativas = 0;
  while (sorteadas.length < quantidade && disponiveis.length && tentativas++ < 400) {
    const pesoTotal = disponiveis.reduce((s, m) => s + (usadas[m.id] ? 0 : pesoMelhoria(jogador, m)), 0);
    if (pesoTotal <= 0) break;
    let r = Math.random() * pesoTotal;
    for (const m of disponiveis) {
      if (usadas[m.id]) continue;
      r -= pesoMelhoria(jogador, m);
      if (r <= 0) { usadas[m.id] = true; sorteadas.push(m); break; }
    }
  }
  return sorteadas;
}
