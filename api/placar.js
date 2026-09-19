/* ===========================================================================
   /api/placar — placar mundial do SNIPER FREESTYLE.

   GET  /api/placar?limite=25   → top do placar
   POST /api/placar             → grava uma run

   O nome da tabela e do projeto no Neon ficou `..._sobrecarga` / `sobrecarga-placar`
   de quando o jogo se chamou SOBRECARGA. Renomear no banco quebraria o deploy sem
   ganhar nada — é nome interno, o jogador nunca vê.

   Roda na Vercel (função serverless) e fala com o Neon pelo papel `placar_app`,
   que só tem SELECT e INSERT nessa tabela. Nenhuma credencial chega ao
   navegador: o jogo só conhece esta rota.

   A validação aqui é a que vale. A do navegador é conveniência; esta é a regra.
   =========================================================================== */

const { neon } = require('@neondatabase/serverless');

// Ordem de busca da credencial:
//   1. DATABASE_URL (Vercel → Settings → Environment Variables) — o jeito certo;
//   2. api/conexao-local.js — arquivo fora do git, usado no deploy manual.
// Nada disso chega ao navegador: o jogo só conhece a rota /api/placar.
let CONEXAO = process.env.DATABASE_URL || '';
if (!CONEXAO) {
  try { CONEXAO = require('./conexao-local.js'); } catch (e) { CONEXAO = ''; }
}

const CLASSES = ['SNIPER', 'GUARDIÃO', 'ESPECTRO', 'ARCANO', 'INVOCADOR'];
// Temporada do ranking: 'T' e até três dígitos. Quem não manda entra em T1,
// que é onde ficou tudo que foi jogado antes desta regra existir.
const TEMPORADA_VALIDA = /^T[0-9]{1,3}$/;
const PROIBIDAS = ['VIADO', 'PUTA', 'CARALHO', 'BUCETA', 'PORRA', 'FDP', 'MACACO', 'NAZI', 'HITLER'];

function limparNome(valor) {
  return String(valor || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ._-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}

function inteiro(valor, min, max) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function cabecalhos(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function (req, res) {
  cabecalhos(res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!CONEXAO) {
    res.status(503).json({ erro: 'placar sem banco configurado: defina DATABASE_URL' });
    return;
  }

  const sql = neon(CONEXAO);

  /* ------------------------------- LEITURA ------------------------------ */
  if (req.method === 'GET') {
    const limite = inteiro((req.query && req.query.limite) || 25, 1, 50) || 25;
    try {
      const pedida = String((req.query && req.query.temporada) || '');
      const temporada = TEMPORADA_VALIDA.test(pedida) ? pedida : null;
      // Sem temporada na consulta o ranking vem inteiro: cliente antigo
      // continua funcionando, só sem o corte por temporada.
      const linhas = temporada
        ? await sql`
            select nome, pontos, classe, onda, venceu, criado_em
            from public.placar_sobrecarga
            where temporada = ${temporada}
            order by pontos desc, criado_em asc
            limit ${limite}
          `
        : await sql`
            select nome, pontos, classe, onda, venceu, criado_em
            from public.placar_sobrecarga
            order by pontos desc, criado_em asc
            limit ${limite}
          `;
      res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
      res.status(200).json(linhas);
    } catch (e) {
      res.status(500).json({ erro: 'banco indisponível' });
    }
    return;
  }

  /* ------------------------------- GRAVAÇÃO ----------------------------- */
  if (req.method === 'POST') {
    let corpo = req.body;
    if (typeof corpo === 'string') {
      try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; }
    }
    if (!corpo || typeof corpo !== 'object') {
      res.status(400).json({ erro: 'corpo inválido' });
      return;
    }

    const nome = limparNome(corpo.nome) || 'ANONIMO';
    const semSeparador = nome.replace(/[ ._-]/g, '');
    if (PROIBIDAS.some((p) => semSeparador.indexOf(p) >= 0)) {
      res.status(400).json({ erro: 'nome recusado' });
      return;
    }

    const pontos = inteiro(corpo.pontos, 0, 5000000);
    // Dois atos: 1 a 100 é a Arena, 101 a 200 é NÁDIR. O CHECK do banco tem o
    // mesmo teto (migração 005) — baixar um sem o outro recusa run do Ato II.
    const onda = inteiro(corpo.onda, 1, 200);
    const nivel = inteiro(corpo.nivel, 1, 99) || 1;
    const tempo = inteiro(corpo.tempo, 0, 86400);
    const abates = inteiro(corpo.abates, 0, 100000);
    const classe = CLASSES.indexOf(String(corpo.classe)) >= 0 ? String(corpo.classe) : null;
    const venceu = corpo.venceu === true;

    if (pontos === null || onda === null || tempo === null || abates === null || !classe) {
      res.status(400).json({ erro: 'dados fora do esperado' });
      return;
    }

    // teto de plausibilidade: pontuação impossível pra onda alcançada não entra
    if (pontos > 30000 * onda + 60000 || venceu) {
      res.status(400).json({ erro: 'pontuação implausível para a onda' });
      return;
    }

    try {
      // trava de envio duplicado (clique duplo, reenvio de rede)
      const repetido = await sql`
        select 1 from public.placar_sobrecarga
        where nome = ${nome} and pontos = ${pontos}
          and criado_em > now() - interval '2 minutes'
        limit 1
      `;
      if (repetido.length) { res.status(200).json({ ok: true, repetido: true }); return; }

      const bruta = String(corpo.temporada || '');
      const temporada = TEMPORADA_VALIDA.test(bruta) ? bruta : 'T1';
      await sql`
        insert into public.placar_sobrecarga
          (nome, pontos, classe, onda, nivel, tempo, abates, venceu, temporada)
        values
          (${nome}, ${pontos}, ${classe}, ${onda}, ${nivel}, ${tempo}, ${abates}, ${venceu}, ${temporada})
      `;
      res.status(201).json({ ok: true, nome: nome });
    } catch (e) {
      res.status(500).json({ erro: 'não foi possível gravar' });
    }
    return;
  }

  res.status(405).json({ erro: 'método não suportado' });
};
