const Stripe = require('stripe');
const crypto = require('node:crypto');
const { contaDaRequisicao } = require('../servidor/conta');

const PRODUTOS = Object.freeze({
  nucleus_700: { nucleus: 700, centavos: 590 },
  nucleus_1500: { nucleus: 1500, centavos: 990 },
  nucleus_2200: { nucleus: 2200, centavos: 1490 }
});

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ erro: 'método não suportado' }); return; }
  const produtoId = String((req.body && req.body.produto) || '');
  const produto = PRODUTOS[produtoId];
  if (!produto) { res.status(400).json({ erro: 'produto inválido' }); return; }
  try {
    const conta = await contaDaRequisicao(req);
    if (!conta) { res.status(401).json({ erro: 'entre com Google antes de comprar' }); return; }
    const chave = process.env.STRIPE_SECRET_KEY || '';
    const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
    if (!chave || !/^https:\/\//.test(appUrl)) {
      res.status(503).json({ erro: 'Stripe ainda não configurado' }); return;
    }
    const stripe = new Stripe(chave, { apiVersion: '2026-07-29.dahlia' });
    const sufixo = crypto.randomBytes(4).toString('hex');
    const sessao = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: conta.email,
      client_reference_id: conta.id,
      integration_identifier: `sniper_web_${sufixo}`,
      line_items: [{ quantity: 1, price_data: {
        currency: 'brl', unit_amount: produto.centavos,
        product_data: { name: `${produto.nucleus} NUCLEUS`, description: 'Moeda para liberar personagens no Sniper Freestyle' }
      } }],
      metadata: { conta_id: conta.id, produto: produtoId, nucleus: String(produto.nucleus) },
      success_url: `${appUrl}/?compra=sucesso`,
      cancel_url: `${appUrl}/?compra=cancelada`
    });
    res.status(201).json({ url: sessao.url });
  } catch (e) {
    res.status(502).json({ erro: 'não foi possível abrir o pagamento' });
  }
};

module.exports.PRODUTOS = PRODUTOS;
