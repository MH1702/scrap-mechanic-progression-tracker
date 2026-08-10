"""Application-owned integration layer for Scrap Mechanic Progression Tracker."""

import os
import sys


__version__ = "0.1.0"

# ScrapMap is vendored as an unmodified, pinned source dependency.  Make its
# package importable for local tools and tests; the Pyodide bundle places the
# same ``smmap`` package directly at its archive root.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VENDOR_ROOT = os.path.join(_PROJECT_ROOT, "vendor", "scrapmap")
if os.path.isdir(_VENDOR_ROOT) and _VENDOR_ROOT not in sys.path:
    sys.path.insert(0, _VENDOR_ROOT)
