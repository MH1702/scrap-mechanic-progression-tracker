# Scrap Mechanic Progression Tracker & Map Viewer

An interactive browser map and progression companion for Scrap Mechanic
survival saves. Drop a save into the page to render its overworld, players,
locations, quests, growlabs, and your own custom markers.

**Live tool:** https://mh1702.github.io/scrap-mechanic-progression-tracker/

This is an unofficial, fan-made tool and is not affiliated with or endorsed by
Axolot Games. Scrap Mechanic and related marks belong to their respective
owners.

## Save safety and privacy

Scrap Mechanic save files are inputs only. The parser opens its temporary copy
in SQLite read-only/query-only mode and never writes to the original save.
Preferences and custom markers are stored separately in browser local storage.
The static site does not upload the save to a server; decoding happens in a
Web Worker in the browser.

Local developer saves are configured only through ignored `.env.local` files.
Database files and generated parser bundles are also ignored by Git.

## Local development

Requirements: Node.js 24 or later and Python 3.

```text
npm ci
npm run dev
```

Vite provides hot module replacement. To auto-load a development save, create
`web/.env.local` containing:

```text
SMPT_DEV_SAVE=C:/absolute/path/to/your/save.db
```

The development server streams that file read-only into the same in-browser
temporary copy used by drag and drop.

Useful checks:

```text
python -m unittest discover -s tests -v
npm run typecheck
npm run build
```

## Dependency and licensing

The project vendors an unmodified, pinned ScrapMap 2.0 snapshot as a source
dependency under `vendor/scrapmap`. See `THIRD_PARTY_NOTICES.md` and
`UPSTREAM.md` for attribution, the exact commit, and the update process.

The original project code is MIT licensed. Vendored code and game-derived
material retain their own licensing and ownership.
