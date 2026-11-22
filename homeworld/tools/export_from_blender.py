"""
Export the Players World island from GodlyKidsMap.blend.

Produces `environment.glb` (static island geometry) and `world.json` (grid,
trees, seeds, boulders, blockers, …) for homeworld/src.  Run headless:

  /Volumes/EpoxyDev/Blender.app/Contents/MacOS/Blender -b /Volumes/EpoxyDev/GodlyKidsMap.blend \
      --python homeworld/tools/export_from_blender.py -- \
      --previous public/homeworld/assets/world.json --out /tmp/homeworld-export

Then copy the two files into public/homeworld/assets/.

The script never saves the .blend.  Rules mirror what the runtime expects:
  * Trees and seed pickups are *not* exported as geometry (the runtime instances
    them from library.glb using world.json), so they are dropped from the GLB.
  * Boulders stay in the GLB and must carry a unique `resource_id` extra: the
    runtime pulls every world.json boulder out of the GLB by that id.
  * Coast woodland copies (HW_coast_added) reuse the ids of the trees/rocks they
    were duplicated from, so they are re-keyed to their object names.
  * The grid is sized to the land in the scene (origin/columns/rows may change
    between exports; the runtime migrates saved cell keys by origin delta).
"""
import bpy, json, math, os, re, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = arg('--out', '/tmp/homeworld-export')
PREVIOUS = arg('--previous')
os.makedirs(OUT, exist_ok=True)
prev = json.load(open(PREVIOUS)) if PREVIOUS and os.path.exists(PREVIOUS) else {}

scene = bpy.data.scenes['GodlyKids_HomeWorld']
bpy.context.window.scene = scene
vl = scene.view_layers[0]
deps = bpy.context.evaluated_depsgraph_get()
log = lambda *a: print('[export]', *a)

# ---------------------------------------------------------------- visible set
visible = []
def walk(lc):
    if lc.exclude or lc.collection.hide_render or lc.collection.hide_viewport or lc.collection.name == 'glTF_not_exported':
        return
    visible.extend(lc.collection.objects)
    for c in lc.children:
        walk(c)
for lc in vl.layer_collection.children:
    walk(lc)
visible = [o for o in dict.fromkeys(visible) if not o.hide_viewport and not o.hide_get(view_layer=vl)]
vis_names = {o.name for o in visible}
log('visible objects', len(visible))

def world_xy(o):
    t = o.matrix_world.translation
    return [t.x, t.y, t.z]
def bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box] if o.type == 'MESH' else [o.matrix_world.translation]
    for ch in o.children_recursive:
        if ch.type == 'MESH':
            pts += [ch.matrix_world @ Vector(c) for c in ch.bound_box]
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)], (min(zs), max(zs))

# ------------------------------------------------- re-key coast duplicates
is_tree = lambda o: bool(o.get('species_id')) and bool(o.get('resource_id'))
is_rock = lambda o: o.get('resource_type') == 'boulder' or re.fullmatch(r'PRP_HW_Rock_\d+', o.name)
is_seed = lambda o: bool(o.get('pickup_id'))
trees = [o for o in visible if is_tree(o)]
rocks = [o for o in visible if is_rock(o)]
seeds = [o for o in visible if is_seed(o)]
seen = set()
for o in trees + rocks:
    rid = str(o.get('resource_id') or o.name)
    if rid in seen or o.get('HW_coast_added'):
        o['resource_id'] = o.name   # in-memory only; the .blend is never saved
        rid = o.name
    seen.add(rid)
ids = [str(o.get('resource_id') or o.name) for o in trees + rocks]
assert len(ids) == len(set(ids)), 'duplicate resource ids remain'
log('trees', len(trees), 'rocks', len(rocks), 'seeds', len(seeds))

# ------------------------------------------------------------ terrain probe
def mesh_bvh(obj):
    ev = obj.evaluated_get(deps); me = ev.to_mesh()
    verts = [ev.matrix_world @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    mats = [(me.materials[p.material_index].name if me.materials and me.materials[p.material_index] else '') for p in me.polygons]
    tree = BVHTree.FromPolygons(verts, polys)
    zs = [v.z for v in verts]
    ev.to_mesh_clear()
    return tree, mats, (min(zs), max(zs))
terrain = bpy.data.objects['ENV_HW_TerrainGrid_1m']
sand = bpy.data.objects.get('ENV_HW_Sand_Shore')
water = bpy.data.objects['ENV_HW_Water']
t_bvh, t_mats, _ = mesh_bvh(terrain)
s_bvh, s_mats, _ = mesh_bvh(sand) if sand else (None, None, None)
water_level = sum((water.matrix_world @ v.co).z for v in water.data.vertices) / len(water.data.vertices)
log('water level', round(water_level, 3), 'previous', prev.get('waterLevel'))

UP = Vector((0, 0, -1)); TOP = 80.0
def probe(x, y):
    """-> (type, height): 0 water, 1 sand, 2 grass."""
    hit = t_bvh.ray_cast(Vector((x, y, TOP)), UP, 200)
    if hit[0] is not None:
        z = hit[0].z
        if z < water_level + 0.02:
            return 0, z
        return (1 if 'Beach' in t_mats[hit[2]] or 'Sand' in t_mats[hit[2]] else 2), z
    if s_bvh:
        hit = s_bvh.ray_cast(Vector((x, y, TOP)), UP, 200)
        if hit[0] is not None:
            z = hit[0].z
            return (1 if z >= water_level + 0.02 else 0), z
    return 0, None

# coarse pass to find the land extent
land = []
for y in range(-80, 100):
    for x in range(-80, 80):
        t, _ = probe(x + .5, y + .5)
        if t:
            land.append((x, y))
xs = [p[0] for p in land]; ys = [p[1] for p in land]
PAD = 2
origin = [min(xs) - PAD, min(ys) - PAD]
columns = max(xs) + PAD + 1 - origin[0]
rows = max(ys) + PAD + 1 - origin[1]
log('grid origin', origin, 'columns', columns, 'rows', rows, '| previous', prev.get('grid', {}).get('origin'), prev.get('grid', {}).get('columns'), prev.get('grid', {}).get('rows'))

mask = []
for r in range(rows):
    for c in range(columns):
        mask.append(probe(origin[0] + c + .5, origin[1] + r + .5)[0])
heights = []
fallback = water_level - 0.6
for r in range(rows + 1):
    for c in range(columns + 1):
        _, z = probe(origin[0] + c, origin[1] + r)
        heights.append(round(z if z is not None else fallback, 4))
from collections import Counter
log('mask', Counter(mask))

def cell_type(x, y):
    c = math.floor(x - origin[0]); r = math.floor(y - origin[1])
    return mask[r * columns + c] if 0 <= c < columns and 0 <= r < rows else 0
def key_at(x, y):
    return f'{math.floor(x - origin[0])}:{math.floor(y - origin[1])}'

# ------------------------------------------------------------------- data
species = prev.get('species', {})
tree_rows, dropped = [], []
for o in trees:
    sp = str(o['species_id'])
    if species and sp not in species:
        dropped.append((o.name, 'species ' + sp)); continue
    p = world_xy(o)
    if not cell_type(p[0], p[1]):
        dropped.append((o.name, 'in water')); continue
    e = o.matrix_world.to_euler(); sc = o.matrix_world.to_scale()
    tree_rows.append({'id': str(o['resource_id']), 'species': sp, 'position': [round(v, 5) for v in p],
                      'scale': [round(sc.x, 5), round(sc.y, 5), round(sc.z, 5)], 'yaw': round(e.z, 4),
                      'radius': round(float(o.get('collision_radius_m', .32)), 3)})
log('trees exported', len(tree_rows), 'dropped', len(dropped), dropped[:8])

seed_rows = []
for o in seeds:
    p = world_xy(o)
    if not cell_type(p[0], p[1]):
        dropped.append((o.name, 'seed in water')); continue
    seed_rows.append({'id': str(o['pickup_id']), 'itemId': str(o['item_id']), 'quantity': int(o.get('quantity', 1)),
                      'position': [round(v, 4) for v in p], 'radius': round(float(o.get('collect_radius_m', .85)), 3)})

prev_rocks = {b['id']: b for b in prev.get('boulders', [])}
rock_rows = []
for o in rocks:
    rid = str(o.get('resource_id') or o.name)
    p = world_xy(o)
    b, (z0, z1) = bbox(o)
    radius = float(o.get('collision_radius_m') or max(b[2] - b[0], b[3] - b[1]) / 2)
    row = {'id': rid, 'position': [round(v, 5) for v in p], 'radius': round(radius, 4)}
    old = prev_rocks.get(rid)
    if old:
        for k in ('deposit', 'homesteadRock', 'maxHealth', 'drops'):
            if k in old:
                row[k] = old[k]
    rock_rows.append(row)
missing_rocks = [r for r in prev_rocks if r not in {x['id'] for x in rock_rows}]
log('boulders', len(rock_rows), 'previous ids missing', missing_rocks)

blocker_rows = []
blocker_ids = [b['id'] for b in prev.get('blockers', [])]
blocker_ids += sorted(o.name for o in visible if re.fullmatch(r'ENV_HW_CliffFormation_\d+', o.name) and o.name not in blocker_ids)
for bid in blocker_ids:
    o = bpy.data.objects.get(bid)
    if not o or o.name not in vis_names:
        log('blocker gone', bid); continue
    b, _ = bbox(o)
    old = next((x for x in prev.get('blockers', []) if x['id'] == bid), None)
    row = {'id': bid, 'bounds': [round(v, 5) for v in b]}
    if old and old.get('polygon') and all(abs(a - c) < .05 for a, c in zip(old['bounds'], b)):
        row['polygon'] = old['polygon']
    blocker_rows.append(row)

# garden slots keep their world position, keys follow the new origin
po = prev.get('grid', {}).get('origin', [-40, -40])
garden = []
for s in prev.get('gardenSlots', []):
    x = s['col'] + po[0] + .5; y = s['row'] + po[1] + .5
    c = math.floor(x - origin[0]); r = math.floor(y - origin[1])
    garden.append({'key': f'{c}:{r}', 'col': c, 'row': r})

boundary = prev.get('boundary', [])
curve_key = scene.get('HW_coast_curve_active')
try:
    curve = json.loads(scene[curve_key]) if curve_key else None
    if curve and 'grass_radius' in curve:
        cx, cy = curve['center']; n = len(curve['grass_radius'])
        boundary = [[round(cx + rr * math.cos(2 * math.pi * i / n), 3), round(cy + rr * math.sin(2 * math.pi * i / n), 3)] for i, rr in enumerate(curve['grass_radius'])]
except Exception as e:
    log('coast curve unreadable', e)

hero = prev.get('heroStart', [0, 0, 0.15])
hero = [hero[0], hero[1], round(probe(hero[0], hero[1])[1] or hero[2], 4)]
fishing = prev.get('fishingSpots', [])
for s in fishing:
    s['position'][2] = round(probe(s['position'][0], s['position'][1])[1] or s['position'][2], 4)
    s['water'][2] = round(water_level, 4)
    log('fishing spot land/water types', cell_type(*s['position'][:2]), cell_type(*s['water'][:2]))
log('hero cell type', cell_type(hero[0], hero[1]))

world = {
    'id': prev.get('id', 'godlykids-homeworld-island-v1'),
    'grid': {'origin': origin, 'columns': columns, 'rows': rows, 'cellSize': 1, 'mask': mask, 'heights': heights},
    'boundary': boundary,
    'waterLevel': round(water_level, 4),
    'heroStart': hero,
    'trees': tree_rows, 'seeds': seed_rows, 'boulders': rock_rows, 'blockers': blocker_rows,
    'gardenSlots': garden,
    'assets': prev.get('assets', {}), 'species': species, 'seedItems': prev.get('seedItems', {}),
    'movedResources': [],
    'mining': prev.get('mining', {}),
    'fishingSpots': fishing,
    'source': {'blend': bpy.data.filepath, 'scene': scene.name},
}
json.dump(world, open(os.path.join(OUT, 'world.json'), 'w'), separators=(',', ':'))
log('wrote world.json')

# ------------------------------------------------------------------ GLB
skip_roots = set()
for o in visible:
    if is_tree(o) or is_seed(o) or o.name in ('RIG_HW_SeedPickups_ROOT',) or o.name.startswith(('HERO_HW_', 'RIG_HW_Adam', 'CAM_', 'LGT_')):
        skip_roots.add(o.name)
def skipped(o):
    while o:
        if o.name in skip_roots:
            return True
        o = o.parent
    return False
export = [o for o in visible if not skipped(o) and o.type in ('MESH', 'EMPTY')]
root = bpy.data.objects.get('GodlyKids_World_ROOT')
if root and root not in export:
    export.append(root)
if root:
    root['purpose'] = 'Expandable Godly Kids home-world. 1 Blender unit = 1 metre. UI is supplied by React.'
rock_names = {o.name for o in rocks}
assert rock_names <= {o.name for o in export}, 'every boulder must be in the GLB'
log('glb objects', len(export))

# Procedural base colours (noise/ramp/AO node chains) cannot become glTF factors;
# fall back to each material's viewport display colour, as the original export did.
flattened = 0
for mat in {slot.material for o in export if o.type == 'MESH' for slot in o.material_slots if slot.material}:
    if not mat.use_nodes:
        continue
    bsdf = next((n for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None)
    if not bsdf:
        continue
    base = bsdf.inputs['Base Color']
    if base.is_linked and base.links[0].from_node.bl_idname != 'ShaderNodeTexImage':
        mat.node_tree.links.remove(base.links[0])
        base.default_value = tuple(mat.diffuse_color)
        flattened += 1
log('materials flattened to display colour', flattened)

bpy.ops.object.select_all(action='DESELECT')
for o in export:
    o.select_set(True, view_layer=vl)
vl.objects.active = root or export[0]
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, 'environment.glb'), export_format='GLB', use_selection=True,
    export_extras=True, export_apply=True, export_animations=False, export_skins=False, export_morph=False,
    export_cameras=False, export_lights=False, export_yup=True, export_texcoords=True, export_normals=True,
    export_materials='EXPORT', export_image_format='AUTO', use_active_scene=True)

# The scene carries large tool-state custom properties; keep them out of the GLB.
import struct
path = os.path.join(OUT, 'environment.glb')
data = open(path, 'rb').read()
jlen = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + jlen])
for sc in gltf.get('scenes', []):
    sc.pop('extras', None)
assert gltf['scenes'][gltf.get('scene', 0)].get('nodes'), 'exported scene is empty'
body = json.dumps(gltf, separators=(',', ':')).encode()
body += b' ' * (-len(body) % 4)
rest = data[20 + jlen:]
out = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(body) + len(rest)) + struct.pack('<I4s', len(body), b'JSON') + body + rest
open(path, 'wb').write(out)
log('wrote environment.glb', os.path.getsize(path) // 1024, 'KB', 'scene nodes', len(gltf['scenes'][gltf.get('scene', 0)]['nodes']))
