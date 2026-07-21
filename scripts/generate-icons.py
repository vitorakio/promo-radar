#!/usr/bin/env python3
"""Gera os icones da extensao e do app Android a partir de uma arte unica.

O desenho e um radar: arcos concentricos varrendo a partir do canto inferior
esquerdo e um ponto marcando a oferta encontrada. Cores do proprio app, para o
icone combinar com a interface que ele abre.

Uso: python3 scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

INK = (11, 18, 32, 255)  # palette.ink
ACCENT = (18, 185, 129, 255)  # palette.accent
ACCENT_SOFT = (209, 250, 229, 255)  # palette.accentSoft

# Desenhamos grande e reduzimos: e o que deixa a curva dos arcos limpa em 16px.
CANVAS = 1024
EXTENSION_SIZES = (16, 32, 48, 128)
"""
O Android recorta o icone adaptativo em circulo, folha ou quadrado conforme o
aparelho. Manter a arte em dois tercos do canvas garante que nada essencial caia
fora em nenhum desses recortes.
"""
ADAPTIVE_SAFE_RATIO = 0.66

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "extension" / "icons"
ASSETS_DIR = ROOT / "assets"


def draw_art(size: int) -> Image.Image:
    """Radar em fundo transparente, ocupando todo o canvas recebido."""
    art = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(art)

    origin = (size * 0.20, size * 0.80)
    stroke = int(size * 0.075)

    for index, ratio in enumerate((0.34, 0.58, 0.82)):
        radius = size * ratio
        box = (origin[0] - radius, origin[1] - radius, origin[0] + radius, origin[1] + radius)
        # Arcos mais distantes saem mais finos, como o eco que se dispersa.
        draw.arc(box, start=270, end=360, fill=ACCENT, width=stroke - index * int(size * 0.012))

    # A oferta encontrada, no ponto onde a varredura bate.
    blip_radius = size * 0.085
    blip = (size * 0.68, size * 0.33)
    draw.ellipse(
        (blip[0] - blip_radius, blip[1] - blip_radius, blip[0] + blip_radius, blip[1] + blip_radius),
        fill=ACCENT_SOFT,
    )

    return art


def with_background(art: Image.Image) -> Image.Image:
    """Arte sobre o fundo escuro, com o mesmo raio de canto dos cartoes do app."""
    size = art.width
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(icon).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=INK
    )
    icon.alpha_composite(art)

    return icon


def adaptive_foreground(art: Image.Image) -> Image.Image:
    """Camada da frente do icone adaptativo: so a arte, dentro da area segura."""
    size = art.width
    inner = int(size * ADAPTIVE_SAFE_RATIO)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.alpha_composite(art.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2,) * 2)

    return layer


def main() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    art = draw_art(CANVAS)
    icon = with_background(art)

    for size in EXTENSION_SIZES:
        icon.resize((size, size), Image.LANCZOS).save(ICONS_DIR / f"icon{size}.png")
        print(f"extension/icons/icon{size}.png")

    icon.resize((512, 512), Image.LANCZOS).save(ASSETS_DIR / "icon.png")
    print("assets/icon.png")

    adaptive_foreground(art).save(ASSETS_DIR / "adaptive-icon.png")
    print("assets/adaptive-icon.png")

    icon.resize((48, 48), Image.LANCZOS).save(ASSETS_DIR / "favicon.png")
    print("assets/favicon.png")


if __name__ == "__main__":
    main()
