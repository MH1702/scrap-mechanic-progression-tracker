import unittest

from progression_tracker.web_atlas import pack_rectangles


class AtlasPackingTests(unittest.TestCase):
    def test_packing_is_deterministic_and_non_overlapping(self):
        items = [("small", 6, 6), ("wide", 12, 4), ("tall", 4, 12)]
        pages, placed = pack_rectangles(items, page_size=20, padding=1)
        again = pack_rectangles(reversed(items), page_size=20, padding=1)
        self.assertEqual((pages, placed), again)

        rects = []
        for key, (page, x, y, w, h) in placed.items():
            self.assertGreaterEqual(x, 1)
            self.assertGreaterEqual(y, 1)
            self.assertLessEqual(x + w + 1, 20)
            self.assertLessEqual(y + h + 1, 20)
            rects.append((key, page, x - 1, y - 1, x + w + 1, y + h + 1))
        for i, a in enumerate(rects):
            for b in rects[i + 1:]:
                overlap = (a[1] == b[1] and a[2] < b[4] and b[2] < a[4]
                           and a[3] < b[5] and b[3] < a[5])
                self.assertFalse(overlap, "%s overlaps %s" % (a[0], b[0]))

    def test_rejects_a_tile_larger_than_page(self):
        with self.assertRaises(ValueError):
            pack_rectangles([("huge", 20, 20)], page_size=20, padding=1)


if __name__ == "__main__":
    unittest.main()
