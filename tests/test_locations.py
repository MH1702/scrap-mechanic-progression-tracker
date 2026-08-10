import unittest
import json
from unittest import mock

from progression_tracker import locations


class Tile(object):
    cells_x = 4
    cells_y = 4
    tileson = "does-not-exist.tileson"


class LocationTests(unittest.TestCase):
    def test_repeatable_tile_features_use_actionable_prefab_anchors(self):
        tile = Tile()
        tile.name = "Warehouse_Exterior_3Floors_256_01_NEW"
        tile_json = json.dumps({"entities": {"prefabs": [
            {
                "path": "$SURVIVAL_DATA/LocalPrefabs/Warehouse_Elevator_Exterior_01.prefab",
                "tags": ["EXIT"],
                "transform": {"position": [10, 20, 100]},
            },
            {
                "path": "$SURVIVAL_DATA/LocalPrefabs/Warehouse_Elevator_Exterior_01.prefab",
                "tags": ["ENTRANCE"],
                "transform": {"position": [30, 40, 0]},
            },
        ]}})
        with mock.patch("builtins.open", mock.mock_open(read_data=tile_json)):
            marker = locations.tile_feature_markers(tile)[0]
        self.assertEqual(marker["feature_type"], "warehouse")
        self.assertEqual(marker["detail"], "3 levels")
        self.assertEqual((marker["local_x"], marker["local_y"]), (30.0, 40.0))

        tile.name = "SchematicStation_Forest_64_01"
        tile_json = json.dumps({"entities": {"prefabs": [{
            "path": "$SURVIVAL_DATA/LocalPrefabs/gameplay_prefabs/ap_partunlockstation_01.prefab",
            "transform": {"position": [31.5, 50.75, 0.5]},
        }]}})
        with mock.patch("builtins.open", mock.mock_open(read_data=tile_json)):
            marker = locations.tile_feature_markers(tile)[0]
        self.assertEqual(marker["feature_type"], "schematic_bot")
        self.assertEqual((marker["local_x"], marker["local_y"]), (31.5, 50.75))

    def test_repeatable_resource_tiles_are_classified_without_poi_ids(self):
        tile = Tile()
        tile.name = "ChemicalLake_128_02"
        with mock.patch("progression_tracker.locations._prefab_points",
                        return_value=((12.0, 34.0),)):
            chemical = locations.tile_feature_markers(tile)[0]
        tile.name = "OilPool_Desert_64_01"
        with mock.patch("progression_tracker.locations._prefab_points",
                        side_effect=((), ((24.0, 26.0),))):
            oil = locations.tile_feature_markers(tile)[0]
        self.assertEqual(
            (chemical["poi_type"], chemical["category"],
             chemical["feature_type"], chemical["label"]),
            (0, "world_feature", "chemical_pond", "Chemical Pond"),
        )
        self.assertEqual(oil["feature_type"], "oil_pond")
        with mock.patch("progression_tracker.locations._prefab_points",
                        return_value=()):
            self.assertEqual(locations.tile_feature_markers(
                type("OtherTile", (), {"name": "Forest_64_01"})()), ())

    def test_resource_tile_emits_every_embedded_source(self):
        tile = Tile()
        tile.name = "SiloDistrict_512_01"
        with mock.patch("progression_tracker.locations._prefab_points",
                        return_value=((256.0, 224.0), (260.0, 228.0))):
            markers = locations.tile_feature_markers(tile)
        self.assertEqual(len(markers), 2)
        self.assertEqual(
            [(marker["local_x"], marker["local_y"]) for marker in markers],
            [(256.0, 224.0), (260.0, 228.0)],
        )

    def test_story_warehouse_is_distinguished_from_generic_four_level(self):
        tile = Tile()
        tile.name = "Warehouse_Exterior_4Floors_256_Quest"
        with mock.patch("progression_tracker.locations._prefab_points",
                        return_value=()), mock.patch(
                            "progression_tracker.locations._prefab_point",
                            return_value=(128.0, 64.0)):
            marker = locations.tile_feature_markers(tile)[0]
        self.assertEqual(marker["label"], "Trashbot/Story Warehouse")
        self.assertEqual(marker["detail"], "4 levels · Trashbot arena")

    def test_recipe_manager_channel_is_authoritative_and_normalized(self):
        connection = mock.Mock()
        connection.execute.return_value = [(b"recipe-manager",)]
        save = mock.Mock(_tables={"ScriptData"}, con=connection)
        decoded = {
            "unlockedRecipes": {
                "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA": True,
                "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb": False,
                123: True,
            },
        }
        with mock.patch("progression_tracker.locations.unpack_blob",
                        return_value=b"LUA recipe data"), mock.patch(
                            "progression_tracker.locations.smlua.loads",
                            return_value=decoded):
            self.assertEqual(locations._unlocked_recipes(save), {
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            })
        connection.execute.assert_called_once_with(
            "SELECT data FROM ScriptData WHERE key=?",
            (locations.RECIPE_STORAGE_KEY,),
        )

    def test_growlabs_use_game_numbering_including_ruin_city(self):
        expected = [137, 304, 507, 206, 103, 803, 104]
        self.assertEqual([locations.POIS[p][0] for p in expected],
                         ["Growlab %d" % n for n in range(1, 8)])
        self.assertEqual(locations.POIS[104][1], "growlab")

    def test_ship_name_and_first_station_dual_presentation(self):
        self.assertEqual(locations.POIS[105][0], "Lorenzo's Ship")
        self.assertEqual(locations.POIS[105][2], "quest_endgame")
        self.assertEqual(locations.POIS[101][0], "Crashed Ship")
        self.assertEqual(locations.presentations(124), (
            ("The Mechanic Station", "main_quest", "quest_mechanicstation"),
            ("Mechanic Station 1", "location", "quest_mechanicstation"),
        ))
        self.assertEqual(locations.presentations(109), (
            ("Mechanic Station 2", "location", "quest_tutorial"),
        ))

    def test_quests_use_english_localized_titles(self):
        expected = {
            "quest_mystery_call": "A Stranger in Need",
            "quest_clear_warehouse": "The Warehouse",
            "quest_mechanicstation": "The Mechanic Station",
            "quest_build_first_car": "Your First Car",
            "quest_build_advanced_car": "Your Nice Car",
            "quest_build_harvest_car": "Your Work Car",
            "quest_build_wochouse": "Home is Where the Woc Is",
            "quest_build_cardboardpoop": "Cardboard Munchies",
            "quest_build_bigfan": "If You Can't Take the Heat…",
            "quest_build_musicbox": "Itty Bitty Ditty",
        }
        for label, category, quest in locations.POIS.values():
            if quest in expected and category in ("main_quest", "side_quest"):
                self.assertEqual(label, expected[quest])
        self.assertEqual(
            locations.marker_detail(107, "main_quest", "quest_find_recording"),
            "Burial Site",
        )
        self.assertEqual(
            locations.marker_detail(604, "main_quest", "quest_mystery_call"),
            "Autumn Ruins",
        )

    def test_car_quests_use_their_game_registered_tiles_and_anchors(self):
        self.assertIn(
            ("Your First Car", "side_quest", "quest_build_first_car"),
            locations.presentations(101),
        )
        self.assertIn(
            ("Your Nice Car", "side_quest", "quest_build_advanced_car"),
            locations.presentations(110),
        )
        self.assertEqual(locations.POIS[125],
                         ("Your Work Car", "side_quest", "quest_build_harvest_car"))
        for (poi_type, quest), point in locations.QUEST_MARKER_POINTS.items():
            self.assertEqual(
                locations._presentation_point(
                    Tile(), poi_type, "side_quest", quest),
                point,
            )
            self.assertIn(quest, locations._KNOWN_QUESTS)

    def test_all_overworld_main_quests_are_catalogued(self):
        expected = {
            "quest_tutorial",
            "quest_mechanicstation",
            "quest_mystery_call",
            "quest_feed_the_farmers",
            "quest_clear_minidungeon",
            "quest_build_watchtower",
            "quest_find_recording",
            "quest_clear_warehouse",
            "quest_save_watchtower",
            "quest_rebuild_watchtower",
            "quest_find_excavation",
            "quest_bosstrain",
            "quest_endgame",
        }
        presentations = (
            entry
            for poi_type in set(locations.POIS) | set(locations.POI_ALIASES)
            for entry in locations.presentations(poi_type)
        )
        catalogued = {
            quest for _label, category, quest in presentations
            if category == "main_quest"
        } | {
            quest
            for definitions in locations.OVERWORLD_TILE_MARKERS.values()
            for _label, category, quest, _detail, _x, _y in definitions
            if category == "main_quest"
        }
        self.assertEqual(catalogued, expected)
        self.assertEqual(locations.POIS[107],
                         ("Lost and Found", "main_quest", "quest_find_recording"))

    def test_game_style_location_and_growlab_colours(self):
        self.assertEqual(locations.presentations(104), (
            ("Growlab 7", "growlab", None),
            ("Scrap Garage", "location", None),
        ))
        self.assertEqual(locations.POIS[110][0], "Vegetable Packing Station")
        self.assertEqual(locations.POIS[111][0], "Fruit Packing Station")
        self.assertEqual(
            [locations.marker_color(poi_type, "growlab") for poi_type in
             (137, 304, 507, 206, 103, 803, 104)],
            ["#ffd447", "#ff8a3d", "#27c7b8", "#65c96b",
             "#a970ff", "#4d9cff", "#ef5b5b"],
        )
        self.assertEqual(locations.marker_color(124, "location"), "#a970ff")
        self.assertEqual(locations.marker_color(124, "main_quest"), "#ffb52e")
        self.assertEqual(locations.marker_color(125, "side_quest"), "#63d8ff")

    def test_story_and_builder_destinations_have_distinct_categories(self):
        quest_markers = [entry for entry in locations.POIS.values()
                         if entry[1] in ("main_quest", "side_quest")]
        self.assertTrue(quest_markers)
        for _label, category, quest in quest_markers:
            expected = "side_quest" if quest.startswith("quest_build_") else "main_quest"
            self.assertEqual(category, expected)

    def test_tile_local_point_respects_all_rotated_anchor_corners(self):
        self.assertEqual(locations._world_point(10, 20, 0, 12, 34), (652, 1314))
        self.assertEqual(locations._world_point(10, 20, 1, 12, 34), (670, 1292))
        self.assertEqual(locations._world_point(10, 20, 2, 12, 34), (692, 1310))
        self.assertEqual(locations._world_point(10, 20, 3, 12, 34), (674, 1332))

    def test_tile_origin_can_be_recovered_without_an_origin_cell(self):
        self.assertEqual(locations._tile_origin(12, 23, 0, 2, 3), (10, 20))
        self.assertEqual(locations._tile_origin(7, 22, 1, 2, 3), (10, 20))
        self.assertEqual(locations._tile_origin(8, 17, 2, 2, 3), (10, 20))
        self.assertEqual(locations._tile_origin(13, 18, 3, 2, 3), (10, 20))

    def test_active_quest_engine_reference_tag_is_not_part_of_name(self):
        self.assertEqual(locations._quest_names(b"quest_endgame" + bytes([0x64])),
                         {"quest_endgame"})

    @mock.patch("progression_tracker.locations._unlocked_pois", return_value={137, 304})
    @mock.patch("progression_tracker.locations._unlocked_logs", return_value={"packing-log"})
    @mock.patch("progression_tracker.locations._unlocked_recipes",
                return_value={"recipe-b", "recipe-a"})
    @mock.patch("progression_tracker.locations._quest_state",
                return_value=({"quest_endgame"}, {"quest_tutorial"}))
    def test_progression_state_is_sorted_and_json_ready(
            self, _quests, _recipes, _logs, _pois):
        self.assertEqual(locations.progression_state(object()), {
            "activeQuests": ["quest_endgame"],
            "completedQuests": ["quest_tutorial"],
            "unlockedLogs": ["packing-log"],
            "unlockedPoiTypes": [137, 304],
            "unlockedRecipes": ["recipe-a", "recipe-b"],
        })

    @mock.patch("progression_tracker.locations._poi_tile_uuids")
    @mock.patch("progression_tracker.locations._unlocked_pois")
    @mock.patch("progression_tracker.locations._unlocked_logs", return_value=set())
    @mock.patch("progression_tracker.locations._unlocked_recipes", return_value=set())
    @mock.patch("progression_tracker.locations._quest_state")
    def test_collect_marks_progression_and_centres_multicell_tile(
            self, quest_state, _recipes, _logs, unlocked_pois, tile_uuids):
        quest_state.return_value = ({"quest_trader_tracking"}, set())
        unlocked_pois.return_value = {137}
        tile_uuids.return_value = {
            102: {"hideout": Tile()},
            137: {"growlab": Tile()},
        }
        cd = {
            "uid": {5: {3: "hideout", 8: "growlab"}},
            "xOffset": {5: {3: 0, 8: 0}},
            "yOffset": {5: {3: 0, 8: 0}},
        }
        markers = locations.collect("game", object(), cd, object())
        hideout = next(m for m in markers
                       if m["poi_type"] == 102 and m["category"] == "location")
        growlab = next(m for m in markers
                       if m["poi_type"] == 137 and m["category"] == "growlab")
        self.assertTrue(hideout["unlocked"])
        self.assertTrue(growlab["unlocked"])
        self.assertEqual((hideout["x"], hideout["y"]),
                         ((3 + 2) * 64.0, (5 + 2) * 64.0))


if __name__ == "__main__":
    unittest.main()
