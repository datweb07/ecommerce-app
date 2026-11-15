"""Bake Natural Earth land into a local bitmask and a dotted SVG poster."""

import argparse
import json
import math
from pathlib import Path
from urllib.request import urlopen

SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson"
TARGET = Path(__file__).resolve().parents[1] / "public" / "globe"
WIDTH, HEIGHT = 360, 180


def rasterize(features):
    data = bytearray(WIDTH * HEIGHT // 8)
    for feature in features:
        geometry = feature["geometry"]
        polygons = geometry["coordinates"]
        if geometry["type"] == "Polygon":
            polygons = [polygons]
        for polygon in polygons:
            for y in range(HEIGHT):
                lat = y + 0.5 - 90
                crossings = []
                for ring in polygon:
                    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
                        if (y1 > lat) != (y2 > lat):
                            crossings.append(x1 + (lat - y1) * (x2 - x1) / (y2 - y1))
                crossings.sort()
                for left, right in zip(crossings[::2], crossings[1::2]):
                    for x in range(max(0, math.ceil(left + 179.5)), min(WIDTH, math.ceil(right + 179.5))):
                        cell = y * WIDTH + x
                        data[cell // 8] |= 1 << (cell % 8)
    return data


def poster(data):
    center_lat, center_lng = map(math.radians, (10.7769, 106.7009))
    dots = []
    for i in range(6500):
        y = 1 - (2 * i + 1) / 6500
        lat = math.asin(y)
        lng = (i * math.pi * (3 - math.sqrt(5)) + math.pi) % math.tau - math.pi
        cell = (min(179, int(math.degrees(lat) + 90)) * WIDTH
                + min(359, int(math.degrees(lng) + 180)))
        if not data[cell // 8] & (1 << (cell % 8)):
            continue
        dl = lng - center_lng
        depth = y * math.sin(center_lat) + math.cos(lat) * math.cos(center_lat) * math.cos(dl)
        if depth <= 0:
            continue
        x_proj = math.cos(lat) * math.sin(dl)
        y_proj = y * math.cos(center_lat) - math.cos(lat) * math.sin(center_lat) * math.cos(dl)
        dots.append(f"M{160 + 131*x_proj:.1f} {160 - 131*y_proj:.1f}h.05")
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">'
            '<circle cx="160" cy="160" r="132" fill="none" stroke="black" stroke-width=".55"/>'
            '<path fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" d="'
            + "".join(dots) + '"/></svg>\n')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Read a local copy of ne_110m_land.geojson")
    args = parser.parse_args()
    if args.source:
        features = json.loads(args.source.read_bytes())["features"]
    else:
        with urlopen(SOURCE, timeout=20) as response:
            features = json.load(response)["features"]
    mask = rasterize(features)
    TARGET.mkdir(parents=True, exist_ok=True)
    (TARGET / "land-360x180.bin").write_bytes(mask)
    (TARGET / "poster.svg").write_text(poster(mask), encoding="utf-8")
