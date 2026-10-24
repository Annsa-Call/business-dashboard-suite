#!/usr/bin/env python3
"""
make-thumbs.py — turn the 30 full-page screenshots into web thumbnails.

The demo screenshots are 1400 px wide, 2× DPR PNGs of a *whole page*: 400–800 KB each.
Thirty of them on the portfolio home page came to ~22 MB, which is why the site felt slow.

This writes `thumbs/NN_Name.webp` at 760 px wide (2× for a ~380 px card, sharp on retina),
quality 76 — typically 35–70 KB, i.e. roughly 1/15th of the PNG — plus a 24 px blurred
placeholder that the page inlines so nothing ever pops in from blank.

    python3 tools/make-thumbs.py

Requires Pillow (pip install pillow). Run it after build-demos.js and before build-portfolio.js.
"""
import json
import os
import base64
import io
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots')
THUMBS = os.path.join(ROOT, 'thumbs')
MANIFEST = os.path.join(ROOT, 'tools', 'cache', 'thumbs.json')

WIDTH = 760          # 2× a 380 px card
QUALITY = 76
LQIP_W = 24          # blurred placeholder width

os.makedirs(THUMBS, exist_ok=True)
os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)

manifest = {}
total_png = 0
total_webp = 0

for name in sorted(os.listdir(SHOTS)):
    if not name.endswith('.png') or name.startswith('00_') or name.startswith('mobile'):
        continue
    src = os.path.join(SHOTS, name)
    stem = name[:-4]
    png_size = os.path.getsize(src)
    total_png += png_size

    im = Image.open(src).convert('RGB')
    out_w = WIDTH
    out_h = max(1, round(im.height * out_w / im.width))
    # crop to a 16:10.4 card ratio from the top so the KPI row is always what you see
    card_ratio = 16 / 10.4
    crop_h = min(im.height, round(out_w / card_ratio))
    im_card = im.crop((0, 0, im.width, min(im.height, round(im.width / card_ratio))))
    im_card = im_card.resize((out_w, max(1, round(im_card.height * out_w / im_card.width))),
                             Image.LANCZOS)

    dest = os.path.join(THUMBS, stem + '.webp')
    im_card.save(dest, 'WEBP', quality=QUALITY, method=6)
    webp_size = os.path.getsize(dest)
    total_webp += webp_size

    lqip = im_card.resize((LQIP_W, max(1, round(im_card.height * LQIP_W / im_card.width))), Image.LANCZOS)
    buf = io.BytesIO()
    lqip.save(buf, 'WEBP', quality=40, method=6)
    manifest[stem] = {
        'file': 'thumbs/' + stem + '.webp',
        'w': im_card.width,
        'h': im_card.height,
        'lqip': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii'),
    }

# the portrait, resized for the page (600 px source → 160 px card, 2× = 320)
portrait = os.path.join(ROOT, 'assets', 'ammar.jpg')
if os.path.exists(portrait):
    im = Image.open(portrait).convert('RGB')
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, 0, (im.width + side) // 2, side))
    for w in (320, 640):
        im.resize((w, w), Image.LANCZOS).save(os.path.join(ROOT, 'assets', f'ammar-{w}.webp'),
                                              'WEBP', quality=82, method=6)
        im.resize((w, w), Image.LANCZOS).save(os.path.join(ROOT, 'assets', f'ammar-{w}.jpg'),
                                              'JPEG', quality=84, optimize=True, progressive=True)
    print('portrait → assets/ammar-{320,640}.{webp,jpg}')

with open(MANIFEST, 'w') as fh:
    json.dump(manifest, fh)

print(f'{len(manifest)} thumbnails → thumbs/  '
      f'({total_png/1e6:.1f} MB of PNG became {total_webp/1e6:.2f} MB of WebP, '
      f'{100 - total_webp * 100 / max(total_png,1):.0f}% smaller)')
