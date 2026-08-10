"""Read-only ScrapMap save adapter with player and overworld identification."""

import math
import re
import struct

from smmap import lz4, smlua
from smmap.savefile import SaveFile as ScrapMapSaveFile
from smmap.savefile import _parse_envelope, unpack_blob


PLAYER_RECORD_UID = bytes.fromhex("58a346010876f0b8984856f7e27fce67")[::-1]


class SaveFile(ScrapMapSaveFile):
    """Extend pristine ScrapMap parsing without modifying the vendored source."""

    def __init__(self, path):
        super().__init__(path)
        self.con.execute("PRAGMA query_only=ON")
        self._cell_cache = False
        self._overworld_id = None
        self._player_cache = None

    def cell_data(self):
        """Return overworld terrain and retain the database world identifier."""
        if self._cell_cache is not False:
            return self._cell_cache
        self._cell_cache = None
        for table in ("ScriptData", "GenericData"):
            if table not in self._tables:
                continue
            rows = self.con.execute(
                "SELECT data FROM %s ORDER BY length(data) DESC" % table)
            for (blob,) in rows:
                if blob is None or len(blob) < 512:
                    continue
                raw = unpack_blob(blob)
                if not raw or raw[:3] != smlua.MAGIC:
                    continue
                try:
                    value = smlua.loads(raw)
                except Exception:
                    continue
                if isinstance(value, dict) and "uid" in value and "bounds" in value:
                    envelope = _parse_envelope(blob)
                    self._overworld_id = envelope["worldId"] if envelope else None
                    self._cell_cache = value
                    return value
        return None

    def overworld_id(self):
        self.cell_data()
        return self._overworld_id

    def players(self, world_id=None):
        if self._player_cache is None:
            found = []
            if "GenericData" in self._tables:
                for (blob,) in self.con.execute("SELECT data FROM GenericData"):
                    envelope = _parse_envelope(blob)
                    if envelope is None or envelope["uid"] != PLAYER_RECORD_UID:
                        continue
                    try:
                        raw = lz4.decompress(envelope["payload"])
                    except Exception:
                        continue
                    player = _decode_player_record(envelope, raw)
                    if player is not None:
                        found.append(player)
            found.sort(key=lambda player: (
                player["player_id"], player.get("steam_id") or 0,
            ))
            self._label_players(found)
            self._player_cache = found
        players = self._player_cache
        if world_id is not None:
            players = [player for player in players if player["world_id"] == world_id]
        return [dict(player) for player in players]

    def _label_players(self, players):
        match = re.search(
            r"(?:^|[\\/])User_(\d+)(?:[\\/]|$)",
            self.path,
            flags=re.IGNORECASE,
        )
        local_steam_id = int(match.group(1)) if match else None
        for player in players:
            if local_steam_id and player.get("steam_id") == local_steam_id:
                player["label"] = "Host"
            else:
                player["label"] = "Guest %d" % player["player_id"]


def _decode_player_record(envelope, raw):
    if len(raw) < 14:
        return None
    try:
        world_id, z, y, x = struct.unpack_from(">Hfff", raw, 0)
    except struct.error:
        return None
    if not all(math.isfinite(value) for value in (x, y, z)):
        return None
    key = envelope.get("key", b"")
    player_id = (
        struct.unpack("<I", key)[0]
        if len(key) == 4
        else int.from_bytes(key, "little") if key else 0
    )
    if player_id <= 0:
        return None
    steam_id = None
    if len(raw) >= 62:
        candidate = struct.unpack_from(">Q", raw, 46)[0]
        if 0 < candidate < (1 << 63):
            steam_id = candidate
    return {
        "player_id": player_id,
        "steam_id": steam_id,
        "world_id": world_id,
        "x": x,
        "y": y,
        "z": z,
    }
