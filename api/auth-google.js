const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const { banco, criarSessao } = require('../servidor/conta');

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ erro: 'método não suportado' }); return; }
  const credencial = String((req.body && req.body.credential) || '');
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId || credencial.length < 100 || credencial.length > 5000) {
    res.status(400).json({ erro: 'login inválido' }); return;
  }
  try {
    const cliente = new OAuth2Client(clientId);
    const bilhete = await cliente.verifyIdToken({ idToken: credencial, audience: clientId });
    const perfil = bilhete.getPayload();
    if (!perfil || !perfil.sub || !perfil.email_verified) throw new Error('perfil não verificado');
    const sql = banco();
    const id = crypto.randomUUID();
    const nome = String(perfil.name || 'JOGADOR').slice(0, 80);
    const email = String(perfil.email || '').slice(0, 254);
    const foto = /^https:\/\/[A-Za-z0-9./_?=&%-]+$/.test(String(perfil.picture || ''))
      ? String(perfil.picture).slice(0, 500) : '';
    const contas = await sql`
      insert into public.contas_jogador (id, google_sub, nome, email, foto)
      values (${id}, ${perfil.sub}, ${nome}, ${email}, ${foto})
      on conflict (google_sub) do update set
        nome = excluded.nome, email = excluded.email, foto = excluded.foto, atualizado_em = now()
      returning id, nome, email, foto, nucleus, classes_desbloqueadas as classes
    `;
    await criarSessao(res, contas[0].id);
    res.status(200).json({ conta: contas[0] });
  } catch (e) {
    res.status(401).json({ erro: 'não foi possível validar a conta Google' });
  }
};
