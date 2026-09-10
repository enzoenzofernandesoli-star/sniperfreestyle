# -*- coding: utf-8 -*-
"""
Gera os ícones e a arte de loja do SNIPER FREESTYLE.

Desenha a mesma nave-losango que o jogo desenha no canvas, com o mesmo neon —
então o ícone não é arte de fora, é o jogo. Rode com:

    python ferramentas/gerar-icones.py

Saída em assets/. Precisa de Pillow (`pip install pillow`).
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'assets')
os.makedirs(SAIDA, exist_ok=True)

MESTRE = 1024
CIANO = (49, 224, 255)
CIANO_FUNDO = (11, 127, 168)
FUNDO_TOPO = (18, 32, 58)
FUNDO_BASE = (5, 6, 11)


def gradiente_vertical(tamanho, topo, base):
    """Faixa de cor de cima para baixo."""
    img = Image.new('RGB', (1, tamanho), 0)
    px = img.load()
    for y in range(tamanho):
        t = y / max(1, tamanho - 1)
        px[0, y] = (
            int(topo[0] + (base[0] - topo[0]) * t),
            int(topo[1] + (base[1] - topo[1]) * t),
            int(topo[2] + (base[2] - topo[2]) * t),
        )
    return img.resize((tamanho, tamanho))


def brilho_radial(tamanho, cor, forca=0.5):
    """Clarão suave no centro, para dar profundidade ao fundo."""
    camada = Image.new('L', (tamanho, tamanho), 0)
    d = ImageDraw.Draw(camada)
    centro = tamanho / 2
    passos = 60
    for i in range(passos, 0, -1):
        r = centro * (i / passos)
        valor = int(255 * forca * (1 - i / passos) ** 2)
        d.ellipse([centro - r, centro - r, centro + r, centro + r], fill=valor)
    camada = camada.filter(ImageFilter.GaussianBlur(tamanho * 0.05))
    cheia = Image.new('RGB', (tamanho, tamanho), cor)
    return cheia, camada


def forma_nave(tamanho, escala=1.0, rotacao=-35.0):
    """
    A nave do jogador: losango com cano, exatamente como em drawPlayer.
    Devolve uma máscara em L, já rotacionada.
    """
    lado = int(tamanho * 2)
    m = Image.new('L', (lado, lado), 0)
    d = ImageDraw.Draw(m)
    cx = cy = lado / 2
    r = tamanho * 0.165 * escala

    # cano primeiro, pra ficar sob o corpo
    d.rectangle([cx + r * 0.6, cy - r * 0.16, cx + r * 1.75, cy + r * 0.16], fill=255)
    d.rectangle([cx + r * 1.62, cy - r * 0.26, cx + r * 1.95, cy + r * 0.26], fill=255)
    # corpo: losango com a frente à direita
    corpo = [
        (cx + r * 1.15, cy),
        (cx - r * 0.10, cy - r * 0.82),
        (cx - r * 0.95, cy),
        (cx - r * 0.10, cy + r * 0.82),
    ]
    d.polygon(corpo, fill=255)

    m = m.rotate(rotacao, resample=Image.BICUBIC, center=(cx, cy))
    return m.crop((int(cx - tamanho / 2), int(cy - tamanho / 2),
                   int(cx + tamanho / 2), int(cy + tamanho / 2)))


def desenhar_icone(tamanho=MESTRE, cantos=True, escala_nave=1.0, grade=True):
    fundo = gradiente_vertical(tamanho, FUNDO_TOPO, FUNDO_BASE).convert('RGBA')

    # grade fina, igual à da arena
    if grade:
        g = Image.new('RGBA', (tamanho, tamanho), (0, 0, 0, 0))
        dg = ImageDraw.Draw(g)
        passo = int(tamanho / 12)
        for i in range(0, tamanho + passo, passo):
            dg.line([(i, 0), (i, tamanho)], fill=(120, 190, 255, 26), width=2)
            dg.line([(0, i), (tamanho, i)], fill=(120, 190, 255, 26), width=2)
        fundo = Image.alpha_composite(fundo, g)

    # clarão no centro
    cheia, mascara = brilho_radial(tamanho, (16, 60, 90), 0.85)
    fundo = Image.composite(cheia.convert('RGBA'), fundo, mascara)

    # nave: brilho largo + brilho médio + traço nítido
    nave = forma_nave(tamanho, escala_nave)
    for desfoque, cor, forca in ((tamanho * 0.055, CIANO, 190), (tamanho * 0.018, CIANO, 235)):
        halo = nave.filter(ImageFilter.GaussianBlur(desfoque)).point(lambda v: int(v * forca / 255))
        camada = Image.new('RGBA', (tamanho, tamanho), cor + (255,))
        camada.putalpha(halo)
        fundo = Image.alpha_composite(fundo, camada)

    # contorno claro: a nave dilatada, pintada de branco, entra antes do corpo
    contorno = nave.filter(ImageFilter.MaxFilter(max(3, int(tamanho * 0.012) | 1)))
    camada_contorno = Image.new('RGBA', (tamanho, tamanho), (226, 248, 255, 255))
    camada_contorno.putalpha(contorno)
    fundo = Image.alpha_composite(fundo, camada_contorno)

    corpo = Image.new('RGBA', (tamanho, tamanho), (0, 0, 0, 0))
    pintura = gradiente_vertical(tamanho, CIANO, CIANO_FUNDO).convert('RGBA')
    corpo.paste(pintura, (0, 0), nave)
    fundo = Image.alpha_composite(fundo, corpo)

    # núcleo branco
    nucleo = Image.new('RGBA', (tamanho, tamanho), (0, 0, 0, 0))
    dn = ImageDraw.Draw(nucleo)
    c = tamanho / 2
    r = tamanho * 0.024 * escala_nave
    dn.ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255, 255))
    nucleo = nucleo.filter(ImageFilter.GaussianBlur(tamanho * 0.004))
    fundo = Image.alpha_composite(fundo, nucleo)

    if cantos:
        # moldura da arena nos cantos, como no jogo
        moldura = Image.new('RGBA', (tamanho, tamanho), (0, 0, 0, 0))
        dm = ImageDraw.Draw(moldura)
        m = int(tamanho * 0.085)
        braco = int(tamanho * 0.13)
        largura = max(3, int(tamanho * 0.016))
        for (x, y, sx, sy) in ((m, m, 1, 1), (tamanho - m, m, -1, 1),
                               (m, tamanho - m, 1, -1), (tamanho - m, tamanho - m, -1, -1)):
            dm.line([(x + braco * sx, y), (x, y), (x, y + braco * sy)],
                    fill=CIANO + (150,), width=largura, joint='curve')
        moldura = moldura.filter(ImageFilter.GaussianBlur(tamanho * 0.002))
        fundo = Image.alpha_composite(fundo, moldura)

        # canto arredondado
        raio = int(tamanho * 0.18)
        mascara_canto = Image.new('L', (tamanho, tamanho), 0)
        ImageDraw.Draw(mascara_canto).rounded_rectangle([0, 0, tamanho - 1, tamanho - 1],
                                                        radius=raio, fill=255)
        fundo.putalpha(mascara_canto)

    return fundo


def achar_fonte(tamanho):
    """Fonte geométrica do Windows que puxe pro estilo do jogo."""
    for nome in ('bahnschrift.ttf', 'BAHNSCHRIFT.TTF', 'Framd.ttf', 'impact.ttf', 'arialbd.ttf'):
        caminho = os.path.join('C:/Windows/Fonts', nome)
        if os.path.exists(caminho):
            try:
                return ImageFont.truetype(caminho, tamanho)
            except Exception:
                pass
    return ImageFont.load_default()


def desenhar_capa():
    """Gráfico de destaque da Play Store: 1024 x 500."""
    L, A = 1024, 500
    img = gradiente_vertical(A, FUNDO_TOPO, FUNDO_BASE).resize((L, A)).convert('RGBA')

    g = Image.new('RGBA', (L, A), (0, 0, 0, 0))
    dg = ImageDraw.Draw(g)
    for i in range(0, L + 64, 64):
        dg.line([(i, 0), (i, A)], fill=(120, 190, 255, 22), width=2)
    for i in range(0, A + 64, 64):
        dg.line([(0, i), (L, i)], fill=(120, 190, 255, 22), width=2)
    img = Image.alpha_composite(img, g)

    # nave grande à direita: halo, contorno e corpo, igual ao ícone
    LADO = 460
    nave = forma_nave(LADO, 1.0, -30.0)
    pos = (L - LADO - 20, (A - LADO) // 2)
    for desfoque, forca in ((26, 0.9), (8, 1.0)):
        halo = nave.filter(ImageFilter.GaussianBlur(desfoque))
        camada = Image.new('RGBA', (LADO, LADO), CIANO + (255,))
        camada.putalpha(halo.point(lambda v: int(v * forca)))
        img.alpha_composite(camada, pos)
    contorno = Image.new('RGBA', (LADO, LADO), (226, 248, 255, 255))
    contorno.putalpha(nave.filter(ImageFilter.MaxFilter(7)))
    img.alpha_composite(contorno, pos)
    corpo = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    corpo.paste(gradiente_vertical(LADO, CIANO, CIANO_FUNDO), (0, 0), nave)
    img.alpha_composite(corpo, pos)

    # inimigos vermelhos convergindo — só onde não há texto
    d = ImageDraw.Draw(img)
    inimigos = ((612, 86, 22), (770, 116, 13), (884, 92, 17), (748, 412, 19), (930, 430, 14))
    for (x, y, r) in inimigos:
        pontos = [(x + r * math.cos(a), y + r * math.sin(a))
                  for a in [i * 2 * math.pi / 3 - 0.5 for i in range(3)]]
        d.polygon(pontos, fill=(255, 84, 112, 235))
        d.line(pontos + [pontos[0]], fill=(255, 190, 205, 190), width=2)

    # título
    f_grande = achar_fonte(96)
    f_medio = achar_fonte(34)
    d.text((70, 150), 'SNIPER', font=f_grande, fill=(255, 255, 255, 255))
    d.text((70, 250), 'FREESTYLE', font=f_grande, fill=CIANO + (255,))
    d.text((74, 360), 'ARENA NEON  ·  4 CLASSES  ·  4 BOSSES', font=f_medio, fill=(142, 163, 184, 255))

    # vinheta discreta, pra capa não parecer chapada
    vinheta = Image.new('L', (L, A), 0)
    dv = ImageDraw.Draw(vinheta)
    for i in range(40):
        t = i / 39
        dv.rectangle([int(L * 0.5 * t) - 2, int(A * 0.5 * t) - 2,
                      L - int(L * 0.5 * t), A - int(A * 0.5 * t)],
                     outline=int(90 * (1 - t) ** 2), width=14)
    escuro = Image.new('RGBA', (L, A), (0, 0, 0, 255))
    escuro.putalpha(vinheta)
    img = Image.alpha_composite(img, escuro)

    return img.convert('RGB')


def main():
    mestre = desenhar_icone(MESTRE, cantos=True)
    for tam, nome in ((512, 'icone-512.png'), (192, 'icone-192.png'),
                      (180, 'apple-touch-icon.png'), (64, 'favicon-64.png'),
                      (32, 'favicon-32.png')):
        mestre.resize((tam, tam), Image.LANCZOS).save(os.path.join(SAIDA, nome))

    # Play Store exige 512x512 sem transparência
    play = Image.new('RGB', (512, 512), FUNDO_BASE)
    play.paste(mestre.resize((512, 512), Image.LANCZOS), (0, 0),
               mestre.resize((512, 512), Image.LANCZOS))
    play.save(os.path.join(SAIDA, 'icone-play-512.png'))

    # maskable: sem canto arredondado e com a nave menor (zona segura de 80%)
    mask = desenhar_icone(MESTRE, cantos=False, escala_nave=0.86)
    mask.convert('RGB').resize((512, 512), Image.LANCZOS).save(
        os.path.join(SAIDA, 'icone-maskable-512.png'))

    desenhar_capa().save(os.path.join(SAIDA, 'capa-play-1024x500.png'))

    for arq in sorted(os.listdir(SAIDA)):
        caminho = os.path.join(SAIDA, arq)
        print('%-30s %6.1f KB' % (arq, os.path.getsize(caminho) / 1024))


if __name__ == '__main__':
    main()
