# Arte opcional — prompts prontos pro ChatGPT / Sora / Midjourney

O jogo **não precisa de nenhum arquivo de imagem**: tudo é desenhado por código (vetorial, com
brilho e partículas), e é isso que o mantém em ~90 KB e sem tempo de carregamento. Então trate esta
lista como upgrade estético opcional, na ordem em que dá mais retorno visual por esforço.

Direção de arte que o jogo já segue — respeite isso nos prompts:
**preto azulado (#05060b) + neon ciano/magenta/âmbar, brilho forte, contorno luminoso,
fundo transparente, estilo arcade retro-futurista, sem serifa, sem textura suja.**

---

## 1. Logo / wordmark (maior retorno)

> Wordmark "SOBRECARGA" em uma linha, com a assinatura "ARENA NEON" menor embaixo, tipografia
> geométrica extrabold estilo Orbitron,
> letras em degradê de branco para ciano elétrico, contorno com brilho neon azul, leve aberração
> cromática, fundo transparente PNG, alta resolução, estética arcade retro-futurista, sem mascote,
> sem moldura.

Onde entra: substituir o `<h1 class="titulo">` do menu por `<img>`.

## 2. Retratos dos 4 bosses (tela de entrada do boss)

Um por boss, mesma moldura e enquadramento:

> Retrato frontal de um chefe de videogame geométrico e abstrato, corpo poligonal de faces afiadas
> com um único olho luminoso no centro, cor dominante **CARMESIM #ff2e5b**, anéis orbitais em volta,
> brilho neon intenso, fundo transparente, arte 2D limpa e vetorial, estética arcade retro-futurista,
> vista de frente, simétrico.

Repita trocando a cor e o tema:
- **SENTINELA CARMESIM** — `#ff2e5b`, hexagonal, blindado, pesado
- **SERPENTE DE VÍDEO** — `#00e5ff`, pentagonal, alongado, com rastro de onda senoidal
- **OLHO DO VAZIO** — `#b06dff`, octogonal, muitos olhos, espirais
- **O ARQUITETO** — `#ffd34d`, triangular, dourado, com plantas de projeto ao fundo

## 3. Ícones das 4 classes

> Ícone quadrado de classe de personagem para HUD de jogo, símbolo geométrico minimalista de um
> atirador de precisão, linha grossa uniforme, cor única **#31e0ff** sobre fundo transparente,
> estilo vetorial neon, sem texto, sem sombra realista, legível a 48 px.

Um para cada: mira/luneta (Sniper `#31e0ff`), escudo hexagonal (Guardião `#ffc93c`), lâmina
dupla (Espectro `#ff4d6d`), orbe com dois satélites (Arcano `#b06dff`).

## 4. Fundo da arena (textura sutil)

> Textura de piso de arena futurista vista de cima, grade técnica fina em azul escuro sobre preto,
> placas metálicas discretas, marcas de desgaste sutis, iluminação uniforme, sem sombras dramáticas,
> sem objetos, imagem sem costura (seamless tile) 1024×1024, contraste baixo para servir de fundo
> de gameplay.

Importante: **contraste baixo**. Fundo chamativo mata a leitura dos projéteis.

## 5. Capa / thumbnail para divulgar

> Pôster de jogo indie de ação arcade: silhueta de uma nave losangular ciano no centro de uma arena
> circular escura, enxame de inimigos poligonais vermelhos convergindo, rastros de projétil neon,
> câmera de cima, iluminação volumétrica, formato 16:9, espaço vazio no topo para o título.

---

## Se quiser modelo 3D

Não use hoje. O jogo é 2D com câmera fixa de cima; entrar com 3D significaria trocar canvas 2D
por Three.js — é outro projeto, não uma melhoria. Se um dia quiser, o caminho é:
malhas low-poly com material emissivo, câmera ortográfica de cima e bloom no post-processing —
aí a estética atual se mantém.

---

## Como me entregar

Manda os arquivos numa pasta `assets/` aqui dentro (PNG com transparência, o logo em 2000 px de
largura, ícones em 256 px, textura em 1024 px). Eu ligo no jogo — sem sprite sheet, sem atlas,
sem complicação.
