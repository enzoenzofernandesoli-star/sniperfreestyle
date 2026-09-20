const { encerrarSessao } = require('../servidor/conta');

module.exports = function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ erro: 'método não suportado' }); return; }
  encerrarSessao(res);
  res.status(200).json({ ok: true });
};
