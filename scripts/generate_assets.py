from pathlib import Path
from math import cos, pi, sin
import random

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets"
ASSET_DIR.mkdir(parents=True, exist_ok=True)


def mix(a, b, amount):
    return int(a + (b - a) * amount)


def gear_points(cx, cy, inner_radius, outer_radius, teeth, rotation=0):
    points = []
    for index in range(teeth * 4):
        angle = rotation + index * pi / (teeth * 2)
        phase = index % 4
        radius = outer_radius if phase in (1, 2) else inner_radius
        points.append((cx + cos(angle) * radius, cy + sin(angle) * radius))
    return points


def draw_turbine(draw, x, y, scale, color):
    hub_y = y - 180 * scale
    draw.line((x, y, x, hub_y), fill=color, width=max(2, int(8 * scale)))
    draw.ellipse(
        (x - 8 * scale, hub_y - 8 * scale, x + 8 * scale, hub_y + 8 * scale),
        fill=color,
    )
    for angle in (-pi / 2, pi / 6, 5 * pi / 6):
        end_x = x + cos(angle) * 95 * scale
        end_y = hub_y + sin(angle) * 95 * scale
        draw.line((x, hub_y, end_x, end_y), fill=color, width=max(2, int(5 * scale)))


def build_cover():
    width, height = 1600, 900
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    left = (18, 52, 45)
    right = (78, 113, 119)
    random.seed(31)

    for y in range(height):
        for x in range(width):
            horizontal = x / width
            vertical = y / height
            amount = min(1, horizontal * 0.82 + vertical * 0.14)
            noise = random.randint(-3, 3)
            pixels[x, y] = (
                max(0, min(255, mix(left[0], right[0], amount) + noise)),
                max(0, min(255, mix(left[1], right[1], amount) + noise)),
                max(0, min(255, mix(left[2], right[2], amount) + noise)),
            )

    background = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw_bg = ImageDraw.Draw(background)
    draw_bg.rectangle((0, 610, width, height), fill=(14, 31, 28, 105))
    draw_turbine(draw_bg, 220, 690, 1.0, (221, 237, 234, 65))
    draw_turbine(draw_bg, 460, 720, 0.72, (221, 237, 234, 45))
    draw_turbine(draw_bg, 650, 735, 0.52, (221, 237, 234, 34))
    background = background.filter(ImageFilter.GaussianBlur(1.2))
    image = Image.alpha_composite(image.convert("RGBA"), background)

    machine = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(machine)
    draw.rounded_rectangle((720, 220, 1530, 760), radius=34, fill=(25, 44, 42, 230), outline=(157, 184, 180, 180), width=4)
    draw.polygon([(720, 315), (610, 390), (610, 615), (720, 680)], fill=(35, 60, 57, 235), outline=(154, 180, 175, 160))
    draw.rectangle((560, 446, 790, 566), fill=(54, 75, 73, 245), outline=(173, 195, 190, 170), width=4)
    draw.rectangle((510, 476, 610, 536), fill=(120, 142, 137, 220))

    center = (1165, 490)
    draw.ellipse((865, 190, 1465, 790), fill=(25, 35, 35, 255), outline=(186, 205, 200, 220), width=8)
    draw.ellipse((900, 225, 1430, 755), fill=(92, 112, 109, 255), outline=(224, 232, 229, 180), width=5)
    draw.ellipse((935, 260, 1395, 720), fill=(33, 49, 47, 255), outline=(19, 28, 27, 180), width=6)

    ball_radius = 21
    for index in range(16):
        angle = index * 2 * pi / 16
        x = center[0] + cos(angle) * 196
        y = center[1] + sin(angle) * 196
        shade = 190 + int(25 * sin(angle))
        draw.ellipse(
            (x - ball_radius, y - ball_radius, x + ball_radius, y + ball_radius),
            fill=(shade, shade + 9, shade + 6, 255),
            outline=(235, 241, 239, 185),
            width=2,
        )

    draw.polygon(gear_points(1165, 490, 120, 142, 22, rotation=0.05), fill=(58, 78, 75, 255), outline=(205, 216, 212, 220))
    draw.ellipse((1085, 410, 1245, 570), fill=(26, 43, 40, 255), outline=(181, 198, 193, 220), width=5)
    draw.ellipse((1128, 453, 1202, 527), fill=(113, 135, 130, 255), outline=(227, 233, 231, 210), width=3)

    for angle in (0, 2 * pi / 3, 4 * pi / 3):
        x = 1165 + cos(angle) * 104
        y = 490 + sin(angle) * 104
        draw.polygon(gear_points(x, y, 34, 45, 12, rotation=angle), fill=(171, 150, 101, 255), outline=(240, 216, 155, 220))
        draw.ellipse((x - 14, y - 14, x + 14, y + 14), fill=(39, 56, 53, 255))

    draw.line((785, 295, 915, 320), fill=(71, 161, 169, 220), width=6)
    draw.line((785, 682, 915, 655), fill=(71, 161, 169, 180), width=6)
    draw.line((1395, 325, 1510, 285), fill=(224, 171, 71, 220), width=7)
    draw.ellipse((1488, 267, 1524, 303), fill=(224, 171, 71, 255))

    bolts = [(765, 285), (765, 696), (1485, 290), (1485, 690)]
    for x, y in bolts:
        draw.ellipse((x - 12, y - 12, x + 12, y + 12), fill=(147, 168, 163, 255), outline=(223, 231, 228, 180), width=2)
        draw.line((x - 7, y, x + 7, y), fill=(56, 72, 69, 255), width=2)

    machine = machine.filter(ImageFilter.GaussianBlur(0.25))
    image = Image.alpha_composite(image, machine)

    sheen = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw_sheen = ImageDraw.Draw(sheen)
    draw_sheen.ellipse((930, 230, 1400, 700), outline=(255, 255, 255, 35), width=12)
    draw_sheen.polygon([(0, 0), (720, 0), (360, 900), (0, 900)], fill=(5, 18, 15, 70))
    image = Image.alpha_composite(image, sheen)

    image.convert("RGB").save(ASSET_DIR / "gearbox-cover.png", quality=94, optimize=True)
    image.convert("RGB").resize((1200, 675), Image.Resampling.LANCZOS).crop((0, 22, 1200, 652)).save(
        ASSET_DIR / "share-cover.png", quality=93, optimize=True
    )


def build_icon(size):
    image = Image.new("RGB", (size, size), (21, 58, 49))
    draw = ImageDraw.Draw(image)
    center = size / 2
    outer = size * 0.31
    inner = size * 0.24
    draw.ellipse(
        (center - outer, center - outer, center + outer, center + outer),
        fill=(211, 225, 220),
    )
    draw.ellipse(
        (center - inner, center - inner, center + inner, center + inner),
        fill=(21, 58, 49),
    )

    ball_radius = size * 0.031
    for index in range(10):
        angle = index * 2 * pi / 10
        x = center + cos(angle) * size * 0.275
        y = center + sin(angle) * size * 0.275
        draw.ellipse(
            (x - ball_radius, y - ball_radius, x + ball_radius, y + ball_radius),
            fill=(87, 155, 151),
        )

    points = gear_points(center, center, size * 0.11, size * 0.15, 12)
    draw.polygon(points, fill=(225, 170, 66))
    draw.ellipse(
        (center - size * 0.06, center - size * 0.06, center + size * 0.06, center + size * 0.06),
        fill=(21, 58, 49),
    )
    return image


if __name__ == "__main__":
    build_cover()
    build_icon(192).save(ASSET_DIR / "icon-192.png", optimize=True)
    build_icon(512).save(ASSET_DIR / "icon-512.png", optimize=True)
    print(f"Generated assets in {ASSET_DIR}")
