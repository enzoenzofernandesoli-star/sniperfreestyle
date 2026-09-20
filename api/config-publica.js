module.exports = function (req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  if (req.method !== 'GET') { res.status(405).json({ erro: 'método não suportado' }); return; }
  res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
};
