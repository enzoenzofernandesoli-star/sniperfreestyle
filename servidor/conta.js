const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');

const COOKIE = 'sniper_sessao';
const DURACAO = 60 * 60 * 24 * 30;

function banco() {
  const conexao = process.env.DATABASE_URL || '';
  if (!conexao) throw new Error('DATABASE_URL ausente');
  return neon(conexao);
}

function cookies(req) {
  const saida = {};
  for (const trecho of String(req.headers.cookie || '').split(';')) {
    const indice = trecho.indexOf('=');
    if (indice < 0) continue;
    saida[trecho.slice(0, indice).trim()] = decodeURIComponent(trecho.slice(indice + 1).trim());
  }
  return saida;
}

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookie(valor, maxAge) {
  const seguro = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${seguro}`;
}

async function criarSessao(res, contaId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const sql = banco();
  await sql`delete from public.sessoes_jogador where expira_em <= now()`;
  await sql`
    insert into public.sessoes_jogador (token_hash, conta_id, expira_em)
    values (${hash(token)}, ${contaId}, now() + interval '30 days')
  `;
  res.setHeader('Set-Cookie', cookie(token, DURACAO));
}

async function contaDaRequisicao(req) {
  const token = cookies(req)[COOKIE];
  if (!token || token.length > 100) return null;
  const sql = banco();
  const linhas = await sql`
    select c.id, c.google_sub, c.nome, c.email, c.foto, c.nucleus, c.classes_desbloqueadas
    from public.sessoes_jogador s
    join public.contas_jogador c on c.id = s.conta_id
    where s.token_hash = ${hash(token)} and s.expira_em > now()
    limit 1
  `;
  return linhas[0] || null;
}

function encerrarSessao(res) {
  res.setHeader('Set-Cookie', cookie('', 0));
}

module.exports = { banco, hash, criarSessao, contaDaRequisicao, encerrarSessao };
