# Spelauget Level Editor — Blender Addon
#
# Lets you import/edit/export the game's per-world spawn lists as
# Blender Empties. One Empty per spawn, with custom properties for
# kind-specific fields. Transforms (location, rotation Z, uniform
# scale) drive the spawn's position/rotation/scale.
#
# COORDINATE MAPPING
#   Blender X        ↔ game position[0]
#   Blender Y        ↔ game position[1]   (the floor plane)
#   Blender Z        ignored (always 0 in JSON; use it freely in
#                    Blender for visual separation if you want)
#   rotation Z (yaw) ↔ game rotation       (rad, around game Y-axis)
#   uniform scale    ↔ game scale
#
# INSTALL
#   1. Edit → Preferences → Add-ons → Install...
#   2. Pick this .py file → Enable "Spelauget Level Editor"
#   3. Open the N-panel in the 3D Viewport → "Spelauget" tab
#
# WORKFLOW
#   - Set "Project Root" to the absolute repo path (once per .blend)
#   - Pick a "World" from the dropdown
#   - "Import Level" reads spawns.json and creates an Empty per spawn
#   - Edit transforms in the viewport like normal Blender objects
#   - "Add Spawn" drops a new Empty of the chosen kind at the 3D cursor
#   - "Export Level" writes the scene back to spawns.json
#   - Run `npm run dev` (or refresh) — HMR picks up the JSON change
#     instantly so the level updates in the game on save.

bl_info = {
    "name": "Spelauget Level Editor",
    "author": "Spelauget",
    "version": (1, 0, 0),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > Spelauget",
    "description": "Edit spawn lists for spelauget.iverfinne.no game worlds.",
    "category": "Game",
}

import json
import math
from pathlib import Path

import bpy
from bpy.props import EnumProperty, StringProperty
from bpy.types import Operator, Panel

# --- spawn kinds (mirrors src/game/levels/types.ts) -----------------
# Source of truth lives in TS. Update this list whenever a new kind
# is added to the game.
KIND_ITEMS = [
    ('star_npc',                'Star NPC',                'Digger NPC with dialogue'),
    ('boble_npc',               'Boble NPC',               'Floating NPC with dialogue'),
    ('portal',                  'Portal',                  'World-to-world portal'),
    ('stone_hut',               'Stone Hut',               'Hut prop'),
    ('rock_stack',              'Rock Stack',              'Rock cairn prop'),
    ('trilo',                   'Trilo',                   'Trilo NPC prop'),
    ('relic',                   'Relic',                   'Painted-card relic'),
    ('car',                     'Car',                     'Parked car prop'),
    ('car_portal',              'Car Portal',              'Drivable car portal'),
    ('remnant',                 'Remnant',                 'Remnant card'),
    ('glowing_purple_coral',    'Coral (glowing)',         'Glowing purple coral GLB'),
    ('neon_vascular_tree',      'Vascular Tree',           'Neon vascular tree GLB'),
    ('purple_coral',            'Coral',                   'Purple coral GLB'),
    ('purple_coral_alt',        'Coral (alt)',             'Alternate purple coral GLB'),
    ('purple_stone_cairn',      'Stone Cairn',             'Purple stone cairn GLB'),
    ('tangled_root_sculpture',  'Root Sculpture',          'Tangled root sculpture GLB'),
    ('mythical_horse',          'Mythical Horse',          'Chrome horse statue'),
    ('crystal',                 'Crystal',                 'Pickup crystal'),
    ('crystal_altar',           'Crystal Altar',           'Crystal altar prop'),
    ('key',                     'Key',                     'Portal key pickup'),
    ('artifact',                'Artifact',                'Hidden artifact pickup'),
    ('flis_prop',               'Flis Prop',               'Flisverden block-out asset'),
    ('skate',                   'Skate',                   'Orbiting stingray NPC'),
    ('giantess',                'Giantess',                'Hot-pink monumental figure'),
    ('flis_pool',               'Flis Pool',               'Sunken tile pool'),
    ('flis_floor',              'Flis Floor',              'Tile floor rectangle'),
    ('blod_sprite',             'Blod Sprite',             'Painted-card sprite (Blodverden)'),
    ('kjeller_mirror',          'Kjeller Mirror',          'Perfect-mirror floor plane'),
]

# Per-kind default extra fields populated when a new spawn is added.
# These are seeds — the user edits the Empty's custom properties to
# tune the spawn. Fields not listed here can still be added manually
# via the "Add" button in the N-panel "Properties" → "Custom" subpanel.
KIND_DEFAULTS = {
    'portal':       {'targetRegion': 'blod', 'colorA': '#ffffff', 'colorB': '#000000'},
    'car_portal':   {'targetRegion': 'blod', 'gate': 'bobbleVanished'},
    'car':          {'model': 'car_01'},
    'relic':        {'texture': '/relic1 1.png', 'height': 4.0},
    'remnant':      {'texture': '/blodverden/remnant_01.png', 'height': 4.0},
    'blod_sprite':  {'texture': '/blodverden/antler-plant.png', 'height': 2.4, 'glow': 0.7, 'tint': '#ffffff'},
    'trilo':        {'color': '#a456c8', 'emissive': '#2a1140'},
    'giantess':     {'color': '#ff66aa', 'emissive': '#440022', 'emissiveIntensity': 0.6},
    'key':          {'opens': 'blod'},
    'artifact':     {'region': 'lysningen'},
    'flis_prop':    {'prop': 'vesica'},
    'skate':        {'radius': 20.0, 'height': 5.0, 'period': 30.0},
    'flis_floor':   {'width': 60.0, 'depth': 60.0, 'tileSize': 8.0},
    'kjeller_mirror':{'width': 240.0, 'depth': 240.0, 'color': '#ffffff', 'resolution': 1024},
}

WORLD_ITEMS = [
    ('hageverden',  'Hageverden',    'First world — the clearing'),
    ('blodverden',  'Blodverden',    'Second world — red field'),
    ('flisverden',  'Flisverden',    'Third world — tile pool'),
    ('saltverden',  'Saltverden',    'Fourth world — salt flat'),
    ('speilverden', 'Kjellerverden', 'Fifth world — mirror'),
]

# Per-world asset allowlist. The Add Spawn dropdown narrows to ONLY
# these kinds when the active world is set. Keeps designers from
# accidentally dropping a giantess into the salt flat. Always-allowed
# kinds (key, portal, artifact, car_portal) are added implicitly on
# top of each world's list — they tie worlds together in the chain.
WORLD_KIND_ALLOWLIST = {
    'hageverden': [
        'star_npc', 'boble_npc',
        'stone_hut', 'rock_stack', 'trilo',
        'glowing_purple_coral', 'neon_vascular_tree',
        'purple_coral', 'purple_coral_alt',
        'purple_stone_cairn', 'tangled_root_sculpture',
        'skate',
    ],
    'blodverden': [
        'blod_sprite', 'mythical_horse',
    ],
    'flisverden': [
        'flis_floor', 'flis_pool', 'flis_prop', 'giantess',
    ],
    'saltverden': [
        # Nothing world-specific yet — chain assets only.
    ],
    'speilverden': [
        'kjeller_mirror',
    ],
}

# Kinds available in every world, since they wire the world chain
# together (portals + the keys that unlock them, plus the hidden
# artifact set). Crystals + the altar are also chain mechanics so
# they can appear anywhere.
CHAIN_KINDS = [
    'key', 'portal', 'car_portal', 'car',
    'artifact', 'crystal', 'crystal_altar',
    'relic', 'remnant',
]

# World → (region_id, center XY, representative ground tint). Center
# coords mirror src/game/regions.ts; the tint is a mid-stop pick from
# each region's ground palette so the reference plane reads the same
# colour family the player will see at runtime. Pure viewport aid —
# the in-game ground is still procedural, no upload.
WORLD_REGION = {
    'hageverden':  ('lysningen', ( 0.0,  -30.0), (0.33, 0.38, 0.75)),
    'blodverden':  ('blod',      (-90.0, -50.0), (0.84, 0.20, 0.23)),
    'flisverden':  ('geometri',  (-90.0,  60.0), (0.49, 0.83, 0.82)),
    'saltverden':  ('siste',     ( 90.0, -50.0), (0.70, 0.77, 0.82)),
    'speilverden': ('senter',    ( 90.0,  70.0), (0.69, 0.30, 0.89)),
}

# Player can never walk further than this from world origin. The ring
# is just below the perimeter cairns in Hageverden, so a wire circle of
# this radius is a useful "edge of playable area" marker in Blender.
WORLD_RADIUS = 120.0

# Properties stored on the Empty directly (NOT as custom props) —
# these come from / go to the spawn transform, not the JSON field set.
TRANSFORM_KEYS = {'id', 'kind', 'position', 'rotation', 'scale'}

# Marker on the player-spawn empty so we know which object holds the
# `spawnPoint`. The empty's name is irrelevant; this flag is what we
# look for at export time.
SPAWN_POINT_KEY = 'spel_spawn_point'

# Marker on viewport-aid objects (ground plane, world-radius wire) so
# the exporter skips them — they are NOT spawns, just visual scaffold.
REF_KEY = 'spel_ref'

# One config dict per spawn kind. Edit values here to tune how the
# kind renders in Blender's viewport — scale, base colour, emission
# colour + strength, GLB path. Each tweak shows up next Import Level
# (or after a manual material refresh). The schema:
#
#   glb         - URL relative to /public/. Optional; sprites and
#                 procedural kinds skip this.
#   scale       - default Blender scale when the spawn has no
#                 explicit scale field. Mirrors the `scale = N`
#                 defaults inside each game component.
#   tint        - (R, G, B, A) base colour applied to the GLB
#                 instance. Pulled to match the game's MeshLambert
#                 colour so the prop reads the same way in both.
#   emission    - (R, G, B) — addt'l emission baked into the
#                 material so neon coral / heart-wing trees glow
#                 in viewport without external lighting.
#   emit_str    - emission strength (0 = matte, 1.5 = neon).
#
# Add a new spawn kind to KIND_ITEMS (the dropdown) AND ASSETS, then
# disable + enable the addon to refresh.
ASSETS = {
    'glowing_purple_coral':   {'glb': '/models/glowing_purple_coral.glb',
                               'tint': (0.63, 0.31, 0.82, 1.0),
                               'emission': (0.48, 0.18, 0.72), 'emit_str': 0.9},
    'neon_vascular_tree':     {'glb': '/models/neon_vascular_tree.glb',
                               'tint': (0.48, 0.31, 0.66, 1.0),
                               'emission': (0.23, 0.10, 0.35), 'emit_str': 0.55},
    'purple_coral':           {'glb': '/models/purple_coral.glb',
                               'tint': (0.48, 0.31, 0.66, 1.0),
                               'emission': (0.12, 0.07, 0.19), 'emit_str': 0.45},
    'purple_coral_alt':       {'glb': '/models/purple_coral_alt.glb',
                               'tint': (0.53, 0.33, 0.77, 1.0),
                               'emission': (0.13, 0.07, 0.25), 'emit_str': 0.50},
    'purple_stone_cairn':     {'glb': '/models/purple_stone_cairn.glb',
                               'tint': (0.37, 0.30, 0.46, 1.0),
                               'emission': (0.08, 0.06, 0.16), 'emit_str': 0.35},
    'tangled_root_sculpture': {'glb': '/models/tangled_root_sculpture.glb',
                               'tint': (0.29, 0.21, 0.41, 1.0),
                               'emission': (0.10, 0.05, 0.19), 'emit_str': 0.4},
    'mythical_horse':         {'glb': '/models/mythical_horse.glb',
                               'tint': (0.94, 0.78, 0.78, 1.0),
                               'emission': (0.48, 0.22, 0.22), 'emit_str': 0.45},
    'rock_stack':             {'glb': '/models/rock_stack.glb', 'scale': 1.0,
                               'tint': (0.4, 0.36, 0.48, 1.0)},
    'stone_hut':              {'glb': '/models/stone_hut.glb', 'scale': 1.0,
                               'tint': (0.46, 0.36, 0.5, 1.0)},
    'trilo':                  {'glb': '/models/trilo.glb', 'scale': 1.5,
                               'tint': (0.64, 0.34, 0.78, 1.0),
                               'emission': (0.18, 0.07, 0.32), 'emit_str': 0.6},
    'giantess':               {'glb': '/models/giantess_squat.glb', 'scale': 11.0,
                               'tint': (1.00, 0.40, 0.67, 1.0),
                               'emission': (0.27, 0.0, 0.13), 'emit_str': 0.6},
    'skate':                  {'glb': '/models/skate.glb', 'scale': 2.5,
                               'tint': (0.75, 0.85, 1.0, 1.0)},
    'car':                    {'glb': '/models/car_01.glb',
                               'tint': (0.6, 0.45, 0.7, 1.0)},
    'star_npc':               {'glb': '/models/stjernekarakter.glb',
                               'tint': (1.0, 0.85, 0.5, 1.0),
                               'emission': (0.5, 0.4, 0.18), 'emit_str': 0.7},
    'boble_npc':              {'glb': '/models/boblehovud.glb',
                               'tint': (0.85, 0.75, 1.0, 1.0),
                               'emission': (0.42, 0.34, 0.55), 'emit_str': 0.5},
    'crystal_altar':          {'scale': 1.6,
                               'tint': (0.7, 0.45, 0.95, 1.0),
                               'emission': (0.42, 0.18, 0.72), 'emit_str': 0.8},
}

# Backwards-compat shims so the rest of the addon code can still
# read the old maps without sprawling refactors. Each map projects
# the relevant field out of ASSETS.
KIND_GLB = {k: v['glb'] for k, v in ASSETS.items() if 'glb' in v}
KIND_DEFAULT_SCALE = {k: v['scale'] for k, v in ASSETS.items() if 'scale' in v}
KIND_TINT = {k: v['tint'] for k, v in ASSETS.items() if 'tint' in v}

# flis_prop reads its `prop` field to pick between four GLBs. The
# addon previews whichever one the spawn was authored with.
FLIS_PROP_GLB = {
    'figure_seated': '/flisverden/flis_figure_seated.glb',
    'pillar':        '/flisverden/flis_pillar.glb',
    'vesica':        '/flisverden/flis_vesica.glb',
    'floor_tile':    '/flisverden/flis_floor_tile.glb',
}

# Player character GLB — rendered at the __spawnpoint_<world> empty so
# the level designer sees the player's silhouette at their landing
# spot. Mirrors src/game/config.ts PLAYER_MODEL_URL.
PLAYER_GLB = '/models/sligo_01.glb'

# Texture used by Flisverden's procedural flis_floor / flis_pool tiles.
# Mirrors the TILE_TEXTURE_URL in src/game/FlisFloor.tsx + FlisPool.tsx.
FLIS_TILE_TEXTURE = '/flisverden/flis_tilable_texture.png'
# Pool dimensions copied from src/game/FlisPool.tsx so the basin built
# in Blender matches the in-game footprint.
FLIS_POOL_TILE = 8.0
FLIS_POOL_TILES_X = 7
FLIS_POOL_TILES_Z = 3
FLIS_POOL_DEPTH = 4.5  # how far the basin recesses below the deck


# --- helpers --------------------------------------------------------

def _project_root(scn):
    p = (scn.spel_project_root or '').strip()
    if not p:
        return None
    return Path(bpy.path.abspath(p))


def _spawns_json_path(scn):
    root = _project_root(scn)
    if not root:
        return None
    world = scn.spel_world_name
    if not world:
        return None
    return root / 'src' / 'game' / 'levels' / world / 'spawns.json'


def _try_load_image(project_root, tex_url):
    if not project_root or not tex_url:
        return None
    rel = str(tex_url).lstrip('/')
    abs_path = project_root / 'public' / rel
    if not abs_path.exists():
        return None
    try:
        return bpy.data.images.load(str(abs_path), check_existing=True)
    except Exception:
        return None


def _glb_url_for_spawn(spawn):
    """Look up the GLB to preview for this spawn (or None)."""
    kind = spawn.get('kind')
    if kind == 'flis_prop':
        prop = spawn.get('prop', 'vesica')
        return FLIS_PROP_GLB.get(prop)
    if kind == 'car':
        # car.model can override the default car_01 → car_02 swap.
        model = spawn.get('model')
        if model == 'car_02':
            return '/models/car_02.glb'
    return KIND_GLB.get(kind)


def _glb_lib_collection(project_root, glb_url):
    """Load a GLB once into a hidden library collection and return it.
    Subsequent calls for the same GLB return the cached collection so
    every spawn of the same kind reuses one mesh in memory."""
    if not project_root or not glb_url:
        return None
    name = f"_glb_lib_{glb_url}"
    coll = bpy.data.collections.get(name)
    if coll is not None:
        return coll
    abs_path = project_root / 'public' / glb_url.lstrip('/')
    if not abs_path.exists():
        return None
    pre = set(bpy.data.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=str(abs_path))
    except Exception:
        return None
    new_objs = [o for o in bpy.data.objects if o not in pre]
    if not new_objs:
        return None
    coll = bpy.data.collections.new(name)
    # Move every imported object into the library collection and out
    # of any scene collection — the library is referenced via instance
    # empties, never linked directly into a view layer.
    for o in new_objs:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    return coll


def _scene_for_world(world):
    """One Blender Scene per world. Switching scenes is how the user
    toggles between worlds — keeps each region's geometry, lights, and
    ground reference isolated so they don't overlap in the viewport."""
    scene = bpy.data.scenes.get(world)
    if scene is None:
        scene = bpy.data.scenes.new(world)
        # Metric / metres so the giant world-radius coords read as
        # plain numbers, not 90000 mm.
        scene.unit_settings.system = 'METRIC'
        scene.unit_settings.length_unit = 'METERS'
    return scene


def _activate_world_scene(world):
    """Switch the active window to the world's scene if it exists.
    Returns the scene (or None if no window context)."""
    scene = _scene_for_world(world)
    wm = bpy.context.window_manager
    for win in wm.windows:
        if win.scene is not scene:
            win.scene = scene
    return scene


def _coll_for_world(scn):
    """Spawns collection lives inside the world's own scene now. The
    collection name keeps the `spawns_` prefix so the existing
    REF_KEY / SPAWN_POINT_KEY filters still work."""
    name = f"spawns_{scn.spel_world_name}"
    coll = scn.collection.children.get(name)
    if coll is None:
        coll = bpy.data.collections.get(name)
        # If a stale collection exists in another scene (legacy data),
        # leave it alone and create a fresh one for this scene.
        if coll is None or coll.name not in (c.name for c in scn.collection.children):
            coll = bpy.data.collections.new(name)
            scn.collection.children.link(coll)
    return coll


def _flis_tile_material(project_root):
    """Reusable material with the cyan flis tile texture mapped on top.
    Cached as 'spel_flis_tile' so every floor/pool shares one material."""
    mat = bpy.data.materials.get('spel_flis_tile')
    if mat is not None:
        return mat
    img = _try_load_image(project_root, FLIS_TILE_TEXTURE)
    mat = bpy.data.materials.new('spel_flis_tile')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf is not None and img is not None:
        nodes = mat.node_tree.nodes
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = img
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.4
    # Diffuse colour also set so Solid+Material colour mode shows cyan
    # even when nodes aren't evaluated.
    mat.diffuse_color = (0.49, 0.83, 0.82, 1.0)
    return mat


def _build_flis_floor(coll, spawn, project_root):
    """flis_floor → tile-textured Plane covering the rectangle. The
    `width` × `depth` come straight from the spawn fields."""
    width = float(spawn.get('width', 60.0))
    depth = float(spawn.get('depth', 60.0))
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(spawn['position'][0],
                                                         spawn['position'][1],
                                                         0.0))
    obj = bpy.context.active_object
    obj.dimensions = (width, depth, 0.0)
    obj.name = spawn['id']
    # Move into the world collection
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    mat = _flis_tile_material(project_root)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def _build_flis_pool(coll, spawn, project_root):
    """flis_pool → recessed basin: a box pushed down beneath the deck,
    with tile-textured walls + floor. Open at the top."""
    cx, cz = spawn['position'][0], spawn['position'][1]
    half_x = (FLIS_POOL_TILES_X * FLIS_POOL_TILE) / 2.0
    half_z = (FLIS_POOL_TILES_Z * FLIS_POOL_TILE) / 2.0
    depth = FLIS_POOL_DEPTH
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cz, -depth / 2.0))
    obj = bpy.context.active_object
    obj.dimensions = (half_x * 2, half_z * 2, depth)
    obj.name = spawn['id']
    # Top face open: easiest way is to enter edit mode and delete the
    # top face. For now, leave it closed — the deck floors hide the top
    # face from view. The recessed basin still reads from inside.
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    mat = _flis_tile_material(project_root)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def _apply_kind_material(obj, kind):
    """Build / fetch the cached material for `kind` (using ASSETS) and
    apply it to every mesh inside the instance collection so the
    Blender viewport reads the same colour + glow the game shows.
    Includes emission for neon-feeling kinds so they pop without
    relying on external scene lights."""
    coll = obj.instance_collection
    if coll is None:
        return
    cfg = ASSETS.get(kind)
    if cfg is None:
        return
    tint = cfg.get('tint')
    emission = cfg.get('emission')
    emit_str = cfg.get('emit_str', 0.0)
    if tint is None and emission is None:
        return
    key = f"spel_kind_{kind}"
    mat = bpy.data.materials.get(key)
    if mat is None:
        mat = bpy.data.materials.new(key)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf is not None:
            if tint is not None:
                bsdf.inputs['Base Color'].default_value = tint
            if 'Roughness' in bsdf.inputs:
                bsdf.inputs['Roughness'].default_value = 0.5
            if emission is not None and 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = (
                    emission[0], emission[1], emission[2], 1.0)
                bsdf.inputs['Emission Strength'].default_value = emit_str
        if tint is not None:
            mat.diffuse_color = tint
    for inner in coll.objects:
        if inner.type != 'MESH':
            continue
        if inner.data.materials:
            inner.data.materials[0] = mat
        else:
            inner.data.materials.append(mat)


# Legacy alias — old call sites pass a raw tint. Forward to the new
# kind-based material builder by reverse-looking-up the kind.
def _apply_tint_to_instance(obj, tint):
    for k, v in ASSETS.items():
        if v.get('tint') == tint:
            _apply_kind_material(obj, k)
            return


def _create_spawn_empty(coll, spawn, project_root):
    name = spawn['id']
    kind = spawn['kind']
    pos = spawn['position']

    # flis_floor / flis_pool: build real geometry with the tile texture
    # so Blender's viewport matches what the game's procedural meshes
    # render. Skip the rest of the function — these are full meshes,
    # not transform empties.
    if kind == 'flis_floor':
        obj = _build_flis_floor(coll, spawn, project_root)
        obj['kind'] = kind
        for k, v in spawn.items():
            if k in TRANSFORM_KEYS:
                continue
            obj[k] = v
        return obj
    if kind == 'flis_pool':
        obj = _build_flis_pool(coll, spawn, project_root)
        obj['kind'] = kind
        for k, v in spawn.items():
            if k in TRANSFORM_KEYS:
                continue
            obj[k] = v
        return obj

    # Asset preview priority: explicit texture → painted-card billboard;
    # else known kind → real GLB instance; else plain axes.
    texture = spawn.get('texture')
    img = _try_load_image(project_root, texture)
    glb_url = None if img is not None else _glb_url_for_spawn(spawn)
    glb_lib = _glb_lib_collection(project_root, glb_url) if glb_url else None

    obj = bpy.data.objects.new(name, None)
    coll.objects.link(obj)

    if img is not None:
        obj.empty_display_type = 'IMAGE'
        obj.data = img
        # Stand the image upright facing -Y (toward iso camera-ish).
        obj.rotation_euler[0] = math.pi / 2
        obj.empty_image_offset[0] = -0.5
        obj.empty_image_offset[1] = 0.0
        obj.use_empty_image_alpha = True
        obj.empty_image_depth = 'DEFAULT'
        # Display the image at the spawn's authored height (or 4 m).
        obj.empty_display_size = float(spawn.get('height', 4.0))
    elif glb_lib is not None:
        # Instance the loaded GLB collection. The empty itself stays a
        # plain transform; the rendered geometry comes from the
        # referenced library collection, so memory cost is one mesh
        # for an entire perimeter ring of 28 cairns.
        obj.instance_type = 'COLLECTION'
        obj.instance_collection = glb_lib
        obj.empty_display_size = 0.5
        # Apply per-kind material (tint + emission) so the prop reads
        # the same way as the game's MeshLambertMaterial render and
        # gets the neon glow that several kinds need (corals, trilo).
        _apply_kind_material(obj, kind)
    else:
        obj.empty_display_type = 'PLAIN_AXES'
        obj.empty_display_size = 1.5

    obj.location = (float(pos[0]), float(pos[1]), 0.0)
    if 'rotation' in spawn:
        obj.rotation_euler[2] = float(spawn['rotation'])
    # Explicit scale wins; otherwise fall back to the kind's runtime
    # default so the preview reads the same size as in-game.
    if 'scale' in spawn:
        s = float(spawn['scale'])
        obj.scale = (s, s, s)
    elif kind in KIND_DEFAULT_SCALE:
        s = KIND_DEFAULT_SCALE[kind]
        obj.scale = (s, s, s)

    obj['kind'] = kind
    for k, v in spawn.items():
        if k in TRANSFORM_KEYS:
            continue
        obj[k] = v
    return obj


def _ensure_spawn_point(scn, sp):
    coll = _coll_for_world(scn)
    name = f"__spawnpoint_{scn.spel_world_name}"
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, None)
        coll.objects.link(obj)

    # Try to preview the player character GLB on top of the spawn
    # marker so the level designer sees the character's silhouette at
    # the correct landing spot. Falls back to a plain sphere empty if
    # the GLB can't be loaded (e.g. file missing, repo path unset).
    root = _project_root(scn)
    lib = _glb_lib_collection(root, PLAYER_GLB)
    if lib is not None:
        obj.instance_type = 'COLLECTION'
        obj.instance_collection = lib
        obj.empty_display_size = 0.5
    else:
        obj.empty_display_type = 'SPHERE'
        obj.empty_display_size = 2.0

    obj.location = (float(sp.get('x', 0)), float(sp.get('z', 0)), 0.0)
    obj[SPAWN_POINT_KEY] = True
    return obj


def _clear_world(scn):
    coll = _coll_for_world(scn)
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


# --- operators ------------------------------------------------------

class SPELAUGET_OT_import_level(Operator):
    bl_idname = "spelauget.import_level"
    bl_label = "Import Level"
    bl_description = "Read spawns.json for the chosen world into the active scene"

    def execute(self, context):
        scn = context.scene
        # spawns_<world> + everything else lives in the world's own
        # Blender Scene. Pre-import: make sure that scene exists, copy
        # the World/Repo properties, activate it. From here on `scn`
        # refers to the world's scene, not the original active one.
        target_world = scn.spel_world_name
        project_root_str = scn.spel_project_root
        world_scene = _activate_world_scene(target_world)
        world_scene.spel_project_root = project_root_str
        world_scene.spel_world_name = target_world
        scn = world_scene

        path = _spawns_json_path(scn)
        if path is None:
            self.report({'ERROR'}, "Set Project Root + World first")
            return {'CANCELLED'}
        if not path.exists():
            self.report({'ERROR'}, f"Missing: {path}")
            return {'CANCELLED'}
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except Exception as e:
            self.report({'ERROR'}, f"Parse failed: {e}")
            return {'CANCELLED'}

        _clear_world(scn)
        coll = _coll_for_world(scn)
        root = _project_root(scn)

        spawns = data.get('spawns', [])
        for spawn in spawns:
            _create_spawn_empty(coll, spawn, root)

        sp = data.get('spawnPoint', {'x': 0, 'z': 0})
        _ensure_spawn_point(scn, sp)

        self.report({'INFO'}, f"Imported {len(spawns)} spawns from {path.name}")
        return {'FINISHED'}


class SPELAUGET_OT_export_level(Operator):
    bl_idname = "spelauget.export_level"
    bl_label = "Export Level"
    bl_description = "Write the active world's spawn collection to spawns.json"

    def execute(self, context):
        scn = context.scene
        path = _spawns_json_path(scn)
        if path is None:
            self.report({'ERROR'}, "Set Project Root + World first")
            return {'CANCELLED'}

        coll = _coll_for_world(scn)
        spawns = []
        spawn_point = {'x': 0.0, 'z': 0.0}

        for obj in coll.objects:
            if obj.get(REF_KEY):
                continue
            if obj.get(SPAWN_POINT_KEY):
                spawn_point = {
                    'x': round(obj.location.x, 4),
                    'z': round(obj.location.y, 4),
                }
                continue
            kind = obj.get('kind')
            if kind is None:
                continue
            entry = {
                'kind': str(kind),
                'id': obj.name,
                'position': [round(obj.location.x, 4), round(obj.location.y, 4)],
            }
            if abs(obj.rotation_euler[2]) > 1e-6:
                entry['rotation'] = round(obj.rotation_euler[2], 4)
            sx, sy, sz = obj.scale.x, obj.scale.y, obj.scale.z
            s = (sx + sy + sz) / 3.0
            if abs(s - 1.0) > 1e-4:
                entry['scale'] = round(s, 4)

            for k in obj.keys():
                if k in ('kind', '_RNA_UI', SPAWN_POINT_KEY):
                    continue
                v = obj[k]
                entry[k] = _coerce_value(v)
            spawns.append(entry)

        out = {
            'spawnPoint': spawn_point,
            'spawns': spawns,
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding='utf-8')

        self.report({'INFO'}, f"Wrote {len(spawns)} spawns → {path.name}")
        return {'FINISHED'}


def _coerce_value(v):
    if isinstance(v, (int, float, bool, str)):
        return v
    try:
        return [float(x) for x in v]
    except Exception:
        return str(v)


class SPELAUGET_OT_add_spawn(Operator):
    bl_idname = "spelauget.add_spawn"
    bl_label = "Add Spawn"
    bl_description = "Drop a new spawn of the chosen kind at the 3D cursor"

    def execute(self, context):
        scn = context.scene
        kind = scn.spel_add_kind
        if not kind:
            self.report({'ERROR'}, "Pick a kind first")
            return {'CANCELLED'}
        coll = _coll_for_world(scn)
        # Auto-generate id: <world-prefix>.<kind>.<N>
        prefix = scn.spel_world_name[:4]
        n = 1
        while True:
            name = f"{prefix}.{kind}.{n}"
            if bpy.data.objects.get(name) is None:
                break
            n += 1

        spawn = {
            'kind': kind,
            'id': name,
            'position': [
                round(scn.cursor.location.x, 4),
                round(scn.cursor.location.y, 4),
            ],
        }
        for k, v in KIND_DEFAULTS.get(kind, {}).items():
            spawn[k] = v

        obj = _create_spawn_empty(coll, spawn, _project_root(scn))

        # Select the new spawn so the user can move it immediately
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        context.view_layer.objects.active = obj

        self.report({'INFO'}, f"Added {name}")
        return {'FINISHED'}


class SPELAUGET_OT_open_json(Operator):
    bl_idname = "spelauget.open_json"
    bl_label = "Reveal JSON"
    bl_description = "Show the spawns.json path in your file browser"

    def execute(self, context):
        path = _spawns_json_path(context.scene)
        if path is None:
            self.report({'ERROR'}, "Set Project Root + World first")
            return {'CANCELLED'}
        bpy.ops.wm.path_open(filepath=str(path.parent))
        return {'FINISHED'}


class SPELAUGET_OT_pixelate(Operator):
    bl_idname = "spelauget.pixelate"
    bl_label = "Pixelate Viewport"
    bl_description = (
        "Crank the viewport pixel size up so the rendered preview "
        "matches the game's chunky-pixel look. Tap again to undo."
    )

    def execute(self, context):
        # Toggle a pixel-art viewport feel: disable EEVEE TAA so edges
        # don't smooth, drop sample count to 1, switch image
        # interpolation to nearest. Stored on the scene so a second
        # toggle restores defaults.
        scn = context.scene
        on = not bool(scn.get('spel_pixelated'))
        scn['spel_pixelated'] = on

        if hasattr(scn, 'eevee'):
            ev = scn.eevee
            if hasattr(ev, 'taa_samples'):
                ev.taa_samples = 1 if on else 16
            if hasattr(ev, 'taa_render_samples'):
                ev.taa_render_samples = 1 if on else 64
            # Disable anti-aliasing entirely if the property exists
            for attr, off, default in (
                ('use_taa_reprojection', False, True),
                ('use_overscan', False, False),
            ):
                if hasattr(ev, attr):
                    try:
                        setattr(ev, attr, off if on else default)
                    except Exception:
                        pass

        # Force every Image Texture to nearest-neighbour interpolation
        # so painted-card sprites render as chunky pixels, not blurred.
        for img in bpy.data.images:
            if on:
                img.alpha_mode = 'STRAIGHT'
        for mat in bpy.data.materials:
            if not mat.use_nodes:
                continue
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE':
                    node.interpolation = 'Closest' if on else 'Linear'

        # Drop the viewport render percentage to half so the result
        # gets rasterised at lower resolution then nearest-upscaled.
        scn.render.resolution_percentage = 50 if on else 100

        self.report({'INFO'}, f"Pixelated: {on}")
        return {'FINISHED'}


class SPELAUGET_OT_view_iso(Operator):
    bl_idname = "spelauget.view_iso"
    bl_label = "Iso Game Camera"
    bl_description = (
        "Set the 3D viewport to ortho + the game's iso angle (45° "
        "azimuth, ~24° elevation, viewSize ~14m) so what you see in "
        "Blender matches what the player sees in-game"
    )

    def execute(self, context):
        import mathutils
        # Iso angle: pitch ~60° from top + yaw 45°. Set directly so
        # the result is the same regardless of previous view state.
        quat = mathutils.Euler(
            (math.radians(60.0), 0.0, math.radians(45.0)), 'XYZ'
        ).to_quaternion()
        scn = context.scene
        info = WORLD_REGION.get(scn.spel_world_name)
        cx, cy = (0.0, 0.0)
        if info is not None:
            _id, (cx, cy), _rgb = info
        for area in context.screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                rv = space.region_3d
                rv.view_perspective = 'ORTHO'
                rv.view_rotation = quat
                rv.view_location = mathutils.Vector((cx, cy, 0.0))
                rv.view_distance = 130.0
                break
        return {'FINISHED'}


class SPELAUGET_OT_view_top(Operator):
    bl_idname = "spelauget.view_top"
    bl_label = "Top Down"
    bl_description = "Top-down orthographic view of the active world"

    def execute(self, context):
        import mathutils
        # Find any active world centre to focus on. Falls back to
        # origin if the world isn't a recognised region.
        scn = context.scene
        info = WORLD_REGION.get(scn.spel_world_name)
        if info is not None:
            _id, (cx, cy), _rgb = info
        else:
            cx, cy = 0.0, 0.0
        for area in context.screen.areas:
            if area.type == 'VIEW_3D':
                region = next(r for r in area.regions if r.type == 'WINDOW')
                space = area.spaces.active
                with context.temp_override(area=area, region=region):
                    bpy.ops.view3d.view_axis(type='TOP')
                rv = space.region_3d
                rv.view_location = mathutils.Vector((cx, cy, 0.0))
                rv.view_distance = 90.0
                rv.view_perspective = 'ORTHO'
                break
        return {'FINISHED'}


class SPELAUGET_OT_setup_lighting(Operator):
    bl_idname = "spelauget.setup_lighting"
    bl_label = "Setup Lighting"
    bl_description = (
        "Add a sun + ambient hemi light + matching world background so "
        "the viewport reads close to the game's day-cycle lighting"
    )

    def execute(self, context):
        scn = context.scene

        # Per-region atmosphere — pulled from src/store/tuner.ts
        # DEFAULT_FOG so the Blender world background reads the same
        # colour family the game renders for this region.
        ATMOS = {
            'hageverden':  (0.10, 0.07, 0.18),  # lysningen
            'blodverden':  (0.63, 0.09, 0.16),  # blod
            'flisverden':  (0.85, 0.66, 0.83),  # geometri
            'saltverden':  (0.10, 0.17, 0.24),  # siste
            'speilverden': (1.00, 1.00, 1.00),  # senter (white)
        }
        bg_color = ATMOS.get(scn.spel_world_name, (0.10, 0.07, 0.18))

        # World background — atmospheric haze in the region's colour.
        # Strength bumped so EEVEE shows the tint as ambient even at
        # default exposure.
        scn.world = scn.world or bpy.data.worlds.new(f"world_{scn.spel_world_name}")
        scn.world.use_nodes = True
        bg = scn.world.node_tree.nodes.get('Background')
        if bg is not None:
            bg.inputs['Color'].default_value = (
                bg_color[0], bg_color[1], bg_color[2], 1.0)
            bg.inputs['Strength'].default_value = 1.0

        # Switch the render engine to EEVEE for fast preview that
        # respects emission + bloom — closer to the game's WebGL look
        # than Cycles' physically-based render.
        try:
            scn.render.engine = 'BLENDER_EEVEE_NEXT'
        except Exception:
            scn.render.engine = 'BLENDER_EEVEE'

        # Bloom-like glow: EEVEE Next exposes glow under the eevee
        # settings or via compositor — try to enable cheap bloom on
        # the older eevee API too.
        if hasattr(scn, 'eevee'):
            ev = scn.eevee
            for attr, val in (
                ('use_bloom', True), ('bloom_intensity', 0.4),
                ('bloom_threshold', 0.7), ('use_ssr', False),
                ('use_volumetric_lights', False),
            ):
                if hasattr(ev, attr):
                    try:
                        setattr(ev, attr, val)
                    except Exception:
                        pass

        # Remove any previous Spelauget lights so the operator stays
        # idempotent — running it again refreshes rather than stacking.
        for o in list(scn.objects):
            if o.get('spel_light'):
                bpy.data.objects.remove(o, do_unlink=True)

        # Sun light — warm/cool angled from above, matches the game's
        # iso-camera key direction so highlights fall consistently
        # with what the player sees.
        sun_data = bpy.data.lights.new('Spel_Sun', type='SUN')
        sun_data.color = (0.80, 0.72, 1.0)
        sun_data.energy = 4.0
        sun = bpy.data.objects.new('Spel_Sun', sun_data)
        sun.location = (8.0, -6.0, 14.0)
        sun.rotation_euler = (0.6, 0.1, 0.4)
        sun['spel_light'] = True
        scn.collection.objects.link(sun)

        # Soft fill — pulled in the region's atmosphere tint so
        # underbellies of props read as part of the world, not grey.
        fill_data = bpy.data.lights.new('Spel_Fill', type='AREA')
        fill_data.color = (
            min(1.0, bg_color[0] + 0.3),
            min(1.0, bg_color[1] + 0.3),
            min(1.0, bg_color[2] + 0.3),
        )
        fill_data.energy = 80.0
        fill_data.size = 100.0
        fill = bpy.data.objects.new('Spel_Fill', fill_data)
        info = WORLD_REGION.get(scn.spel_world_name)
        if info is not None:
            _id, (cx, cy), _rgb = info
            fill.location = (cx, cy, 30.0)
        fill.rotation_euler = (0.0, 0.0, 0.0)
        fill['spel_light'] = True
        scn.collection.objects.link(fill)

        # Set the viewport to Material Preview so the new materials
        # render with the lighting we just configured.
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'MATERIAL'
                break

        self.report({'INFO'}, f"EEVEE + sun + fill set; world tint = {scn.spel_world_name}")
        return {'FINISHED'}


def _make_ground_material(world):
    info = WORLD_REGION.get(world)
    if info is None:
        return None
    _region_id, _center, rgb = info
    mat_name = f"spel_ground_{world}"
    mat = bpy.data.materials.get(mat_name)
    if mat is None:
        mat = bpy.data.materials.new(mat_name)
    mat.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    mat.use_nodes = True
    # Drive the principled BSDF base colour from the same tint so it
    # also reads correctly in Material Preview / Rendered viewport
    # modes, not just Solid mode.
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    if bsdf is not None:
        bsdf.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        if 'Roughness' in bsdf.inputs:
            bsdf.inputs['Roughness'].default_value = 1.0
    return mat


class SPELAUGET_OT_add_ground_ref(Operator):
    bl_idname = "spelauget.add_ground_ref"
    bl_label = "Add Ground Reference"
    bl_description = (
        "Drop a region-tinted ground disc + world-radius wire ring "
        "at the active region centre. Viewport aid only — not exported"
    )

    def execute(self, context):
        scn = context.scene
        world = scn.spel_world_name
        info = WORLD_REGION.get(world)
        if info is None:
            self.report({'ERROR'}, f"Unknown world: {world}")
            return {'CANCELLED'}
        region_id, (cx, cy), _rgb = info

        coll = _coll_for_world(scn)

        # Remove any previous reference objects for this world so the
        # operator is idempotent — running it again refreshes the
        # plane / ring instead of stacking duplicates.
        for obj in list(coll.objects):
            if obj.get(REF_KEY):
                bpy.data.objects.remove(obj, do_unlink=True)

        # Ground disc — a 64-segment circle scaled to ~240 m diameter
        # (matches WORLD_RADIUS=120). Centred on the region. Mat picks
        # up a representative mid-stop colour for the region's ground
        # palette so it reads the same colour family as the game.
        bpy.ops.mesh.primitive_circle_add(
            vertices=64,
            radius=WORLD_RADIUS,
            fill_type='NGON',
            location=(cx, cy, -0.01),
        )
        disc = context.active_object
        disc.name = f"__ground_{world}"
        disc[REF_KEY] = 'ground'
        # Move into the world collection (primitive_add drops into the
        # scene collection by default).
        for c in list(disc.users_collection):
            c.objects.unlink(disc)
        coll.objects.link(disc)
        mat = _make_ground_material(world)
        if mat is not None:
            if disc.data.materials:
                disc.data.materials[0] = mat
            else:
                disc.data.materials.append(mat)
        # Lock so the user can't accidentally drag the reference disc
        # around — only the operator should move it.
        disc.lock_location = (True, True, True)
        disc.lock_rotation = (True, True, True)
        disc.lock_scale = (True, True, True)

        # Wire ring at world radius — a fine line so the playable edge
        # is readable without obscuring spawns under it. Built as a
        # second circle in Edit mode is overkill; an Empty with display
        # 'CIRCLE' is one object and renders as a wireframe ring.
        ring = bpy.data.objects.new(f"__bounds_{world}", None)
        coll.objects.link(ring)
        ring.empty_display_type = 'CIRCLE'
        ring.empty_display_size = WORLD_RADIUS
        ring.location = (cx, cy, 0.0)
        ring.rotation_euler = (1.5708, 0.0, 0.0)  # face up
        ring[REF_KEY] = 'bounds'
        ring.lock_location = (True, True, True)
        ring.lock_rotation = (True, True, True)
        ring.lock_scale = (True, True, True)

        self.report(
            {'INFO'},
            f"Ground ref for {region_id} at ({cx:.0f}, {cy:.0f})"
        )
        return {'FINISHED'}


# --- UI -------------------------------------------------------------

class SPELAUGET_PT_panel(Panel):
    bl_label = "Spelauget Level"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Spelauget'

    def draw(self, context):
        scn = context.scene
        layout = self.layout
        col = layout.column(align=True)
        col.prop(scn, 'spel_project_root', text='Repo')
        col.prop(scn, 'spel_world_name', text='World')

        layout.separator()
        row = layout.row(align=True)
        row.operator('spelauget.import_level', icon='IMPORT')
        row.operator('spelauget.export_level', icon='EXPORT')

        layout.separator()
        box = layout.box()
        box.label(text="Add Spawn", icon='ADD')
        # Show which world's kinds are currently offered. Switching the
        # World above re-filters the dropdown via _items_for_world.
        box.label(text=f"(kinds for {scn.spel_world_name} only)", icon='FILTER')
        box.prop(scn, 'spel_add_kind', text='Kind')
        box.operator('spelauget.add_spawn', icon='PLUS')

        layout.separator()
        row = layout.row(align=True)
        row.operator('spelauget.add_ground_ref', icon='MESH_CIRCLE')
        row.operator('spelauget.setup_lighting', icon='LIGHT_SUN')
        row.operator('spelauget.open_json', text='', icon='FILEBROWSER')

        layout.separator()
        layout.label(text="Viewport", icon='RESTRICT_VIEW_OFF')
        row = layout.row(align=True)
        row.operator('spelauget.view_iso', icon='AXIS_FRONT')
        row.operator('spelauget.view_top', icon='AXIS_TOP')
        layout.operator('spelauget.pixelate', icon='TEXTURE_DATA')

        active = context.active_object
        if active is not None and active.get('kind') is not None:
            layout.separator()
            box = layout.box()
            box.label(text=f"Selected: {active.name}")
            box.label(text=f"  kind: {active['kind']}")
            box.label(
                text=f"  pos: ({active.location.x:.1f}, {active.location.y:.1f})"
            )
            box.label(text="Edit fields in Object Properties → Custom Properties")


# --- register -------------------------------------------------------

_CLASSES = (
    SPELAUGET_OT_import_level,
    SPELAUGET_OT_export_level,
    SPELAUGET_OT_add_spawn,
    SPELAUGET_OT_open_json,
    SPELAUGET_OT_add_ground_ref,
    SPELAUGET_OT_setup_lighting,
    SPELAUGET_OT_pixelate,
    SPELAUGET_OT_view_iso,
    SPELAUGET_OT_view_top,
    SPELAUGET_PT_panel,
)


def _on_world_changed(self, context):
    """Auto-switch the active window's Blender Scene to the world's
    own scene whenever the user changes the World dropdown. Keeps the
    'each world is its own scene' invariant working without an extra
    click. Skipped if the scene doesn't exist yet — first Import Level
    creates it."""
    target = self.spel_world_name
    if not target:
        return
    scene = bpy.data.scenes.get(target)
    if scene is None:
        return
    for win in bpy.context.window_manager.windows:
        if win.scene is not scene:
            win.scene = scene
    # Carry repo path forward so the user doesn't have to retype it
    # in every scene.
    if not scene.spel_project_root and self.spel_project_root:
        scene.spel_project_root = self.spel_project_root
    if scene.spel_world_name != target:
        scene.spel_world_name = target


def _kind_label(kind):
    for k, label, _desc in KIND_ITEMS:
        if k == kind:
            return label
    return kind


# Blender pitfall: if the EnumProperty `items` callback returns freshly-
# allocated strings on every invocation, the underlying char* can be
# freed by the GC mid-draw and crash Blender. Cache one list per world
# so the tuple-of-tuples (and its strings) live for the addon's lifetime.
_FILTERED_ITEMS_CACHE = {}


def _items_for_world(self, context):
    # Dynamic EnumProperty `items` callback. Blender re-invokes this
    # every time the dropdown is opened, so swapping the active world
    # immediately re-filters the available kinds.
    world = context.scene.spel_world_name
    cached = _FILTERED_ITEMS_CACHE.get(world)
    if cached is not None:
        return cached
    allow = WORLD_KIND_ALLOWLIST.get(world, [])
    seen = set()
    out = []
    # World-specific first, then chain kinds. Order matters in the
    # dropdown so the most-likely picks appear at the top.
    for kind in allow:
        if kind in seen:
            continue
        seen.add(kind)
        out.append((kind, _kind_label(kind), f"{world}-specific"))
    for kind in CHAIN_KINDS:
        if kind in seen:
            continue
        seen.add(kind)
        out.append((kind, _kind_label(kind), 'chain / cross-world'))
    if not out:
        # Should never happen — every world has at least the chain
        # kinds. Fall back to the full list so the addon stays usable
        # if WORLD_KIND_ALLOWLIST gets out of sync.
        return KIND_ITEMS
    result = tuple(out)
    _FILTERED_ITEMS_CACHE[world] = result
    return result


def register():
    bpy.types.Scene.spel_project_root = StringProperty(
        name="Project Root",
        description="Absolute path to the spelauget.iverfinne.no repo",
        subtype='DIR_PATH',
    )
    bpy.types.Scene.spel_world_name = EnumProperty(
        name="World",
        items=WORLD_ITEMS,
        default='hageverden',
        update=_on_world_changed,
    )
    bpy.types.Scene.spel_add_kind = EnumProperty(
        name="Kind",
        items=_items_for_world,
    )
    for c in _CLASSES:
        bpy.utils.register_class(c)


def unregister():
    for c in reversed(_CLASSES):
        bpy.utils.unregister_class(c)
    del bpy.types.Scene.spel_add_kind
    del bpy.types.Scene.spel_world_name
    del bpy.types.Scene.spel_project_root


if __name__ == '__main__':
    register()
