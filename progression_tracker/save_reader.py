"""Read-only ScrapMap save adapter with player and overworld identification."""

import math
import re
import struct

from smmap import lz4, smlua
from smmap.bitreader import BitReader
from smmap.savefile import SaveFile as ScrapMapSaveFile
from smmap.savefile import _parse_envelope, unpack_blob


PLAYER_RECORD_UID = bytes.fromhex("58a346010876f0b8984856f7e27fce67")[::-1]
BEACON_STORAGE_KEY = bytes.fromhex("4c5541000000010823")
BEACON_COLORS = (
    "#4f6cff", "#af7dff", "#00ffff", "#90ff78",
    "#ffd046", "#ffffc0", "#ff6619", "#ff3737",
)

UD_VEC3 = 10003
UD_SHAPE = 10021
UD_WORLD = 10027


class SaveFile(ScrapMapSaveFile):
    """Extend pristine ScrapMap parsing without modifying the vendored source."""

    def __init__(self, path):
        super().__init__(path)
        self.con.execute("PRAGMA query_only=ON")
        self._cell_cache = False
        self._overworld_id = None
        self._player_cache = None
        self._beacon_cache = None

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
                player["label"] = "You"
            else:
                player["label"] = "Guest %d" % player["player_id"]

    def beacons(self, world_id=None):
        """Return placed in-game Beacons from storage channel 35.

        BeaconManager saves positions and icon choices independently of the
        physical creation, which also preserves unloaded Beacons. The channel
        contains engine references, so it uses the narrow decoder below rather
        than relaxing the general ScrapMap Lua decoder.
        """
        if self._beacon_cache is None:
            found = []
            if "ScriptData" in self._tables:
                rows = self.con.execute(
                    "SELECT data FROM ScriptData WHERE key=?",
                    (BEACON_STORAGE_KEY,),
                )
                for (blob,) in rows:
                    raw = unpack_blob(blob)
                    if not raw or raw[:3] != smlua.MAGIC:
                        continue
                    try:
                        value = _loads_beacon_storage(raw)
                    except Exception:
                        continue
                    records = value.get("beacons") if isinstance(value, dict) else None
                    if not isinstance(records, dict):
                        continue
                    for record_id, record in records.items():
                        beacon = _decode_beacon(record_id, record)
                        if beacon is not None:
                            found.append(beacon)
            found.sort(key=lambda beacon: beacon["id"])
            for index, beacon in enumerate(found, 1):
                beacon["label"] = "Beacon %d" % index
            self._beacon_cache = found
        beacons = self._beacon_cache
        if world_id is not None:
            beacons = [beacon for beacon in beacons
                       if beacon["world_id"] == world_id]
        return [dict(beacon) for beacon in beacons]


def _loads_beacon_storage(data):
    """Decode Lua values plus the three engine userdata types Beacons save."""
    if data[:3] != smlua.MAGIC:
        raise ValueError("not a LUA blob")
    return _beacon_value(BitReader(data, 7 * 8))


def _beacon_value(reader):
    tag = reader.u8()
    if tag == smlua.T_TABLE:
        count = reader.u32()
        if reader.bit():
            start = reader.i32()
            return {start + i: _beacon_value(reader) for i in range(count)}
        return {_beacon_value(reader): _beacon_value(reader)
                for _ in range(count)}
    if tag == smlua.T_INT8:
        return reader.i8()
    if tag == smlua.T_INT16:
        return reader.i16()
    if tag == smlua.T_INT32:
        return reader.i32()
    if tag == smlua.T_STRING:
        length = reader.u32()
        reader.align()
        return reader.bytes(length).decode("utf-8", "replace")
    if tag == smlua.T_BOOL:
        return bool(reader.bit())
    if tag == smlua.T_NIL:
        return None
    if tag == smlua.T_FLOAT:
        return reader.f32()
    if tag == smlua.T_DOUBLE:
        return reader.f64()
    if tag == smlua.T_USERDATA:
        kind = reader.u32()
        if kind == smlua.UD_UUID:
            return str(smlua.Uuid(reader.bytes(16)[::-1]))
        if kind == UD_VEC3:
            return (reader.f32(), reader.f32(), reader.f32())
        if kind in (UD_SHAPE, UD_WORLD):
            return (kind, reader.u32())
        raise smlua.UnknownTag(0x64000000 | kind, reader.pos - 40)
    raise smlua.UnknownTag(tag, reader.pos - 8)


def _decode_beacon(record_id, record):
    if not isinstance(record, dict):
        return None
    position = record.get("position")
    world = record.get("world")
    icon = record.get("iconData")
    if (not isinstance(position, tuple) or len(position) != 3
            or not isinstance(world, tuple) or len(world) != 2
            or world[0] != UD_WORLD or not isinstance(icon, dict)):
        return None
    try:
        beacon_id = int(record_id)
        world_id = int(world[1])
        icon_index = int(icon.get("iconIndex"))
        color_index = int(icon.get("colorIndex"))
        x, y, z = (float(value) for value in position)
    except (TypeError, ValueError, OverflowError):
        return None
    if (beacon_id <= 0 or world_id <= 0
            or not all(math.isfinite(value) for value in (x, y, z))):
        return None
    color = (BEACON_COLORS[color_index - 1]
             if 1 <= color_index <= len(BEACON_COLORS) else "#4f6cff")
    return {
        "id": beacon_id,
        "world_id": world_id,
        "label": "Beacon",
        "x": x,
        "y": y,
        "z": z,
        "icon_index": icon_index,
        "color_index": color_index,
        "color": color,
    }


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
