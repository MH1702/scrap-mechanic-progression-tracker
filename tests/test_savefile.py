import hashlib
import os
import sqlite3
import struct
import tempfile
import unittest
from pathlib import Path

from progression_tracker.save_reader import (
    UD_VEC3,
    UD_WORLD,
    SaveFile,
    _decode_beacon,
    _decode_player_record,
    _decode_warehouse,
)


class ReadOnlySaveTests(unittest.TestCase):
    def test_save_connection_rejects_writes_and_leaves_file_unchanged(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "world.db")
            con = sqlite3.connect(path)
            con.execute("CREATE TABLE Game(savegameversion INTEGER)")
            con.execute("INSERT INTO Game VALUES (28)")
            con.commit()
            con.close()

            before = hashlib.sha256(Path(path).read_bytes()).digest()
            with SaveFile(path) as save:
                self.assertEqual(save.game_info()["savegameversion"], 28)
                with self.assertRaises(sqlite3.OperationalError):
                    save.con.execute("CREATE TABLE forbidden(value INTEGER)")
            after = hashlib.sha256(Path(path).read_bytes()).digest()

            self.assertEqual(before, after)
            con = sqlite3.connect(path)
            tables = {row[0] for row in con.execute(
                "SELECT name FROM sqlite_master WHERE type='table'")}
            con.close()
            self.assertNotIn("forbidden", tables)


class PlayerRecordTests(unittest.TestCase):
    def test_decodes_world_position_player_id_and_steam_id(self):
        steam_id = 12345678901234567
        raw = bytearray(66)
        # Save vectors are serialized Z, Y, X rather than X, Y, Z.
        struct.pack_into(">Hfff", raw, 0, 1, 22.5, 1732.75, -20.25)
        struct.pack_into(">Q", raw, 46, steam_id)
        env = {"key": struct.pack("<I", 3)}

        player = _decode_player_record(env, bytes(raw))

        self.assertEqual(player["world_id"], 1)
        self.assertEqual(player["player_id"], 3)
        self.assertEqual(player["steam_id"], steam_id)
        self.assertAlmostEqual(player["x"], -20.25)
        self.assertAlmostEqual(player["y"], 1732.75)
        self.assertAlmostEqual(player["z"], 22.5)

    def test_rejects_invalid_or_non_player_records(self):
        self.assertIsNone(_decode_player_record({"key": b""}, b"short"))
        raw = struct.pack(">Hfff", 1, 0.0, 0.0, 0.0)
        self.assertIsNone(_decode_player_record({"key": b""}, raw))

    def test_labels_local_host_and_multiplayer_guest_offline(self):
        save = SaveFile.__new__(SaveFile)
        save.path = (r"C:\Users\Example\AppData\Roaming\Axolot Games\Scrap Mechanic"
                     r"\User\User_12345678901234567\Save\Survival\Example.db")
        players = [
            {"player_id": 1, "steam_id": 12345678901234567},
            {"player_id": 7, "steam_id": 76561199000000000},
        ]

        save._label_players(players)

        self.assertEqual(players[0]["label"], "You")
        self.assertEqual(players[1]["label"], "Guest 7")


class BeaconRecordTests(unittest.TestCase):
    def test_decodes_position_icon_and_ingame_color(self):
        beacon = _decode_beacon("3683", {
            "world": (UD_WORLD, 1),
            "position": (92.375, -2187.75, 20.5),
            "iconData": {"iconIndex": 19, "colorIndex": 3},
        })

        self.assertEqual(beacon["id"], 3683)
        self.assertEqual(beacon["world_id"], 1)
        self.assertEqual(beacon["color"], "#00ffff")
        self.assertEqual(beacon["icon_index"], 19)
        self.assertEqual((beacon["x"], beacon["y"], beacon["z"]),
                         (92.375, -2187.75, 20.5))

    def test_rejects_malformed_or_non_world_beacons(self):
        self.assertIsNone(_decode_beacon("1", {}))
        self.assertIsNone(_decode_beacon("1", {
            "world": (UD_VEC3, 1),
            "position": (0.0, 0.0, 0.0),
            "iconData": {"iconIndex": 1, "colorIndex": 1},
        }))


class WarehouseRecordTests(unittest.TestCase):
    def test_decodes_exploded_warehouse_at_its_zero_cell(self):
        warehouse = _decode_warehouse({
            "index": 4,
            "world": (UD_WORLD, 1),
            "zeroCell": {"x": 51, "y": -18},
            "maxLevels": 4,
            "destroyed": True,
            "consoleDestroyed": True,
            "isQuestWarehouse": False,
        })

        self.assertEqual(warehouse["index"], 4)
        self.assertEqual(
            (warehouse["zero_cell_x"], warehouse["zero_cell_y"]),
            (51, -18),
        )
        self.assertTrue(warehouse["destroyed"])
        self.assertTrue(warehouse["console_destroyed"])
        self.assertFalse(warehouse["is_quest_warehouse"])

    def test_rejects_warehouse_without_stable_position(self):
        self.assertIsNone(_decode_warehouse({
            "index": 1,
            "world": (UD_WORLD, 1),
            "maxLevels": 2,
        }))


if __name__ == "__main__":
    unittest.main()
