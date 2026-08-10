"""Generate the browser garment catalogue from an installed game copy.

Usage:
    python scripts/generate_garment_catalogue.py "C:\\...\\Scrap Mechanic"
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


SLOTS = {"torso", "gloves", "shoes", "legs", "hat", "backpack"}
GROUP_NAMES = {
    "crashmechanic": "Crash Mechanic",
    "goldenmechanic": "Golden Mechanic",
    "rescueman": "Fire Jumper",
    "duck": "Duckie",
    "logicmaster": "Logic Hero",
    "glowbug": "Brilliant Rider",
}


def group_for(key: str) -> str:
    remainder = key.split("_", 2)[2]
    if "tshirt" in remainder or "_shirt_" in remainder or "sweater" in remainder:
        return "Shirts & sweaters"
    return GROUP_NAMES.get(remainder.split("_", 1)[0], remainder.split("_", 1)[0].title())


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Pass the Scrap Mechanic installation directory.")
    game = Path(sys.argv[1])
    constants = (game / "Survival/Scripts/game/survival_items.lua").read_text(encoding="utf-8")
    descriptions_path = game / "Data/Gui/Language/English/CustomizationDescriptions.json"
    descriptions_text = descriptions_path.read_text(encoding="utf-8-sig")
    descriptions = json.loads("\n".join(descriptions_text.splitlines()[1:]))

    pattern = re.compile(
        r'\b(outfit_([a-z]+)_[a-z0-9_]+)\s*=\s*sm\.uuid\.new\(\s*"([0-9a-f-]{36})"'
    )
    garments = []
    for key, slot, uuid in pattern.findall(constants):
        if slot not in SLOTS or key.endswith("_none"):
            continue
        garments.append({
            "uuid": uuid,
            "title": descriptions[uuid]["title"],
            "group": group_for(key),
            "slot": slot,
        })

    garments.sort(key=lambda garment: (garment["group"], garment["title"]))
    output = Path(__file__).parents[1] / "web/src/lib/garments.generated.ts"
    output.write_text(
        "// Generated from the installed game's survival_items.lua and English localization.\n"
        "// Run scripts/generate_garment_catalogue.py to refresh it.\n"
        "import type { GarmentDefinition } from \"@/lib/garments\"\n\n"
        "export const garments: GarmentDefinition[] = "
        + json.dumps(garments, ensure_ascii=False, separators=(",", ":"))
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(garments)} garments to {output}")


if __name__ == "__main__":
    main()
