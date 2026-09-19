# Avaliação para publicar no Google Play

**Jogo:** Sniper Freestyle — Arena Neon
**Conferido em:** 18/09/2026, testando cada item de fora (curl no site publicado)
**Veredito:** o site já está no ar e o pacote de PWA está completo. Faltam
**4 itens técnicos** (dois deles de 5 minutos) e **2 decisões de conteúdo** que
podem reprovar o app se forem ignoradas. Nada aqui é impeditivo de engenharia.

---

## 1. Situação conferida hoje

**Já no ar e respondendo:**

| Item | Estado |
|---|---|
| Site em HTTPS | ✅ <https://sniperfreestyle.vercel.app> responde 200 |
| Versão publicada | ✅ 2.0.0 (a mesma do repositório) |
| `manifest.webmanifest` | ✅ 200 |
| `sw.js` (joga offline) | ✅ 200 |
| Ícone 512 e demais tamanhos | ✅ 200 |
| `privacidade.html` | ✅ 200 — é a URL que a Play exige |
| Placar mundial | ✅ funcionando pelo Data API do Neon |
| Botão VOLTAR do Android | ✅ tratado (pausa, volta de tela, sai no menu) |
| Capa 1024×500 da loja | ✅ `assets/capa-play-1024x500.png` |

**Pendente:**

| Item | Estado | De quem é |
|---|---|---|
| `.well-known/assetlinks.json` | ❌ 404 — sem ele o app abre com a barra do Chrome | sai do PWABuilder |
| `DATABASE_URL` na Vercel | ❌ `/api/placar` responde 503 | você, no painel |
| Pacotes de moeda com preço em R$ | ⚠️ **risco de reprovação** (ver 2.7) | decisão sua |
| Áudio de terceiros no jogo | ⚠️ **risco de direito autoral** (ver 2.8) | decisão sua |
| Servidor de salas (co-op) | ⚠️ Render grátis: 15 s de cold start | decisão sua |
| Conta Play Console | ❌ US$ 25, uma vez | você |
| Capturas de tela | ❌ 2 a 8 imagens | você, 5 min |

## 2. Os bloqueios, um por um

### 2.1 O jogo precisa estar no ar antes de virar app — ✅ **feito**
O empacotamento oficial (TWA) não embute o jogo: ele abre o seu site em tela cheia, sem barra
de navegador. Sem o site em HTTPS, não existe app. Isso é o passo da Vercel que já está
descrito no `LEIA-ME.md` (importar o repo + variável `DATABASE_URL`).

### 2.2 Conta de desenvolvedor no Play Console — **US$ 25, uma vez só**
É cobrança única, vitalícia, não é assinatura. **Este é o único custo obrigatório do processo.**
Eu tinha te dito antes que o placar não teria custo — e não tem. Este custo é da Play, não do jogo.

### 2.3 Teste fechado de 14 dias com 12 testadores — **o que mais demora**
Contas **pessoais** criadas depois de nov/2023 só liberam produção depois de rodar um teste
fechado com **no mínimo 12 testadores que aceitaram o convite**, por **14 dias seguidos**.
Contas de **organização** (empresa com CNPJ e D-U-N-S) são isentas.

> Decisão sua: abrir como pessoa física (barato, mas 14 dias de espera e 12 pessoas
> instalando) ou como organização (libera direto, mas exige CNPJ e verificação).

### 2.4 Digital Asset Links
Um arquivo `.well-known/assetlinks.json` no seu domínio provando que o app e o site são da
mesma pessoa. Sem ele, o app abre **com a barra do Chrome aparecendo** — e aí parece site
embrulhado, que é justamente o que a Play reprova. O PWABuilder/Bubblewrap gera o conteúdo
desse arquivo; é só publicar no domínio.

### 2.5 Formulário de Segurança de Dados + política de privacidade
Obrigatório porque o jogo envia apelido e pontuação. As respostas estão prontas na seção 5.
A URL da política será `https://SEU-DOMINIO/privacidade.html`.

### 2.6 Conteúdo escrito por terceiros (o placar)
O placar mostra apelido digitado por outras pessoas. A Play exige **filtro + canal de
denúncia**. Você tem os dois: lista negra no servidor e o link de denúncia na tela de
RECORDES. Declare "sim" para interação entre usuários no questionário de classificação.

---

### 2.7 Pacotes de moeda: o maior risco de reprovação hoje

A LOJINHA tem uma aba de **pacotes de moeda com preço em reais** (R$ 4,90 a
R$ 79,90) e botão COMPRAR que hoje só avisa "ainda não está no ar". Isso encosta
em duas políticas ao mesmo tempo:

- **Pagamentos:** bem digital vendido dentro de app na Play **tem** que passar
  pelo Google Play Billing. Preço em R$ anunciado na tela, com qualquer outro
  meio de pagamento depois, é motivo de suspensão.
- **Funcionalidade mínima:** botão de compra que não compra é feature quebrada,
  e revisor reprova por isso sozinho.

**Três saídas, em ordem de esforço:**

1. **Esconder a aba de pacotes** até existir pagamento. É uma linha em
   `VITRINES`/`Loja.abrirAba` e resolve os dois problemas de uma vez. É o que eu
   recomendo para publicar logo.
2. Trocar preço em R$ por **texto sem valor** ("em breve") — reduz o problema de
   pagamento, mas continua sendo feature incompleta.
3. Implementar **Google Play Billing** de verdade. Isso é projeto próprio: exige
   backend validando o recibo, e num TWA a compra não é trivial (precisa da
   Digital Goods API, que só funciona dentro do app, não no site).

### 2.8 O áudio de terceiros

O jogo toca quatro arquivos de voz: `assets/sixseven.mp3` e as três falas
`assets/encaixa-*.m4a`. Todo o resto do som é sintetizado no navegador, sem
arquivo — esses quatro são a exceção.

**Preciso saber de onde eles vieram.** Se forem recorte de vídeo, música ou
áudio de outra pessoa (o "six seven" e o "encaixa" são bordões que circulam em
vídeo), publicar comercialmente na Play expõe você a reclamação de direito
autoral, e a Play derruba o app primeiro e pergunta depois.

- Se **você gravou**, está resolvido: só me diga e eu registro isso no projeto.
- Se **não**, o caminho seguro é gravar você mesmo dizendo as falas (fica até
  mais engraçado) ou sintetizar no WebAudio como o resto do jogo.

### 2.9 Co-op no Render grátis

O servidor de salas dorme e leva **~15 segundos** para acordar (medido hoje).
Quem abrir CRIAR SALA no primeiro acesso vai achar que está quebrado — e revisor
também. Opções: aceitar e avisar na tela ("acordando o servidor…", que já pode
existir), usar um plano que não dorme, ou esconder o co-op na primeira versão
publicada e ligar depois.

## 3. Como empacotar (o caminho mais curto)

**Opção recomendada: PWABuilder** (no navegador, sem instalar nada)

1. Publique o jogo na Vercel e confirme que abre em `https://…`.
2. Vá em <https://www.pwabuilder.com>, cole a URL do jogo.
3. O relatório vai apontar manifest, service worker e ícones — os três já estão prontos.
4. Clique em **Package for stores → Android → Generate**. Preencha:
   - **Package ID:** `br.com.lodch.sniperfreestyle` (não muda depois, escolha com calma)
   - **App name:** `Sniper Freestyle`
   - **Launcher name:** `Sniper Freestyle`
   - **Display mode:** `Fullscreen`
   - **Orientation:** `Landscape`
   - **Signing key:** *Create new* — **baixe e guarde o `.keystore` e a senha.**
     Perder essa chave significa nunca mais atualizar o app.
5. O zip vem com o `.aab` (é o que você sobe na Play) e o `assetlinks.json`
   (publique em `https://SEU-DOMINIO/.well-known/assetlinks.json`).

**Alternativa por linha de comando (Bubblewrap):** precisa de JDK 17 + Android SDK.
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://SEU-DOMINIO/manifest.webmanifest
bubblewrap build
```

---

## 4. Texto da loja (pronto pra colar)

**Nome do app** (máx. 30) — 28 caracteres:
```
Sniper Freestyle: Arena Neon
```

**Descrição curta** (máx. 80) — 79 caracteres:
```
Twin-stick roguelite neon: 5 classes, 14 bosses, 100 ondas e placar mundial.
```

**Descrição completa** (máx. 4000):
```
Você contra a arena. Cem ondas, quatorze bosses e nenhuma segunda chance.

SNIPER FREESTYLE é um twin-stick shooter roguelite: você anda, mira e atira ao mesmo tempo
numa arena neon que só aumenta a pressão. Cada partida começa do zero e termina em minutos —
o que muda é a classe que você escolhe e as melhorias que aparecem no caminho.

CINCO CLASSES, CINCO JEITOS DE JOGAR
· SNIPER — tiro que perfura, dano alto, cadência lenta.
· GUARDIÃO — seis corações e um escudo que REFLETE os tiros inimigos de volta.
· ESPECTRO — escopeta de cinco projéteis, velocíssimo, e o dash corta quem estiver na frente.
· ARCANO — projétil teleguiado e satélites que trituram quem se aproxima.
· INVOCADOR — luta com drones que atiram junto com você.

VINTE E DUAS MELHORIAS, SORTEADAS A CADA NÍVEL
Ricochete, perfuração, crítico, orbe orbital, estilhaços, dilatação do tempo. Você escolhe uma
entre três, e a escolha vale pelo resto da partida. Duas partidas nunca ficam iguais.

QUATORZE BOSSES COM FASES DE VERDADE
Da SENTINELA CARMESIM na onda 5 ao CEIFADOR ABSOLUTO na onda 100. Cada um muda movimento e
padrão de ataque conforme perde vida, e avisa antes de mudar. Decorar o padrão é metade da luta.

DOZE TIPOS DE INIMIGO QUE PEDEM RESPOSTAS DIFERENTES
O KAMIKAZE pisca antes de investir. A COURAÇA bloqueia tiro de frente: flanqueie ou ricocheteie.
O DIVISOR racha quando morre. E do meio da campanha em diante aparecem versões elite.

LOJINHA DE APARÊNCIA
Moeda cai de todo inimigo que você mata e vira cor de nave, cor de tiro, acessório e emoji —
com emoji equipado, o emoji é o seu corpo na arena. Nada disso muda atributo: é só aparência.

COOPERATIVO ATÉ 4
Abra uma sala, passe o código e joguem a mesma arena juntos.

PLACAR MUNDIAL POR TEMPORADA
Escreva seu apelido e sua pontuação entra no placar que todo mundo vê. Cada atualização do jogo
abre uma temporada nova e o ranking recomeça do zero.

FEITO PRA CELULAR E PRA PC
No celular: joystick esquerdo anda, joystick direito mira, e o botão ATIRAR dispara com mira
automática — dá pra jogar com um dedo só. No PC: WASD e mouse.

· Sem anúncio.
· Sem cadastro, sem login, sem pedir seus dados.
· Joga offline. O placar sobe quando você estiver na internet.
· Leve: o jogo inteiro pesa menos que uma foto.

Feito por LODCH.
```

**E-mail de suporte:** `enzo.enzofernandesoli@gmail.com`
**Site:** a URL do jogo · **Política de privacidade:** `https://SEU-DOMINIO/privacidade.html`

**Categoria:** Jogos → Ação · **Tags:** arcade, roguelite, tiro

---

## 5. Formulário de Segurança de Dados (respostas honestas)

| Pergunta da Play | Resposta |
|---|---|
| O app coleta ou compartilha dados do usuário? | **Sim** |
| Todos os dados em trânsito são criptografados? | **Sim** (HTTPS) |
| Há como pedir exclusão de dados? | **Sim**, por e-mail (está na política) |
| **Nome** (Informações pessoais) | Coletado · **Opcional** · Finalidade: funcionalidade do app · **Não** vinculado à identidade · É o apelido do placar, escolhido pelo jogador |
| **Ações no app / progresso de jogo** | Coletado · Obrigatório para o placar · Finalidade: funcionalidade do app · Não vinculado à identidade |
| Dados compartilhados com terceiros? | **Não.** Vercel e Neon são provedores de infraestrutura, não terceiros que recebem dados para uso próprio |
| Dados são processados de forma efêmera? | Não — a linha do placar é armazenada |
| Localização, contatos, fotos, arquivos, saúde, financeiro, mensagens, IDs de dispositivo | **Nada disso é coletado** |

**Acesso ao app:** todas as funções estão disponíveis sem login — marque
"Todas as funcionalidades estão disponíveis sem restrição de acesso".

**Anúncios:** o app não contém anúncios.
**Compras no app:** nenhuma.

---

## 6. Classificação de conteúdo (questionário IARC)

| Pergunta | Resposta |
|---|---|
| Categoria | Jogo |
| Violência contra personagens humanos realistas | **Não** — os inimigos são formas geométricas |
| Sangue / gore | **Não** |
| Violência de fantasia / desenho | **Sim, leve** — explosões e partículas, sem representação humana |
| Linguagem imprópria, sexo, drogas, jogos de azar | **Não** para todos |
| Usuários interagem ou trocam conteúdo? | **Sim** — apelido no placar público |
| Há moderação e canal de denúncia? | **Sim** — filtro automático no servidor + link de denúncia por e-mail na tela de recordes |
| Compartilha localização do usuário? | **Não** |

Expectativa realista: **Livre** ou **10+** no Brasil (ESRB *Everyone 10+*, PEGI 7).
**Público-alvo:** 13 anos ou mais — assim o app não entra no programa Famílias, que traria
exigências extras por causa do placar com texto escrito por gente.

---

## 7. Capturas de tela (você tira, 5 minutos)

A Play pede de 2 a 8 por formato. Faça no PC, com a janela em **1280×720**, e capture:

1. Menu inicial (título grande).
2. Tela de escolha de classe (as 4 lado a lado).
3. Combate com muitos inimigos e partículas.
4. Luta de boss, com a barra de vida do boss no topo.
5. Tela de escolha de melhoria (as 3 cartas).
6. Tela final com as estatísticas.
7. O jogo no celular deitado, com os joysticks visíveis.

No Chrome: `F12` → ícone de celular → escolha 1280×720 → botão de três pontinhos →
*Capture screenshot*. Salve como PNG.

---

## 8. Ordem de execução (atualizada)

Feito: site no ar, manifest, service worker, ícones, capa, política de
privacidade, botão VOLTAR e canal de denúncia.

1. **Decidir os dois itens de conteúdo:** aba de pacotes de moeda (2.7) e áudio
   de terceiros (2.8). São os dois que reprovam o app.
2. `DATABASE_URL` na Vercel — 2 minutos, e o placar passa a responder pela rota
   do próprio site em vez de cair no banco.
3. Criar a conta no Play Console (US$ 25) e decidir pessoa física × organização.
4. PWABuilder na URL do jogo → gerar o `.aab` → **guardar a chave de assinatura**.
5. Publicar o `assetlinks.json` que o PWABuilder gerar em
   `https://sniperfreestyle.vercel.app/.well-known/assetlinks.json` e conferir
   que o app abre sem a barra do Chrome.
6. Preencher listagem, Segurança de Dados e classificação com as respostas das
   seções 4, 5 e 6 deste arquivo.
7. Subir capturas, ícone 512 e capa 1024×500 (`assets/`).
8. Teste fechado: 12 testadores, 14 dias (conta pessoal).
9. Produção. A revisão da Play costuma levar de 1 a 7 dias.

**Prazo realista:** 3 semanas em conta pessoal (duas delas são a espera do teste
fechado), ou 2 a 5 dias em conta de organização.

## 9. O que pode te reprovar (e como já está resolvido)

| Risco | Situação |
|---|---|
| "App é só um site embrulhado" (política de funcionalidade mínima) | Mitigado: é um jogo real, funciona offline pelo service worker, é tela cheia e trata o botão voltar |
| Barra do navegador aparecendo dentro do app | Resolve com o `assetlinks.json` publicado |
| Conteúdo de terceiros sem moderação | Filtro no servidor + canal de denúncia |
| Falta de política de privacidade | `privacidade.html` pronta |
| Segurança de Dados divergente do que o app faz | A tabela da seção 5 descreve exatamente o que o código envia |
| Ícone com transparência ou fora de especificação | `icone-play-512.png` é 512×512 sem canal alfa |
| Target API antigo | O PWABuilder gera com o target que a Play exige hoje; se reclamar, é só regerar |

---

## 10. Coisas que eu não posso fazer no seu lugar

- Criar e pagar a conta do Play Console.
- Gerar e guardar a chave de assinatura (é sua, e perder significa perder o app).
- Aceitar os termos do Play Console e responder os formulários com a sua identidade.
- Arrumar 12 testadores.
- Tirar as capturas de tela do jogo rodando no seu aparelho.
