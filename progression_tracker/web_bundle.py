"""Package the pure-Python browser save decoder for a static deployment."""

import argparse
import os
import zipfile


UPSTREAM_MODULES = (
    "__init__.py", "bitreader.py", "lz4.py", "savefile.py", "smlua.py",
)
APP_MODULES = (
    "__init__.py", "locations.py", "save_reader.py", "web_model.py",
)


def build(path):
    source = os.path.dirname(__file__)
    upstream = os.path.join(os.path.dirname(source), "vendor", "scrapmap", "smmap")
    parent = os.path.dirname(os.path.abspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    temp = os.path.abspath(path) + ".tmp"
    with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9) as archive:
        for name in UPSTREAM_MODULES:
            archive.write(os.path.join(upstream, name), "smmap/" + name)
        for name in APP_MODULES:
            archive.write(
                os.path.join(source, name),
                "progression_tracker/" + name,
            )
    os.replace(temp, path)
    return path


def main(argv=None):
    parser = argparse.ArgumentParser(description="Build the Pyodide parser bundle")
    parser.add_argument(
        "--out",
        default=os.path.join("web", "python", "progression-tracker.zip"),
    )
    args = parser.parse_args(argv)
    path = build(args.out)
    print(os.path.abspath(path), os.path.getsize(path), "bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
