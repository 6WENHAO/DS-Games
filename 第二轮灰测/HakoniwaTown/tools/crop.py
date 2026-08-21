from PIL import Image
import os

src = "tools/shots"
out = "tools/crops"
os.makedirs(out, exist_ok=True)

jobs = [
    ("plaza.png", (300, 120, 1150, 700), "plaza_zoom.png"),
    ("harbor.png", (250, 200, 1150, 760), "harbor_zoom.png"),
    ("day.png", (330, 130, 1120, 700), "day_zoom.png"),
    ("night.png", (330, 130, 1120, 700), "night_zoom.png"),
    ("hill.png", (300, 150, 1150, 720), "hill_zoom.png"),
    ("station.png", (300, 150, 1150, 720), "station_zoom.png"),
    ("fair.png", (350, 180, 1150, 720), "fair_zoom.png"),
    ("dusk.png", (330, 130, 1120, 700), "dusk_zoom.png"),
]
for name, boxc, dst in jobs:
    p = os.path.join(src, name)
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGB").crop(boxc)
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    im.save(os.path.join(out, dst), quality=95)
    print("wrote", dst, im.size)
