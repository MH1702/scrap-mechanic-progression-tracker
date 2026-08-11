"""Open a tiny browser editor for tracing roads on atlas tiles.

The editor is a development helper only. It reads the baked web atlas and
embeds the requested tile previews into a temporary HTML file; nothing is
added to the production web bundle.
"""

import argparse
import base64
import io
import json
import tempfile
import webbrowser
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TILEPACK = ROOT / "web" / "public" / "assets" / "tilepack"
DEFAULT_TILES = (
    "RuinCity_512_01_NEW",
    "RuinCity_512_01",
    "Minidungeon_OverworldEntrance_Chemical_512_01",
    "SiloDistrict_512_01",
)
WAREHOUSE_TILES = (
    "Warehouse_Exterior_2Floors_256_01_NEW",
    "Warehouse_Exterior_2Floors_256_02_NEW",
    "Warehouse_Exterior_2Floors_256_03_NEW",
    "Warehouse_Exterior_2Floors_256_04_NEW",
    "Warehouse_Exterior_3Floors_256_01_NEW",
    "Warehouse_Exterior_4Floors_256_01_NEW",
    "Warehouse_Exterior_4Floors_256_Quest",
    "Warehouse_Exterior_2Floors_256_01",
    "Warehouse_Exterior_2Floors_256_02",
    "Warehouse_Exterior_2Floors_256_03",
    "Warehouse_Exterior_2Floors_256_04",
    "Warehouse_Exterior_3Floors_256_01",
    "Warehouse_Exterior_4Floors_256_01",
)
TILE_GROUPS = {
    "landmarks": DEFAULT_TILES,
    "warehouses": WAREHOUSE_TILES,
}


def tile_previews(names):
    manifest = json.loads((TILEPACK / "manifest.json").read_text(encoding="utf-8"))
    by_name = {tile["name"].lower(): tile for tile in manifest["tiles"].values()}
    pages = {}
    result = []
    for name in names:
        tile = by_name.get(name.lower())
        if tile is None:
            raise SystemExit("Tile not found in atlas: %s" % name)
        page_index = tile["page"]
        if page_index not in pages:
            pages[page_index] = Image.open(
                TILEPACK / manifest["pages"][page_index]
            ).convert("RGB")
        image = pages[page_index].crop((
            tile["x"], tile["y"],
            tile["x"] + tile["w"], tile["y"] + tile["h"],
        ))
        encoded = io.BytesIO()
        image.save(encoded, format="PNG")
        result.append({
            "name": tile["name"],
            "cells": max(tile["cellsX"], tile["cellsY"]),
            "image": "data:image/png;base64," + base64.b64encode(
                encoded.getvalue()
            ).decode("ascii"),
        })
    return result


HTML = r"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Road mapping editor</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, sans-serif; }
  body { margin: 0; background: #181a1b; color: #eee; }
  main { display: grid; grid-template-columns: minmax(520px, 768px) minmax(300px, 1fr); gap: 18px; padding: 18px; }
  canvas { width: 100%; aspect-ratio: 1; background: #111; cursor: crosshair; image-rendering: pixelated; }
  aside { display: flex; flex-direction: column; gap: 12px; }
  select, button, textarea { font: inherit; color: inherit; background: #292c2f; border: 1px solid #565b60; border-radius: 5px; padding: 8px; }
  button { cursor: pointer; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  textarea { min-height: 260px; resize: vertical; font: 12px/1.45 ui-monospace, monospace; }
  p { margin: 0; color: #b8bec5; line-height: 1.45; }
  #position { font: 13px ui-monospace, monospace; color: #f6c453; }
</style>
<main>
  <canvas id="canvas" width="768" height="768"></canvas>
  <aside>
    <label>Tile<br><select id="tile"></select></label>
    <p>Click along the centre of a road. Drag an existing white point to adjust it. Use a separate line whenever a road branches or is interrupted. Coordinates are tile-local cells: (0, 0) is the top-left corner.</p>
    <div id="position">x: -, y: -</div>
    <div class="buttons">
      <button id="new">Finish / new line</button>
      <button id="undo">Undo point</button>
      <button id="delete">Delete current line</button>
      <button id="clear">Clear tile</button>
    </div>
    <div class="buttons">
      <button id="copy">Copy current tile</button>
      <button id="copyAll">Copy all tiles</button>
    </div>
    <textarea id="output" spellcheck="false"></textarea>
    <p>Shortcuts: Ctrl+Z or Backspace = undo, Enter = new line. Switching tiles preserves work during this session.</p>
  </aside>
</main>
<script>
const tiles = __TILES__;
const canvas = document.querySelector("#canvas");
const context = canvas.getContext("2d");
const selector = document.querySelector("#tile");
const output = document.querySelector("#output");
const position = document.querySelector("#position");
const mappings = Object.fromEntries(tiles.map(tile => [tile.name, [[]]]));
const images = new Map();
let current = tiles[0];
let draggedPoint;
let suppressNextClick = false;

for (const tile of tiles) {
  const option = document.createElement("option");
  option.value = tile.name;
  option.textContent = tile.name;
  selector.append(option);
  const image = new Image();
  image.src = tile.image;
  image.onload = draw;
  images.set(tile.name, image);
}

function usefulLines(name) {
  return mappings[name].filter(line => line.length > 0);
}

function updateOutput() {
  output.value = JSON.stringify(usefulLines(current.name), null, 2);
}

function draw() {
  const image = images.get(current.name);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  if (image?.complete) context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const unit = canvas.width / current.cells;
  context.lineWidth = 1;
  context.strokeStyle = "rgba(255,255,255,.28)";
  for (let n = 1; n < current.cells; n++) {
    context.beginPath(); context.moveTo(n * unit, 0); context.lineTo(n * unit, canvas.height); context.stroke();
    context.beginPath(); context.moveTo(0, n * unit); context.lineTo(canvas.width, n * unit); context.stroke();
  }
  for (const line of usefulLines(current.name)) {
    context.beginPath();
    line.forEach(([x, y], index) => index ? context.lineTo(x * unit, y * unit) : context.moveTo(x * unit, y * unit));
    context.lineWidth = 10;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#f6c453";
    context.stroke();
    context.fillStyle = "#fff";
    for (const [x, y] of line) {
      context.beginPath(); context.arc(x * unit, y * unit, 4, 0, Math.PI * 2); context.fill();
    }
  }
  updateOutput();
}

function activeLine() {
  const lines = mappings[current.name];
  if (!lines.length) lines.push([]);
  return lines[lines.length - 1];
}

function newLine() {
  if (activeLine().length) mappings[current.name].push([]);
  draw();
}

function undo() {
  const lines = mappings[current.name];
  if (!activeLine().length && lines.length > 1) lines.pop();
  activeLine().pop();
  draw();
}

function eventPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    rect,
    x: (event.clientX - rect.left) / rect.width * current.cells,
    y: (event.clientY - rect.top) / rect.height * current.cells,
  };
}

function pointAt(event) {
  const { rect, x, y } = eventPosition(event);
  const hitRadius = 14;
  let nearest;
  let nearestDistance = hitRadius;
  mappings[current.name].forEach((line, lineIndex) => line.forEach((point, pointIndex) => {
    const dx = (point[0] - x) * rect.width / current.cells;
    const dy = (point[1] - y) * rect.height / current.cells;
    const distance = Math.hypot(dx, dy);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearest = { lineIndex, pointIndex };
    }
  }));
  return nearest;
}

canvas.addEventListener("pointerdown", event => {
  const hit = pointAt(event);
  if (!hit) return;
  draggedPoint = hit;
  suppressNextClick = true;
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});
canvas.addEventListener("pointermove", event => {
  const { x, y } = eventPosition(event);
  position.textContent = `x: ${x.toFixed(3)}, y: ${y.toFixed(3)}`;
  if (!draggedPoint) return;
  mappings[current.name][draggedPoint.lineIndex][draggedPoint.pointIndex] = [
    Number(Math.max(0, Math.min(current.cells, x)).toFixed(3)),
    Number(Math.max(0, Math.min(current.cells, y)).toFixed(3)),
  ];
  draw();
});
function finishDrag(event) {
  if (!draggedPoint) return;
  draggedPoint = undefined;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointercancel", finishDrag);
canvas.addEventListener("click", event => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  const { x, y } = eventPosition(event);
  activeLine().push([Number(x.toFixed(3)), Number(y.toFixed(3))]);
  draw();
});
canvas.addEventListener("mouseleave", () => position.textContent = "x: -, y: -");
selector.addEventListener("change", () => { current = tiles.find(tile => tile.name === selector.value); draw(); });
document.querySelector("#new").onclick = newLine;
document.querySelector("#undo").onclick = undo;
document.querySelector("#delete").onclick = () => { const lines = mappings[current.name]; lines.pop(); if (!lines.length) lines.push([]); draw(); };
document.querySelector("#clear").onclick = () => { mappings[current.name] = [[]]; draw(); };
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    output.value = text;
    output.focus();
    output.select();
    document.execCommand("copy");
  }
}
document.querySelector("#copy").onclick = () => copyText(output.value);
document.querySelector("#copyAll").onclick = () => copyText(JSON.stringify(
  Object.fromEntries(tiles.map(tile => [tile.name, usefulLines(tile.name)])), null, 2));
document.addEventListener("keydown", event => {
  if ((event.ctrlKey && event.key.toLowerCase() === "z") || event.key === "Backspace") { event.preventDefault(); undo(); }
  if (event.key === "Enter") { event.preventDefault(); newLine(); }
});
draw();
</script>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tiles", nargs="*",
                        help="specific atlas tile names; overrides --group")
    parser.add_argument("--group", choices=sorted(TILE_GROUPS),
                        default="landmarks", help="built-in tile set")
    parser.add_argument("--output", type=Path,
                        help="write the editor HTML here instead of a temp file")
    parser.add_argument("--no-open", action="store_true",
                        help="do not open the generated editor in a browser")
    args = parser.parse_args()

    tile_names = args.tiles or TILE_GROUPS[args.group]
    html = HTML.replace("__TILES__", json.dumps(tile_previews(tile_names)))
    if args.output:
        output_path = args.output.resolve()
        output_path.write_text(html, encoding="utf-8")
    else:
        handle = tempfile.NamedTemporaryFile(
            mode="w", suffix=".html", prefix="smpt-road-mapper-",
            encoding="utf-8", delete=False,
        )
        with handle:
            handle.write(html)
        output_path = Path(handle.name)

    print("Road mapping editor: %s" % output_path)
    if not args.no_open:
        webbrowser.open(output_path.as_uri())


if __name__ == "__main__":
    main()
