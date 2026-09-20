const { contaDaRequisicao } = require('../servidor/conta');

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ erro: 'método não suportado' }); return; }
  try {
    const conta = await contaDaRequisicao(req);
    if (!conta) { res.status(401).json({ conta: null }); return; }
    res.status(200).json({ conta: {
      id: conta.id, nome: conta.nome, email: conta.email, foto: conta.foto,
      nucleus: Number(conta.nucleus) || 0,
      classes: Array.isArray(conta.classes_desbloqueadas) ? conta.classes_desbloqueadas : []
    } });
  } catch (e) {
    res.status(503).json({ erro: 'contas indisponíveis' });
  }
};
