/* Valida compra de NUCLEUS na Google Play antes de autorizar o crédito.
   Segredos exigidos na Vercel:
   GOOGLE_PLAY_SERVICE_ACCOUNT = JSON da conta de serviço
   GOOGLE_PLAY_PACKAGE_NAME = br.com.lodch.sniperfreestyle */
const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');

const PRODUTOS = Object.freeze({ nucleus_700: 700, nucleus_1500: 1500, nucleus_2200: 2200 });
const PACOTE_PADRAO = 'br.com.lodch.sniperfreestyle';

function base64url(valor) {
  return Buffer.from(valor).toString('base64url');
}

async function tokenGoogle(conta) {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const carga = base64url(JSON.stringify({
    iss: conta.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600
  }));
  const assinatura = crypto.sign('RSA-SHA256', Buffer.from(cabecalho + '.' + carga), conta.private_key).toString('base64url');
  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cabecalho + '.' + carga + '.' + assinatura })
  });
  if (!resposta.ok) throw new Error('credencial Google recusada');
  return (await resposta.json()).access_token;
}

function corpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ erro: 'método não suportado' }); return; }

  const entrada = corpo(req);
  const produto = String(entrada.produto || '');
  const tokenCompra = String(entrada.token || '');
  const instalacao = String(entrada.instalacao || '');
  if (!PRODUTOS[produto] || tokenCompra.length < 20 || tokenCompra.length > 4096 ||
      !/^[A-Za-z0-9_-]{20,80}$/.test(instalacao)) {
    res.status(400).json({ erro: 'compra inválida' });
    return;
  }

  const conexao = process.env.DATABASE_URL || '';
  let conta;
  try { conta = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT || ''); }
  catch (e) { conta = null; }
  if (!conexao || !conta || !conta.client_email || !conta.private_key) {
    res.status(503).json({ erro: 'pagamentos ainda não configurados' });
    return;
  }

  try {
    const acesso = await tokenGoogle(conta);
    const pacote = process.env.GOOGLE_PLAY_PACKAGE_NAME || PACOTE_PADRAO;
    const url = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' +
      encodeURIComponent(pacote) + '/purchases/products/' + encodeURIComponent(produto) +
      '/tokens/' + encodeURIComponent(tokenCompra);
    const verificacao = await fetch(url, { headers: { Authorization: 'Bearer ' + acesso } });
    if (!verificacao.ok) { res.status(403).json({ erro: 'recibo recusado pela Google Play' }); return; }
    const compra = await verificacao.json();
    if (compra.purchaseState !== 0) { res.status(409).json({ erro: 'pagamento não concluído' }); return; }

    const sql = neon(conexao);
    const hash = crypto.createHash('sha256').update(tokenCompra).digest('hex');
    const existentes = await sql`
      select instalacao, produto, nucleus from public.compras_google_play
      where token_hash = ${hash} limit 1
    `;
    if (existentes.length) {
      const anterior = existentes[0];
      if (anterior.instalacao !== instalacao || anterior.produto !== produto) {
        res.status(409).json({ erro: 'recibo já utilizado' });
        return;
      }
      res.status(200).json({ ok: true, nucleus: Number(anterior.nucleus), repetida: true });
      return;
    }

    const inseridas = await sql`
      insert into public.compras_google_play (token_hash, instalacao, produto, nucleus, pedido_google)
      values (${hash}, ${instalacao}, ${produto}, ${PRODUTOS[produto]}, ${String(compra.orderId || '')})
      on conflict (token_hash) do nothing
      returning nucleus
    `;
    if (!inseridas.length) { res.status(409).json({ erro: 'recibo já utilizado' }); return; }
    res.status(201).json({ ok: true, nucleus: PRODUTOS[produto] });
  } catch (e) {
    res.status(502).json({ erro: 'não foi possível confirmar a compra' });
  }
};

module.exports.PRODUTOS = PRODUTOS;
