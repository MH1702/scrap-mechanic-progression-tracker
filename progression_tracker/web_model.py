"""Small JSON boundary between the save decoder and the browser UI."""

import json

from smmap.smlua import Uuid

from .save_reader import SaveFile
from .locations import progression_state


def decode(path):
    """Decode the browser's temporary save copy into a compact map model."""
    with SaveFile(path) as save:
        cell_data = save.cell_data()
        if cell_data is None:
            raise ValueError("This save has no overworld terrain data.")
        world_id = save.overworld_id()
        players = save.players(world_id=world_id)
        info = save.game_info()
        progression = progression_state(save)

    bounds = {k: int(cell_data["bounds"][k])
              for k in ("xMin", "xMax", "yMin", "yMax")}
    uid_rows = cell_data.get("uid") or {}
    rotation = cell_data.get("rotation") or {}
    x_offset = cell_data.get("xOffset") or {}
    y_offset = cell_data.get("yOffset") or {}
    cells = []
    for y in range(bounds["yMin"], bounds["yMax"] + 1):
        urow = uid_rows.get(y) or {}
        rrow = rotation.get(y) or {}
        xrow = x_offset.get(y) or {}
        yrow = y_offset.get(y) or {}
        for x in range(bounds["xMin"], bounds["xMax"] + 1):
            uid = urow.get(x)
            if not isinstance(uid, Uuid) or uid.is_nil():
                continue
            cells.append([x, y, str(uid), int(rrow.get(x, 0) or 0) & 3,
                          int(xrow.get(x, 0) or 0), int(yrow.get(x, 0) or 0)])

    # A browser upload has no User_<steamid> parent folder from which the
    # desktop decoder can identify the local account. Player 1 is the host in
    # the game's stable player index; retain Guest N for all other records.
    for player in players:
        player["label"] = ("You" if player["player_id"] == 1
                           else "Guest %d" % player["player_id"])
        # Steam IDs exceed JavaScript's safe integer range. Keep them lossless
        # so the browser can use the host ID to validate account unlock files.
        player["steam_id"] = (str(player["steam_id"])
                              if player.get("steam_id") is not None else None)

    return {
        "bounds": bounds,
        "seed": cell_data.get("seed"),
        "cells": cells,
        "players": players,
        "progression": progression,
        "game": {"gametick": info.get("gametick")},
    }


def decode_json(path):
    return json.dumps(decode(path), separators=(",", ":"))
