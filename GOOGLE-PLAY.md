# Avaliação para publicar no Google Play

**Jogo:** Sniper Freestyle — Arena Neon
**Data:** 10/09/2026
**Veredito:** **dá pra publicar**, mas não do jeito que está hoje. Falta empacotar como app
Android e resolver 6 itens obrigatórios. Nada aqui é impeditivo técnico — é papelada, um
build e uma etapa de teste fechado que leva 14 dias.

---

## 1. O que você tem hoje

| Item | Situação |
|---|---|
| Jogo funcionando em PC e celular | ✅ pronto |
| Controles de toque (joystick + botão de tiro) | ✅ pronto |
| Layout adaptado a celular deitado | ✅ pronto |
| Manifest de PWA (`manifest.webmanifest`) | ✅ criado hoje |
| Service worker: abre e joga **sem internet** | ✅ criado hoje |
| Ícone 512×512 + maskable + 192 | ✅ gerado (`assets/`) |
| Gráfico de destaque 1024×500 | ✅ gerado (`assets/capa-play-1024x500.png`) |
| Botão VOLTAR do Android navegando telas | ✅ implementado |
| Política de privacidade hospedável | ✅ `privacidade.html` |
| Canal de denúncia de apelido no placar | ✅ na tela de RECORDES |
| Site no ar em HTTPS | ❌ **pendente** (Vercel) |
| App Android (`.aab` assinado) | ❌ pendente |
| Conta no Play Console | ❌ pendente |
| Capturas de tela da loja | ❌ pendente (você tira, 5 min) |

---

## 2. Os 6 bloqueios reais

### 2.1 O jogo precisa estar no ar antes de virar app — **R$ 0**
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

**Descrição curta** (máx. 80) — 78 caracteres:
```
  Twin-stick roguelite neon: 4 classes, 8 bosses, 40 ondas e placar mundial.
```

**Descrição completa** (máx. 4000):
```
Você contra a arena. Quarenta ondas, oito bosses e nenhuma segunda chance.

SNIPER FREESTYLE é um twin-stick shooter roguelite: você anda, mira e atira ao mesmo tempo,
sozinho no meio de uma arena neon que só aumenta a pressão. Cada partida começa do zero e
termina em minutos — o que muda é a classe que você escolhe e as melhorias que aparecem.

QUATRO CLASSES, QUATRO JEITOS DE JOGAR
· SNIPER — tiro que perfura dois inimigos, dano altíssimo, cadência lenta.
· GUARDIÃO — seis corações e um escudo que REFLETE os tiros inimigos de volta.
· ESPECTRO — escopeta de cinco projéteis, velocíssimo, e o dash corta quem estiver na frente.
· ARCANO — projétil teleguiado e dois satélites que trituram quem se aproxima.

VINTE E DUAS MELHORIAS, SORTEADAS A CADA NÍVEL
Ricochete, perfuração, crítico, orbe orbital, estilhaços, dilatação do tempo. Você escolhe uma
entre três e a escolha vale pelo resto da partida. Duas partidas nunca ficam iguais.

QUATRO BOSSES COM FASES DE VERDADE
A Sentinela Carmesim, a Serpente de Vídeo, o Olho do Vazio e o Arquiteto. Cada um muda
movimento e padrão de ataque conforme perde vida — e avisa antes de mudar. Decorar o padrão
é metade da luta.

SETE TIPOS DE INIMIGO QUE PEDEM RESPOSTAS DIFERENTES
O KAMIKAZE pisca antes de investir: sai do caminho. A COURAÇA bloqueia tiro de frente:
flanqueie ou use ricochete. O DIVISOR racha em dois quando morre. O ATIRADOR mantém distância.

PLACAR MUNDIAL
Escreva seu apelido e sua pontuação entra no placar que todo mundo vê. Combo de abates rápidos
multiplica os pontos até x8.

FEITO PRA CELULAR E PRA PC
No celular: joystick esquerdo anda, joystick direito mira, e o botão ATIRAR dispara com mira
automática — dá pra jogar com um dedo só. No PC: WASD e mouse.

· Sem anúncio.
· Sem compra dentro do app.
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

## 8. Ordem de execução

1. Publicar na Vercel e confirmar o HTTPS funcionando. *(pendência atual)*
2. Criar a conta no Play Console (US$ 25) e decidir pessoa física × organização.
3. Gerar o `.aab` no PWABuilder e **guardar a chave de assinatura**.
4. Publicar o `assetlinks.json` no domínio e conferir que o app abre sem a barra do Chrome.
5. Preencher listagem, Segurança de Dados e classificação com o que está aqui.
6. Subir capturas, ícone 512 e capa 1024×500 (`assets/`).
7. Teste fechado: 12 testadores, 14 dias.
8. Enviar para produção. Revisão da Play costuma levar de 1 a 7 dias.

**Prazo realista:** 3 semanas em conta pessoal (as duas primeiras são a espera do teste
fechado), ou 2 a 5 dias em conta de organização.

---

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
