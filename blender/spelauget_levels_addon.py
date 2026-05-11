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
    ('hagen',       'Hagen',         'First world — the clearing'),
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
    'hagen': [
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
    'hagen':       ('lysningen', ( 0.0,  -30.0), (0.33, 0.38, 0.75)),
    'blodverden':  ('blod',      (-90.0, -50.0), (0.84, 0.20, 0.23)),
    'flisverden':  ('geometri',  (-90.0,  60.0), (0.49, 0.83, 0.82)),
    'saltverden':  ('siste',     ( 90.0, -50.0), (0.70, 0.77, 0.82)),
    'speilverden': ('senter',    ( 90.0,  70.0), (0.69, 0.30, 0.89)),
}

# Player can never walk further than this from world origin. The ring
# is just below the perimeter cairns in Hagen, so a wire circle of
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


def _coll_for_world(scn):
    name = f"spawns_{scn.spel_world_name}"
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        scn.collection.children.link(coll)
    return coll


def _create_spawn_empty(coll, spawn, project_root):
    name = spawn['id']
    kind = spawn['kind']
    pos = spawn['position']

    texture = spawn.get('texture')
    img = _try_load_image(project_root, texture)

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
    else:
        obj.empty_display_type = 'PLAIN_AXES'
        obj.empty_display_size = 1.5

    obj.location = (float(pos[0]), float(pos[1]), 0.0)
    if 'rotation' in spawn:
        obj.rotation_euler[2] = float(spawn['rotation'])
    if 'scale' in spawn:
        s = float(spawn['scale'])
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
        box.prop(scn, 'spel_add_kind', text='Kind')
        box.operator('spelauget.add_spawn', icon='PLUS')

        layout.separator()
        row = layout.row(align=True)
        row.operator('spelauget.add_ground_ref', icon='MESH_CIRCLE')
        row.operator('spelauget.open_json', text='', icon='FILEBROWSER')

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
    SPELAUGET_PT_panel,
)


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
        default='hagen',
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
