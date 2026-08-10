# Updating the ScrapMap dependency

ScrapMap is pinned as a pristine source dependency in `vendor/scrapmap` at
commit `349d6ebc329b781427ec3ad988fc9e33f71bc51d` (version 2.0).

Application-specific behavior belongs in `progression_tracker`, never in the
vendored directory. `save_reader.py` adds the strictly read-only save access
used by the app, while `tile_renderer.py` adapts the upstream renderer for the
flat atlas.

To update the dependency:

1. Review the desired upstream ScrapMap commit and its license.
2. Replace `vendor/scrapmap` with a clean `git archive` of that commit.
3. Update the pin in this file and `THIRD_PARTY_NOTICES.md`.
4. Reconcile only the adapters in `progression_tracker`.
5. Run the Python tests, TypeScript check, production build, and read-only save
   integrity check before committing.

Do not copy Git metadata or a developer save into the vendor directory.
