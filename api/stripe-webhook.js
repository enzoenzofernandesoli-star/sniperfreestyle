const Stripe = require('stripe');
const { banco } = require('../servidor/conta');

async function corpoBruto(req) {
  const partes = [];
  for await (const parte of req) partes.push(Buffer.from(parte));
  return Buffer.concat(partes);
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const chave = process.env.STRIPE_SECRET_KEY || '';
  const segredo = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!chave || !segredo) { res.status(503).end(); return; }
  const stripe = new Stripe(chave, { apiVersion: '2026-07-29.dahlia' });
  let evento;
  try {
    evento = stripe.webhooks.constructEvent(
      await corpoBruto(req), String(req.headers['stripe-signature'] || ''), segredo
    );
  } catch (e) {
    res.status(400).end(); return;
  }
  if (evento.type === 'checkout.session.completed') {
    const sessao = evento.data.object;
    const contaId = String(sessao.metadata && sessao.metadata.conta_id || '');
    const produto = String(sessao.metadata && sessao.metadata.produto || '');
    const nucleus = Number(sessao.metadata && sessao.metadata.nucleus || 0);
    if (sessao.payment_status === 'paid' && /^[0-9a-f-]{36}$/.test(contaId) &&
        /^nucleus_(700|1500|2200)$/.test(produto) && [700, 1500, 2200].includes(nucleus)) {
      const sql = banco();
      await sql`
        with nova as (
          insert into public.compras_stripe (sessao_stripe, conta_id, produto, nucleus)
          values (${sessao.id}, ${contaId}, ${produto}, ${nucleus})
          on conflict (sessao_stripe) do nothing
          returning conta_id, nucleus
        )
        update public.contas_jogador c
        set nucleus = c.nucleus + nova.nucleus, atualizado_em = now()
        from nova where c.id = nova.conta_id
      `;
    }
  }
  res.status(200).json({ recebido: true });
};

module.exports.config = { api: { bodyParser: false } };
