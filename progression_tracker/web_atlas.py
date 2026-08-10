"""Bake the installed game's static terrain tiles for the browser viewer.

The output is deliberately separate from the application source.  Scrap
Mechanic is needed only on the machine running this build command; a browser
loads the resulting PNG pages and ``manifest.json`` without touching a game
installation or save file.
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import sys

import numpy as np
from PIL import Image

from smmap import assets, discover, tiles
from smmap.render import MapRenderer

from . import __version__, locations
from .tile_renderer import tile_image


SCHEMA_VERSION = 1


def pack_rectangles(items, page_size=4096, padding=2):
    """Deterministically shelf-pack ``(key, width, height)`` rectangles.

    Returns ``(page_count, placements)`` where each placement is
    ``(page, x, y, width, height)``.  Padding surrounds every image and keeps
    neighbouring atlas pixels out of browser filtering.
    """
    page_size = int(page_size)
    padding = int(padding)
    if page_size < 1 or padding < 0:
        raise ValueError("page size must be positive and padding non-negative")
    ordered = sorted(items, key=lambda v: (-v[2], -v[1], str(v[0])))
    placements = {}
    page = x = y = row_h = 0
    for key, width, height in ordered:
        width, height = int(width), int(height)
        outer_w, outer_h = width + padding * 2, height + padding * 2
        if width < 1 or height < 1 or outer_w > page_size or outer_h > page_size:
            raise ValueError("tile %s (%dx%d) does not fit a %dpx atlas page"
                             % (key, width, height, page_size))
        if x + outer_w > page_size:
            x = 0
            y += row_h
            row_h = 0
        if y + outer_h > page_size:
            page += 1
            x = y = row_h = 0
        placements[key] = (page, x + padding, y + padding, width, height)
        x += outer_w
        row_h = max(row_h, outer_h)
    return ((page + 1) if placements else 0), placements


def _steam_build_id(game_dir):
    steamapps = os.path.dirname(os.path.dirname(os.path.abspath(game_dir)))
    path = os.path.join(steamapps, "appmanifest_%s.acf" % discover.APPID)
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError:
        return None
    match = re.search(r'"buildid"\s+"([^"]+)"', text, re.IGNORECASE)
    return match.group(1) if match else None


def _catalog_hash(index):
    """Stable identity for the tile catalogue used to make this pack."""
    digest = hashlib.sha256()
    for uid, tile in sorted(index.by_uuid.items()):
        rel = os.path.relpath(tile.path, index.game_dir).replace("\\", "/")
        try:
            size = os.path.getsize(tile.path)
            companion = os.path.getsize(tile.tileson)
        except OSError:
            size, companion = 0, 0
        line = "%s\0%s\0%d\0%d\0%d\0%d\n" % (
            uid, rel, tile.cells_x, tile.cells_y, size, companion)
        digest.update(line.encode("utf-8"))
    return digest.hexdigest()


def _edge_pad(page, image, x, y, padding):
    """Paste an image and extend its edge pixels into the padding gutter."""
    page.paste(image, (x, y))
    if not padding:
        return
    w, h = image.size
    page.paste(image.crop((0, 0, 1, h)).resize((padding, h)), (x - padding, y))
    page.paste(image.crop((w - 1, 0, w, h)).resize((padding, h)), (x + w, y))
    page.paste(image.crop((0, 0, w, 1)).resize((w, padding)), (x, y - padding))
    page.paste(image.crop((0, h - 1, w, h)).resize((w, padding)), (x, y + h))
    page.paste(image.getpixel((0, 0)), (x - padding, y - padding,
               x, y))
    page.paste(image.getpixel((w - 1, 0)), (x + w, y - padding,
               x + w + padding, y))
    page.paste(image.getpixel((0, h - 1)), (x - padding, y + h,
               x, y + h + padding))
    page.paste(image.getpixel((w - 1, h - 1)), (x + w, y + h,
               x + w + padding, y + h + padding))


def build(game_dir, out_dir, px=32, page_size=4096, padding=2,
          structures=True, progress=None):
    """Generate atlas PNGs and return the serialisable manifest."""
    game_dir = os.path.abspath(game_dir)
    out_dir = os.path.abspath(out_dir)
    index = tiles.TileIndex(game_dir)
    if not len(index):
        raise RuntimeError("no Scrap Mechanic terrain tiles found in %s" % game_dir)

    px = max(1, int(px))
    specs = [(uid, max(tile.cells_x, tile.cells_y, 1) * px,
              max(tile.cells_x, tile.cells_y, 1) * px)
             for uid, tile in index.by_uuid.items()]
    page_count, placements = pack_rectangles(specs, page_size, padding)
    os.makedirs(out_dir, exist_ok=True)

    db = assets.AssetDb(game_dir)
    dummy = {"bounds": {"xMin": 0, "xMax": 0, "yMin": 0, "yMax": 0}}
    renderer = MapRenderer(dummy, index, px=px, asset_db=db,
                           structures=structures)
    marker_tiles = {}
    for poi_type, variants in locations._poi_tile_uuids(game_dir, index).items():
        for uid, tile in variants.items():
            for label, category, quest in locations.presentations(poi_type):
                local = locations._presentation_point(
                    tile, poi_type, category, quest)
                if local is None:
                    local = (max(tile.cells_x, 1) * 32.0,
                             max(tile.cells_y, 1) * 32.0)
                marker_tiles.setdefault(uid, []).append({
                    "poiType": poi_type,
                    "label": label,
                    "category": category,
                    "color": locations.marker_color(poi_type, category),
                    "quest": quest,
                    "log": locations.POI_LOGS.get(poi_type),
                    "detail": locations.marker_detail(
                        poi_type, category, quest),
                    "localX": local[0],
                    "localY": local[1],
                })
    for uid, definitions in locations.OVERWORLD_TILE_MARKERS.items():
        if uid not in index.by_uuid:
            continue
        for label, category, quest, detail, local_x, local_y in definitions:
            marker_tiles.setdefault(uid, []).append({
                "poiType": 0,
                "label": label,
                "category": category,
                "color": locations.marker_color(0, category),
                "quest": quest,
                "log": None,
                "detail": detail,
                "localX": local_x,
                "localY": local_y,
            })
    for uid, tile in index.by_uuid.items():
        for definition in locations.tile_feature_markers(tile):
            marker_tiles.setdefault(uid, []).append({
                "poiType": definition["poi_type"],
                "label": definition["label"],
                "category": definition["category"],
                "featureType": definition["feature_type"],
                "color": definition["color"],
                "quest": definition["quest"],
                "log": None,
                "detail": definition["detail"],
                "localX": definition["local_x"],
                "localY": definition["local_y"],
            })
    pages = [Image.new("RGB", (page_size, page_size), (0, 0, 0))
             for _ in range(page_count)]
    entries = {}
    ordered = sorted(index.by_uuid.items())
    total = len(ordered)
    for n, (uid, tile) in enumerate(ordered, 1):
        page_no, x, y, width, height = placements[uid]
        rgb = tile_image(renderer, tile, hillshade=False)
        image = Image.fromarray(np.ascontiguousarray(rgb), "RGB")
        if image.size != (width, height):
            raise RuntimeError("rendered size mismatch for %s" % uid)
        _edge_pad(pages[page_no], image, x, y, padding)
        entry = {
            "page": page_no, "x": x, "y": y, "w": width, "h": height,
            "cellsX": tile.cells_x, "cellsY": tile.cells_y,
            "name": tile.name, "biome": tile.biome,
        }
        if uid in marker_tiles:
            entry["markers"] = sorted(marker_tiles[uid],
                                      key=lambda item: item["poiType"])
        entries[uid] = entry
        if progress:
            progress(n, total, tile.name)

    page_files = []
    for n, page in enumerate(pages):
        name = "tiles-%03d.png" % n
        page.save(os.path.join(out_dir, name), format="PNG", optimize=True)
        page_files.append(name)

    manifest = {
        "schema": SCHEMA_VERSION,
        "generator": "Scrap Mechanic Progression Tracker %s" % __version__,
        "generatedUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "game": {"appId": discover.APPID, "buildId": _steam_build_id(game_dir)},
        "catalogSha256": _catalog_hash(index),
        "pixelsPerCell": px,
        "pageSize": page_size,
        "padding": padding,
        "format": "png",
        "orientation": "north-up",
        "pages": page_files,
        "tiles": entries,
    }
    temp = os.path.join(out_dir, "manifest.json.tmp")
    with open(temp, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(manifest, fh, ensure_ascii=False, separators=(",", ":"),
                  sort_keys=True)
        fh.write("\n")
    os.replace(temp, os.path.join(out_dir, "manifest.json"))
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Bake Scrap Mechanic terrain into browser texture atlases")
    parser.add_argument("--game", help="Scrap Mechanic installation folder")
    parser.add_argument("--out", default=os.path.join(
                            "web", "public", "assets", "tilepack"),
                        help="output directory (default: web/public/assets/tilepack)")
    parser.add_argument("--px", type=int, default=32,
                        help="pixels per 64 m cell (default: 32)")
    parser.add_argument("--page-size", type=int, default=4096,
                        help="square atlas page size (default: 4096)")
    parser.add_argument("--padding", type=int, default=2,
                        help="edge padding around each tile (default: 2)")
    parser.add_argument("--no-structures", action="store_true",
                        help="omit static buildings, rocks and vegetation")
    args = parser.parse_args(argv)
    game = args.game or discover.find_game()
    if not game:
        parser.error("could not find Scrap Mechanic; pass --game PATH")

    def report(done, total, name):
        if done == 1 or done == total or done % 20 == 0:
            print("  [%4d/%4d] %s" % (done, total, name))

    print("Baking browser tile pack from %s" % game)
    manifest = build(game, args.out, px=args.px, page_size=args.page_size,
                     padding=args.padding, structures=not args.no_structures,
                     progress=report)
    total_bytes = sum(os.path.getsize(os.path.join(args.out, p))
                      for p in manifest["pages"])
    print("Wrote %d tiles on %d page(s): %.2f MB" %
          (len(manifest["tiles"]), len(manifest["pages"]),
           total_bytes / 1e6))
    print(os.path.abspath(os.path.join(args.out, "manifest.json")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
