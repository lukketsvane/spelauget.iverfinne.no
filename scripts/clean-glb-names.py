"""Batch-rename `tripo_node_<uuid>` and similar auto-generated mesh
/object names inside the game's GLB files so the asset library is
readable in Blender's outliner.

Source GLBs are loaded one at a time, every object / mesh /
armature / material with a default-junk name is renamed to a clean
prefix derived from the file's basename, then the file is re-exported
in place.

Two ways to run:

  1. From Blender's GUI: open the Scripting workspace → open this
     file → Run Script. It uses `bpy.context` of the running Blender
     so any unsaved work is preserved (the script swaps to a fresh
     read_homefile internally).

  2. From the command line (headless):
       blender --background --python scripts/clean-glb-names.py
     This is the safest way for a batch run; no interactive Blender
     is touched.

ROOT can be overridden with the SPELAUGET_ROOT env var. By default it
points at the repo's `public/` folder, processing every .glb under
`models/` and `flisverden/` recursively.

The script writes a one-line summary per GLB and a final tally. It
prints '[skipped]' for GLBs that had no junk names (no work needed).
Run it again at any time — it's idempotent.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Iterable

import bpy  # type: ignore  # only available inside Blender


# Names that look auto-generated and should be replaced. Matches
# Tripo's `tripo_node_<uuid>`, Blender's default `Mesh.001` /
# `Cube.001`, generic `Object` / `Empty` / `Untitled`, etc.
JUNK_PATTERNS = (
    re.compile(r'^tripo[_\.].*', re.IGNORECASE),
    re.compile(r'^Mesh(\.\d{3,})?$'),
    re.compile(r'^Cube(\.\d{3,})?$'),
    re.compile(r'^Object(\.\d{3,})?$'),
    re.compile(r'^Empty(\.\d{3,})?$'),
    re.compile(r'^Untitled.*'),
    re.compile(r'^Geometry(\.\d{3,})?$'),
    re.compile(r'^Plane(\.\d{3,})?$'),
    re.compile(r'^Material(\.\d{3,})?$'),
    re.compile(r'^Armature(\.\d{3,})?$'),
)


def _is_junk(name: str) -> bool:
    return any(p.match(name) for p in JUNK_PATTERNS)


def _clean_prefix(glb_path: Path) -> str:
    """Filename without extension, used as the rename prefix."""
    return glb_path.stem


def _rename_collection(coll: Iterable, prefix: str, what: str) -> int:
    """Rename every junk-named item to `prefix`/`prefix.001`/…"""
    n = 0
    counter = 0
    for item in list(coll):
        if not _is_junk(item.name):
            continue
        new_name = prefix if counter == 0 else f"{prefix}.{counter:03d}"
        # Skip if the target name is already taken by a different item
        while new_name in coll and coll.get(new_name) is not item:
            counter += 1
            new_name = f"{prefix}.{counter:03d}"
        item.name = new_name
        counter += 1
        n += 1
    if n:
        print(f"      renamed {n} {what}")
    return n


def _process_glb(glb_path: Path) -> tuple[bool, int]:
    """Open *glb_path*, rename junk-named blocks, re-export over it.
    Returns (changed, count) — changed=False means nothing to do."""
    # Clear current scene so we start clean for every GLB.
    bpy.ops.wm.read_homefile(use_empty=True)

    print(f"  loading {glb_path.name} …")
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    prefix = _clean_prefix(glb_path)
    total = 0
    total += _rename_collection(bpy.data.objects, prefix, "objects")
    total += _rename_collection(bpy.data.meshes, prefix, "meshes")
    total += _rename_collection(bpy.data.armatures, prefix, "armatures")
    total += _rename_collection(bpy.data.materials, prefix, "materials")

    if total == 0:
        print("      [skipped] no junk names")
        return False, 0

    # Re-select everything so glTF export catches all roots, then write
    # over the source file. `use_selection=False` (the default) exports
    # the whole scene — what we want.
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=False,
    )
    print(f"      exported → {glb_path.name}")
    return True, total


def main() -> int:
    root_env = os.environ.get('SPELAUGET_ROOT')
    if root_env:
        root = Path(root_env)
    else:
        # Default: repo's public/ — relative to this script's parent.
        script = Path(__file__).resolve()
        root = script.parent.parent / 'public'

    if not root.exists():
        print(f"ERROR: public root not found: {root}", file=sys.stderr)
        return 1

    targets = sorted(root.glob('**/*.glb'))
    if not targets:
        print(f"No .glb files under {root}")
        return 0

    print(f"Cleaning {len(targets)} GLB files under {root}\n")
    changed = 0
    renamed = 0
    for glb in targets:
        c, n = _process_glb(glb)
        if c:
            changed += 1
            renamed += n

    print(f"\nDone. {changed}/{len(targets)} files modified, "
          f"{renamed} names cleaned.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
