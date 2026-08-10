"""Quest and progression location markers for the flat map.

The terrain tells us where every unique POI was generated.  The quest manager
and POI entrance storage tell us which of those locations the save has revealed.
All reads go through :class:`SaveFile`'s immutable, query-only connection.
"""

import os
import re
import json

from smmap import smlua
from smmap.savefile import unpack_blob


# poi type -> (label, category, quest which reveals it)
# POI ids come from the installed game's poi_types.lua; keeping the small
# presentation table here gives us readable, stable labels in the standalone
# page while tile UUIDs are still discovered dynamically from the game install.
# Quest labels are the exact English titles from
# Data/Gui/Language/English/QuestInterfaceTags.txt.
POIS = {
    101: ("Crashed Ship", "location", "quest_tutorial"),
    102: ("Trader's Hideout", "location", "quest_trader_tracking"),
    103: ("Growlab 5", "growlab", None),
    104: ("Growlab 7", "growlab", None),
    105: ("Lorenzo's Ship", "location", "quest_endgame"),
    107: ("Lost and Found", "main_quest", "quest_find_recording"),
    109: ("Mechanic Station 2", "location", "quest_tutorial"),
    110: ("Vegetable Packing Station", "location", None),
    111: ("Fruit Packing Station", "location", None),
    123: ("The Warehouse", "main_quest", "quest_clear_warehouse"),
    124: ("The Mechanic Station", "main_quest", "quest_mechanicstation"),
    125: ("Your Work Car", "side_quest", "quest_build_harvest_car"),
    126: ("Home is Where the Woc Is", "side_quest", "quest_build_wochouse"),
    127: ("Cardboard Munchies", "side_quest", "quest_build_cardboardpoop"),
    128: ("Make Some Noise", "side_quest", "quest_build_xylophone"),
    129: ("Bee Like Me", "side_quest", "quest_build_beesuit"),
    130: ("Round She Goes", "side_quest", "quest_build_carousel"),
    131: ("Cageball Rock", "side_quest", "quest_build_crowbar"),
    132: ("Any Which Way but Home", "side_quest", "quest_build_compass"),
    133: ("A Place to Dump Your Scrap", "side_quest", "quest_build_nicehouse"),
    134: ("Building Bridges", "side_quest", "quest_build_steelbridge"),
    135: ("Every Bot Looks Like a Nail", "side_quest", "quest_build_sledgehammer"),
    136: ("The Important Meal", "side_quest", "quest_build_baguette"),
    137: ("Growlab 1", "growlab", "quest_clear_minidungeon"),
    205: ("Timber!", "side_quest", "quest_build_sawbladearm"),
    206: ("Growlab 4", "growlab", None),
    302: ("If You Can't Take the Heat…", "side_quest", "quest_build_bigfan"),
    303: ("Now the Flowers Will Grow", "side_quest", "quest_build_garden"),
    304: ("Growlab 2", "growlab", None),
    403: ("Heart of Corn", "side_quest", "quest_build_cornheart"),
    404: ("Home is Where You go to Bed", "side_quest", "quest_build_cozybed"),
    505: ("Just a bot in a Cage", "side_quest", "quest_build_totebotkey"),
    506: ("Onwards and Upwards", "side_quest", "quest_build_catapult"),
    507: ("Growlab 3", "growlab", None),
    604: ("A Stranger in Need", "main_quest", "quest_mystery_call"),
    605: ("The Pop Don't Stop", "side_quest", "quest_build_popcorn"),
    606: ("Itty Bitty Ditty", "side_quest", "quest_build_musicbox"),
    803: ("Growlab 6", "growlab", None),
}

# Some generated destinations serve more than one purpose. POI type 124 is the
# quest-specific station encountered during progression, which gives us a more
# reliable Station 1 identity than a geometric distance heuristic. It remains
# both an independent quest marker and a permanent location marker.
POI_ALIASES = {
    101: (
        ("Getting Started", "main_quest", "quest_tutorial"),
        ("The Gyro-Core", "main_quest", "quest_bosstrain"),
        ("Your First Car", "side_quest", "quest_build_first_car"),
    ),
    102: (
        ("A Stranger in Need", "main_quest", "quest_mystery_call"),
        ("Palate Cleanser", "main_quest", "quest_feed_the_farmers"),
        ("Home is Where Your Couch Is", "main_quest", "quest_build_watchtower"),
        ("Where's the Fire?", "main_quest", "quest_save_watchtower"),
        ("Built to Last", "main_quest", "quest_rebuild_watchtower"),
    ),
    104: (("Scrap Garage", "location", None),),
    105: (("One Last Ride", "main_quest", "quest_endgame"),),
    110: (
        ("Palate Cleanser", "main_quest", "quest_feed_the_farmers"),
        ("Your Nice Car", "side_quest", "quest_build_advanced_car"),
    ),
    124: (("Mechanic Station 1", "location", "quest_mechanicstation"),),
    137: (("A Farmers Side Hustle", "main_quest", "quest_clear_minidungeon"),),
}

GROWLAB_AREAS = {
    137: "Meadow",
    304: "Clifftop",
    507: "Frozen",
    206: "Station",
    103: "Silo District",
    803: "Island",
    104: "Ruin City",
}

# Exact tile-local positions registered by terrain_overworld.lua. Unlike the
# other builder quests, these three markers are hosted by existing landmark
# tiles rather than one dedicated POI type apiece.
QUEST_MARKER_POINTS = {
    (101, "quest_tutorial"): (61.0, 64.668380737305),
    (101, "quest_bosstrain"): (59.824802398682, 79.013061523438),
    (101, "quest_build_first_car"): (94.145835876465, 51.541519165039),
    (102, "quest_mystery_call"): (341.44476318359, 107.02053070068),
    (102, "quest_feed_the_farmers"): (249.45135498047, 284.99481201172),
    (102, "quest_build_watchtower"): (335.61038208008, 109.64981842041),
    (102, "quest_save_watchtower"): (330.66616821289, 102.5),
    (102, "quest_rebuild_watchtower"): (335.61038208008, 109.64981842041),
    (105, "quest_endgame"): (187.81971740723, 171.81852722168),
    (107, "quest_find_recording"): (71.0, 54.25),
    (110, "quest_feed_the_farmers"): (37.500865936279, 93.207527160645),
    (110, "quest_build_advanced_car"): (112.14583587646, 15.041519165039),
    (123, "quest_clear_warehouse"): (136.87411499023, 76.196235656738),
    (124, "quest_mechanicstation"): (50.0, 85.0),
    (137, "quest_clear_minidungeon"): (135.53179931641, 143.93862915039),
    (604, "quest_mystery_call"): (35.333766937256, 53.866268157959),
    (125, "quest_build_harvest_car"): (26.958480834961, 52.145835876465),
}

# Relevant quest-marker tiles which are fixed overworld landmarks but are not
# registered as POI types in poi.lua. These remain part of the flat main map;
# no underground-world marker is included here.
OVERWORLD_TILE_MARKERS = {
    "943c232a-a780-4099-bffc-54ce08c184c5": (
        ("Getting Started", "main_quest", "quest_tutorial",
         "Crashed Tower", 60.253761291504, 22.253644943237),
    ),
    "ba31a522-7659-4ec5-b933-8b83960c57f2": (
        ("Down Below", "main_quest", "quest_find_excavation",
         "Excavation Bridge", 485.55630493164, 479.99038696289),
    ),
    "bf0ba240-416f-4f32-b87d-3a445919e72a": (
        ("Down Below", "main_quest", "quest_find_excavation",
         "Excavation Elevator", 525.96221923828, 575.54779052734),
    ),
    "5deb2830-b52e-40af-91c2-e53aee6c5165": (
        ("The Gyro-Core", "main_quest", "quest_bosstrain",
         "Boss Mountain", 45.999988555908, 40.499912261963),
    ),
}

# The mysterious-caller quest can point at either of these generated sites.
# Keep that map context separate from its localized quest title.
QUEST_DESTINATIONS = {
    (101, "quest_tutorial"): "Crashed Ship",
    (101, "quest_bosstrain"): "Crashed Ship",
    (102, "quest_mystery_call"): "Trader's Hideout",
    (102, "quest_feed_the_farmers"): "Trader's Hideout",
    (102, "quest_build_watchtower"): "Watchtower",
    (102, "quest_save_watchtower"): "Watchtower",
    (102, "quest_rebuild_watchtower"): "Watchtower",
    (105, "quest_endgame"): "Lorenzo's Ship",
    (107, "quest_find_recording"): "Burial Site",
    (110, "quest_feed_the_farmers"): "Vegetable Packing Station",
    (123, "quest_clear_warehouse"): "Warehouse",
    (124, "quest_mechanicstation"): "Mechanic Station 1",
    (137, "quest_clear_minidungeon"): "Growlab 1",
    (604, "quest_mystery_call"): "Autumn Ruins",
}

DEFAULT_MARKER_COLORS = {
    "location": "#a970ff",
    "main_quest": "#ffb52e",
    "side_quest": "#63d8ff",
    "growlab": "#ffd447",
}

# Repeatable landmarks are derived from each generated terrain tile rather
# than from the game's unique POI/quest registries. Their stable type is used
# by the web sidebar to toggle every instance together.
WORLD_FEATURE_COLORS = {
    "chemical_pond": "#8ccc4a",
    "oil_pond": "#c58a45",
    "warehouse": "#788cff",
    "schematic_bot": "#e86acb",
}

POI_MARKER_COLORS = {
    (101, "location"): "#a970ff",
    (102, "location"): "#61d46e",
    (104, "location"): "#a970ff",
    (109, "location"): "#a970ff",
    (110, "location"): "#61d46e",
    (111, "location"): "#61d46e",
    (124, "location"): "#a970ff",
    (137, "growlab"): "#ffd447",
    (304, "growlab"): "#ff8a3d",
    (507, "growlab"): "#27c7b8",
    (206, "growlab"): "#65c96b",
    (103, "growlab"): "#a970ff",
    (803, "growlab"): "#4d9cff",
    (104, "growlab"): "#ef5b5b",
}

POI_LOGS = {
    110: "71fa62f6-c121-4e60-b1c1-5a4fbfd41522",
    111: "d16f9ffd-f18a-4428-8a6f-72d1afe8aed6",
}

POI_STORAGE_UID = bytes.fromhex("744526195c20a1a5fc53190a7bc43051")[::-1]
# Serialized integer key for STORAGE_CHANNEL_LOGS (60). The game writes its
# logbook UUID array through sm.storage.save on this engine-owned channel.
LOG_STORAGE_KEY = bytes.fromhex("4c554100000001083c")
# Serialized integer key for STORAGE_CHANNEL_RECIPEMANAGER (49). Its
# ``unlockedRecipes`` table is the authoritative set shared by all players in
# the world; reading it avoids inferring ownership from quest completion.
RECIPE_STORAGE_KEY = bytes.fromhex("4c5541000000010831")
_QUEST = re.compile(rb"quest_[a-z0-9_]+")
def presentations(poi_type):
    """Every label/category/quest presentation attached to a POI type."""
    primary = POIS.get(poi_type)
    return (() if primary is None else (primary,)) + POI_ALIASES.get(poi_type, ())


_KNOWN_QUESTS = {
    quest
    for poi_type in set(POIS) | set(POI_ALIASES)
    for _label, _category, quest in presentations(poi_type)
    if quest
} | {
    quest
    for definitions in OVERWORLD_TILE_MARKERS.values()
    for _label, _category, quest, _detail, _x, _y in definitions
}


def marker_detail(poi_type, category, quest=None):
    """Secondary map context which is not part of a marker's display name."""
    if category == "growlab":
        return GROWLAB_AREAS.get(poi_type)
    if category == "main_quest":
        return QUEST_DESTINATIONS.get((poi_type, quest))
    return None


def marker_color(poi_type, category):
    """Game-style colour for one independently presented marker."""
    return POI_MARKER_COLORS.get(
        (poi_type, category), DEFAULT_MARKER_COLORS.get(category, "#a970ff"))


def _quest_names(data):
    names = set()
    for match in _QUEST.findall(data):
        name = match.decode("ascii")
        # An active quest key is immediately followed by a serialized engine
        # reference whose type tag is ASCII ``d`` (0x64).  The byte-oriented
        # fallback regex sees that tag as part of the identifier.
        if name not in _KNOWN_QUESTS and name.endswith("d") and name[:-1] in _KNOWN_QUESTS:
            name = name[:-1]
        names.add(name)
    return names


def _quest_state(save):
    """Return active and completed quest names from the manager record.

    Active quest values are engine object references which our general Lua
    decoder deliberately does not pretend to understand.  The table and string
    names are nevertheless self-describing, so constrain extraction to the two
    named table spans instead of guessing those object layouts.
    """
    active, completed = set(), set()
    if "ScriptData" not in save._tables:
        return active, completed
    for (blob,) in save.con.execute("SELECT data FROM ScriptData"):
        raw = unpack_blob(blob)
        if not raw or b"activeQuests" not in raw or b"completedQuests" not in raw:
            continue
        a = raw.find(b"activeQuests")
        c = raw.find(b"completedQuests", a)
        if c < 0:
            continue
        active.update(_quest_names(raw[a:c]))
        completed.update(_quest_names(raw[c:]))
        break
    return active, completed


def _unlocked_pois(save):
    out = set()
    if "ScriptData" not in save._tables:
        return out
    rows = save.con.execute("SELECT data FROM ScriptData WHERE uid=?",
                            (POI_STORAGE_UID,))
    for (blob,) in rows:
        raw = unpack_blob(blob)
        if not raw or b"unlocked" not in raw or raw[:3] != smlua.MAGIC:
            continue
        try:
            value = smlua.loads(raw)
        except Exception:
            continue
        if (isinstance(value, dict) and value.get("unlocked") is True
                and isinstance(value.get("poiType"), int)):
            out.add(value["poiType"])
    return out


def _unlocked_logs(save):
    """Return logbook UUIDs stored in the game's channel 60 record."""
    out = set()
    if "ScriptData" not in save._tables:
        return out
    rows = save.con.execute("SELECT data FROM ScriptData WHERE key=?",
                            (LOG_STORAGE_KEY,))
    for (blob,) in rows:
        raw = unpack_blob(blob)
        if not raw or raw[:3] != smlua.MAGIC:
            continue
        try:
            value = smlua.loads(raw)
        except Exception:
            continue
        values = value.values() if isinstance(value, dict) else value
        if not isinstance(values, (list, tuple)) and not hasattr(values, "__iter__"):
            continue
        for item in values:
            if isinstance(item, str):
                out.add(item.lower())
    return out


def _unlocked_recipes(save):
    """Return lower-case recipe UUIDs from Recipe Manager storage channel 49."""
    out = set()
    if "ScriptData" not in save._tables:
        return out
    rows = save.con.execute("SELECT data FROM ScriptData WHERE key=?",
                            (RECIPE_STORAGE_KEY,))
    for (blob,) in rows:
        raw = unpack_blob(blob)
        if not raw or raw[:3] != smlua.MAGIC:
            continue
        try:
            value = smlua.loads(raw)
        except Exception:
            continue
        recipes = value.get("unlockedRecipes") if isinstance(value, dict) else None
        if not isinstance(recipes, dict):
            continue
        for item_id, unlocked in recipes.items():
            if unlocked is True and isinstance(item_id, str):
                out.add(item_id.lower())
    return out


def progression_state(save):
    """Browser-safe quest and POI state from a read-only open save."""
    active, completed = _quest_state(save)
    return {
        "activeQuests": sorted(active),
        "completedQuests": sorted(completed),
        "unlockedLogs": sorted(_unlocked_logs(save)),
        "unlockedPoiTypes": sorted(_unlocked_pois(save)),
        "unlockedRecipes": sorted(_unlocked_recipes(save)),
    }


def _poi_tile_uuids(game_dir, tile_index):
    """Map POI type numbers to installed tile UUIDs via the game's Lua lists."""
    root = os.path.join(game_dir, "Survival", "Scripts", "terrain", "overworld")
    try:
        with open(os.path.join(root, "poi_types.lua"), "r", encoding="utf-8") as f:
            type_text = f.read()
        with open(os.path.join(root, "poi.lua"), "r", encoding="utf-8") as f:
            poi_text = f.read()
    except OSError:
        return {}
    types = {m.group(1): int(m.group(2)) for m in re.finditer(
        r"^\s*(POI_[A-Z0-9_]+)\s*=\s*(\d+)", type_text, re.MULTILINE)}
    paths = {}
    pattern = (r"addPoiTile(?:Legacy|Retired)?\(\s*(POI_[A-Z0-9_]+)\s*,"
               r"(?:\s*\d+\s*,)?\s*\"\$SURVIVAL_DATA/([^\"]+\.tile)\"")
    for m in re.finditer(pattern, poi_text):
        poi_type = types.get(m.group(1))
        if poi_type in POIS:
            if poi_type == 101 and "crashedship" not in m.group(2).lower():
                continue
            suffix = os.path.normcase(os.path.normpath(
                os.path.join("Survival", m.group(2).replace("/", os.sep))))
            paths.setdefault(poi_type, set()).add(suffix)
    out = {}
    for uid, tile in tile_index.by_uuid.items():
        rel = os.path.normcase(os.path.normpath(os.path.relpath(tile.path, game_dir)))
        for poi_type, suffixes in paths.items():
            if rel in suffixes:
                out.setdefault(poi_type, {})[uid] = tile
    return out


def _world_point(cell_x, cell_y, rotation, local_x, local_y):
    """Rotate a tile-local point into world metres around its offset-zero cell.

    A rotated tile's offset-zero cell is a rotated corner, not necessarily its
    minimum X/Y cell.  These are the same four transforms used by the game's
    RotateLocal placement and verified against the save's Portal cells.
    """
    if rotation == 1:
        return ((cell_x + 1) * 64.0 - local_y,
                cell_y * 64.0 + local_x)
    if rotation == 2:
        return ((cell_x + 1) * 64.0 - local_x,
                (cell_y + 1) * 64.0 - local_y)
    if rotation == 3:
        return (cell_x * 64.0 + local_y,
                (cell_y + 1) * 64.0 - local_x)
    return (cell_x * 64.0 + local_x,
            cell_y * 64.0 + local_y)


def _tile_origin(cell_x, cell_y, rotation, x_offset, y_offset):
    """Recover a rotated tile's virtual origin from any occupied cell."""
    if rotation == 1:
        return cell_x + y_offset, cell_y - x_offset
    if rotation == 2:
        return cell_x + x_offset, cell_y + y_offset
    if rotation == 3:
        return cell_x - y_offset, cell_y + x_offset
    return cell_x - x_offset, cell_y - y_offset


def _prefab_point(tile, path_fragment, required_tag=None):
    """Position of the first prefab whose path contains ``path_fragment``."""
    points = _prefab_points(tile, path_fragment, required_tag)
    return points[0] if points else None


def _prefab_points(tile, path_fragment, required_tag=None):
    """Positions of all matching prefabs embedded in a terrain tile."""
    path_fragment = path_fragment.replace("\\", "/").lower()
    try:
        with open(tile.tileson, "r", encoding="utf-8") as f:
            entities = json.load(f).get("entities") or {}
    except (AttributeError, OSError, ValueError):
        return ()
    points = []
    for prefab in entities.get("prefabs") or []:
        path = prefab.get("path", "").replace("\\", "/").lower()
        if path_fragment not in path:
            continue
        if required_tag is not None:
            tags = {str(tag).lower() for tag in prefab.get("tags") or []}
            if required_tag.lower() not in tags:
                continue
        position = (prefab.get("transform") or {}).get("position")
        if isinstance(position, list) and len(position) >= 2:
            points.append((float(position[0]), float(position[1])))
    return tuple(points)


def tile_feature_markers(tile):
    """Return repeatable overworld landmarks embedded in ``tile``.

    Resource prefabs identify every pond while names identify the finite
    station and warehouse tile families. Prefab transforms provide an exact
    anchor on the source, station, or warehouse entrance. This is deliberately
    separate from POI ids: these landmarks may occur any number of times in a
    generated world and have no discovery/unlock state.
    """
    name = getattr(tile, "name", "") or ""
    lowered = name.lower()
    feature_type = label = detail = path_fragment = required_tag = None

    # Resource sources are identified by their actual liquid prefab. This
    # includes chemical plants, Silo District, random desert oil sources, and
    # tiles containing several distinct ponds.
    for resource_type, resource_label, fragment in (
        ("chemical_pond", "Chemical Pond", "environment_prefabs/chemicals.prefab"),
        ("oil_pond", "Oil Pond", "environment_prefabs/oil.prefab"),
    ):
        points = _prefab_points(tile, fragment)
        if points:
            return tuple({
                "poi_type": 0,
                "label": resource_label,
                "category": "world_feature",
                "feature_type": resource_type,
                "color": WORLD_FEATURE_COLORS[resource_type],
                "quest": None,
                "detail": None,
                "local_x": point[0],
                "local_y": point[1],
            } for point in points)

    if lowered.startswith("schematicstation_"):
        feature_type, label = "schematic_bot", "Schematic Bot"
        path_fragment = "ap_partunlockstation_01.prefab"
    else:
        warehouse = re.match(r"warehouse_exterior_(\d+)floors_", lowered)
        if warehouse:
            levels = int(warehouse.group(1))
            feature_type = "warehouse"
            if lowered.endswith("_quest"):
                label = "Trashbot/Story Warehouse"
                detail = "%d levels · Trashbot arena" % levels
            else:
                label = "Warehouse"
                detail = "%d levels" % levels
            path_fragment = "warehouse_elevator_exterior_01.prefab"
            required_tag = "entrance"

    if feature_type is None:
        return ()
    local = _prefab_point(tile, path_fragment, required_tag)
    if local is None:
        local = (max(getattr(tile, "cells_x", 1), 1) * 32.0,
                 max(getattr(tile, "cells_y", 1), 1) * 32.0)
    return ({
        "poi_type": 0,
        "label": label,
        "category": "world_feature",
        "feature_type": feature_type,
        "color": WORLD_FEATURE_COLORS[feature_type],
        "quest": None,
        "detail": detail,
        "local_x": local[0],
        "local_y": local[1],
    },)


def _presentation_point(tile, poi_type, category, quest=None):
    """A meaningful tile-local anchor for one marker presentation."""
    if (poi_type, quest) in QUEST_MARKER_POINTS:
        return QUEST_MARKER_POINTS[(poi_type, quest)]
    if category == "growlab":
        return _prefab_point(tile, "dungeons_entranceelevator_")
    if poi_type == 104 and category == "location":
        # The Scrap City garage is a location node rather than a top-level
        # prefab transform; these coordinates come from terrain_overworld.lua.
        return 336.06533813477, 204.72267150879
    if category == "location" and poi_type in (109, 124):
        return _prefab_point(tile, "mechanicstation_station_01.prefab")
    if category == "location" and poi_type in (110, 111):
        return _prefab_point(tile, "packingstation_")
    return None


def collect(game_dir, tile_index, cell_data, save):
    """Return all relevant overworld markers with their unlock state."""
    state = progression_state(save)
    active = set(state["activeQuests"])
    completed = set(state["completedQuests"])
    unlocked_types = set(state["unlockedPoiTypes"])
    unlocked_logs = set(state["unlockedLogs"])
    tiles = _poi_tile_uuids(game_dir, tile_index)
    unlocked_quests = active | completed
    found = []
    uids = cell_data.get("uid", {})
    xo = cell_data.get("xOffset", {})
    yo = cell_data.get("yOffset", {})
    rotations = cell_data.get("rotation", {})
    seen = set()
    for poi_type, variants in tiles.items():
        for cy, row in uids.items():
            for cx, uid in row.items():
                tile = variants.get(str(uid))
                if tile is None:
                    continue
                rotation = int(rotations.get(cy, {}).get(cx, 0) or 0) & 3
                origin_x, origin_y = _tile_origin(
                    cx, cy, rotation,
                    int(xo.get(cy, {}).get(cx, 0) or 0),
                    int(yo.get(cy, {}).get(cx, 0) or 0))
                placement = (poi_type, str(uid), origin_x, origin_y, rotation)
                if placement in seen:
                    continue
                seen.add(placement)
                for label, category, quest in presentations(poi_type):
                    quest_unlocked = bool(quest and quest in unlocked_quests)
                    place_unlocked = (poi_type in unlocked_types
                                      or POI_LOGS.get(poi_type) in unlocked_logs)
                    unlocked = (quest_unlocked if category in
                                ("main_quest", "side_quest") else
                                place_unlocked or quest_unlocked)
                    # The starting crash site is known before any quest storage
                    # is created; it is the one safe unconditional marker.
                    if poi_type == 101 and category == "location":
                        unlocked = True
                    local = _presentation_point(tile, poi_type, category, quest)
                    if local is None:
                        local = (max(tile.cells_x, 1) * 32.0,
                                 max(tile.cells_y, 1) * 32.0)
                    world_x, world_y = _world_point(
                        origin_x, origin_y, rotation, *local)
                    found.append({
                        "poi_type": poi_type,
                        "label": label,
                        "category": category,
                        "color": marker_color(poi_type, category),
                        "quest": quest,
                        "detail": marker_detail(poi_type, category, quest),
                        "unlocked": bool(unlocked),
                        "x": world_x,
                        "y": world_y,
                    })
    feature_definitions = {}
    for cy, row in uids.items():
        for cx, uid in row.items():
            definitions = [
                {
                    "poi_type": 0,
                    "label": label,
                    "category": category,
                    "feature_type": None,
                    "color": marker_color(0, category),
                    "quest": quest,
                    "detail": detail,
                    "local_x": local_x,
                    "local_y": local_y,
                }
                for label, category, quest, detail, local_x, local_y
                in OVERWORLD_TILE_MARKERS.get(str(uid).lower(), ())
            ]
            tile = getattr(tile_index, "by_uuid", {}).get(str(uid))
            if tile is not None:
                if str(uid) not in feature_definitions:
                    feature_definitions[str(uid)] = tile_feature_markers(tile)
                definitions.extend(feature_definitions[str(uid)])
            if not definitions:
                continue
            rotation = int(rotations.get(cy, {}).get(cx, 0) or 0) & 3
            origin_x, origin_y = _tile_origin(
                cx, cy, rotation,
                int(xo.get(cy, {}).get(cx, 0) or 0),
                int(yo.get(cy, {}).get(cx, 0) or 0))
            placement = (0, str(uid), origin_x, origin_y, rotation)
            if placement in seen:
                continue
            seen.add(placement)
            for definition in definitions:
                world_x, world_y = _world_point(
                    origin_x, origin_y, rotation,
                    definition["local_x"], definition["local_y"])
                found.append({
                    "poi_type": definition["poi_type"],
                    "label": definition["label"],
                    "category": definition["category"],
                    "feature_type": definition["feature_type"],
                    "color": definition["color"],
                    "quest": definition["quest"],
                    "detail": definition["detail"],
                    "unlocked": (definition["category"] == "world_feature"
                                 or definition["quest"] in unlocked_quests),
                    "x": world_x,
                    "y": world_y,
                })
    found.sort(key=lambda p: (p["category"], p["label"], p["x"], p["y"]))
    return found
