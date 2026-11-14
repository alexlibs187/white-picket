// Downloads CC0 textures and an HDRI from Poly Haven (https://polyhaven.com) into web/assets/
// and writes web/assets/manifest.json. Runs in GitHub Actions at build time (Node 20+).
// Powered by Poly Haven — all assets are CC0 (public domain).
import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://api.polyhaven.com';
const OUT = new URL('../web/assets/', import.meta.url);
const UA = { 'User-Agent': 'white-picket-build (github.com/alexlibs187/white-picket)' };

// Candidate ids per slot (first that exists wins), then a category search as a fallback.
const SLOTS = {
  grass:    { ids: ['leafy_grass', 'grass_path_2', 'aerial_grass_rock', 'forrest_ground_01'], cats: ['grass', 'terrain'] },
  road:     { ids: ['asphalt_02', 'asphalt_track', 'asphalt_pit_lane', 'asphalt_01'], cats: ['asphalt', 'road'] },
  side:     { ids: ['concrete_pavement', 'concrete_tiles', 'concrete_floor_02', 'patterned_concrete_pavers'], cats: ['concrete'] },
  concrete: { ids: ['concrete_floor_02', 'concrete_floor_worn_001', 'concrete_slab_wall'], cats: ['concrete'] },
  siding:   { ids: ['white_planks_clean', 'painted_planks', 'wood_planks_grey', 'weathered_planks'], cats: ['planks', 'wood'] },
  roof:     { ids: ['roof_tiles_14', 'roof_09', 'clay_roof_tiles', 'roof_slates_02'], cats: ['roofing'] },
  floor:    { ids: ['laminate_floor_02', 'wood_floor', 'wooden_floor_02', 'diagonal_parquet'], cats: ['floor'] },
  wall:     { ids: ['painted_plaster_wall', 'beige_wall_001', 'plastered_wall', 'white_plaster_02'], cats: ['plaster'] }
};
const HDRI = { ids: ['kloofendal_48d_partly_cloudy_puresky', 'venice_sunset', 'evening_road_01_puresky', 'kloppenheim_06_puresky', 'qwantani_puresky'], cats: ['outdoor', 'sunrise-sunset'] };

async function get(url) { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r; }
const json = async url => (await get(url)).json();

function urls(obj, out = []) {
  if (obj && typeof obj === 'object') { if (typeof obj.url === 'string') out.push(obj.url); for (const k in obj) urls(obj[k], out); }
  return out;
}
const pickUrl = (list, re) => list.find(u => re.test(u));

async function resolve(slot, type) {
  const tried = new Set();
  const attempt = async id => {
    if (tried.has(id)) return null; tried.add(id);
    try { const files = await json(`${API}/files/${id}`); return { id, files }; } catch { return null; }
  };
  for (const id of slot.ids) { const r = await attempt(id); if (r) return r; }
  for (const cat of slot.cats) {
    try {
      const list = await json(`${API}/assets?type=${type}&categories=${cat}`);
      const ids = Object.entries(list).sort((a, b) => (b[1].download_count || 0) - (a[1].download_count || 0)).map(e => e[0]);
      for (const id of ids.slice(0, 5)) { const r = await attempt(id); if (r) return r; }
    } catch { /* next */ }
  }
  return null;
}

async function save(url, name) {
  const buf = Buffer.from(await (await get(url)).arrayBuffer());
  await writeFile(new URL(name, OUT), buf); return 'assets/' + name;
}

await mkdir(OUT, { recursive: true });
const manifest = { credit: 'Textures et HDRI : Poly Haven (CC0)', textures: {} };
for (const [slot, def] of Object.entries(SLOTS)) {
  try {
    const r = await resolve(def, 'textures'); if (!r) { console.log(`- ${slot}: aucun asset`); continue; }
    const all = urls(r.files);
    const diff = pickUrl(all, /_(diff|diffuse|col|color)_1k\.jpg$/i);
    const nor = pickUrl(all, /_nor_gl_1k\.jpg$/i);
    const rough = pickUrl(all, /_rough_1k\.jpg$/i);
    if (!diff) { console.log(`- ${slot}: ${r.id} sans diffuse 1k`); continue; }
    let size = 2;
    try { const info = await json(`${API}/info/${r.id}`); if (info.dimensions) size = Math.max(info.dimensions[0], info.dimensions[1]) / 1000 || 2; } catch {}
    const e = { id: r.id, size, diff: await save(diff, `${slot}_diff.jpg`) };
    if (nor) e.nor = await save(nor, `${slot}_nor.jpg`);
    if (rough) e.rough = await save(rough, `${slot}_rough.jpg`);
    manifest.textures[slot] = e; console.log(`+ ${slot}: ${r.id} (${size} m)`);
  } catch (err) { console.log(`! ${slot}: ${err.message}`); }
}
try {
  const r = await resolve(HDRI, 'hdris');
  if (r) { const u = pickUrl(urls(r.files), /_1k\.hdr$/i); if (u) { manifest.hdri = await save(u, 'sky_1k.hdr'); manifest.hdriId = r.id; console.log(`+ hdri: ${r.id}`); } }
} catch (err) { console.log(`! hdri: ${err.message}`); }

// ---------- 3D models: Poly Haven (CC0) + Khronos glTF sample assets (CC0 / CC BY 4.0) ----------
// slot or slot@house -> source. The game falls back to slot when slot@house is absent.
const MODELS = {
  sofa: { ph: 'sofa_02' }, 'sofa@0': { ph: 'sofa_02' }, 'sofa@1': { ph: 'Sofa_01' }, 'sofa@3': { ph: 'sofa_03' }, 'sofa@4': { khr: 'GlamVelvetSofa' },
  armchair: { ph: 'modern_arm_chair_01' }, 'armchair@1': { ph: 'ArmChair_01' }, 'armchair@3': { ph: 'ArmChair_01' }, 'armchair@4': { khr: 'SheenChair' },
  coffee: { ph: 'coffee_table_round_01' }, 'coffee@3': { ph: 'CoffeeTable_01' },
  table: { ph: 'wooden_table_02' }, chair: { ph: 'painted_wooden_chair_01' }, 'chair@3': { ph: 'dining_chair_02' },
  shelf: { ph: 'Shelf_01' }, bed: { ph: 'vintage_day_bed' }, plant: { ph: 'potted_plant_04' }, 'plant@1': { ph: 'potted_plant_02' }, 'plant@4': { khr: 'DiffuseTransmissionPlant' },
  chandelier: { ph: 'Chandelier_02' }, 'chandelier@3': { ph: 'Chandelier_01' },
  vaseflowers: { khr: 'GlassVaseFlowers' }, vase: { ph: 'antique_ceramic_vase_01' }, 'vase@4': { ph: 'ceramic_vase_01' },
  frame: { ph: 'fancy_picture_frame_01' }, 'frame@3': { ph: 'fancy_picture_frame_02' },
  clock: { ph: 'mantel_clock_01' }, lantern: { ph: 'Lantern_01' }, pendant: { ph: 'modern_ceiling_lamp_01' },
  tablelamp: { khr: 'IridescenceLamp' }, pouf: { khr: 'SpecularSilkPouf' }, nightstand: { ph: 'ClassicNightstand_01' }
};
const KHR = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/';
function findGltf(files) {
  const g = files.gltf; if (!g) return null;
  const res = g['1k'] || g['2k'] || Object.values(g)[0]; if (!res) return null;
  return res.gltf || Object.values(res)[0];
}
manifest.models = {}; manifest.credits = [];
const cache = {};
await mkdir(new URL('models/', OUT), { recursive: true });
for (const [slot, def] of Object.entries(MODELS)) {
  const key = def.ph ? 'ph:' + def.ph : 'khr:' + def.khr;
  try {
    if (!cache[key]) {
      const dir = `models/${(def.ph || def.khr).toLowerCase()}/`; await mkdir(new URL(dir, OUT), { recursive: true });
      if (def.ph) {
        const files = await json(`${API}/files/${def.ph}`), info = await json(`${API}/info/${def.ph}`); const g = findGltf(files); if (!g) throw new Error('pas de glTF');
        const name = g.url.split('/').pop(); await save(g.url, dir + name);
        for (const [rel, f] of Object.entries(g.include || {})) { const sub = new URL(dir + rel, OUT); await mkdir(new URL('.', sub), { recursive: true }); await writeFile(sub, Buffer.from(await (await get(f.url)).arrayBuffer())); }
        cache[key] = { id: def.ph, gltf: 'assets/' + dir + name, polycount: info.polycount || 0 };
        manifest.credits.push({ what: info.name || def.ph, authors: Object.keys(info.authors || {}).join(', '), license: 'CC0', src: 'Poly Haven', url: `https://polyhaven.com/a/${def.ph}` });
      } else {
        const meta = await json(`${KHR}${def.khr}/metadata.json`); const name = def.khr + '.glb'; await save(`${KHR}${def.khr}/glTF-Binary/${name}`, dir + name);
        cache[key] = { id: def.khr, gltf: 'assets/' + dir + name };
        for (const l of meta.legal || []) manifest.credits.push({ what: `${def.khr} (${l.what || ''})`, authors: [l.artist, l.owner].filter(x => x && x !== 'Public' && x !== 'Public domain').join(' / '), license: (l.license || '').replace('-1.0', '').replace('-4.0', ' 4.0'), src: 'Khronos glTF Sample Assets', url: `https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/${def.khr}` });
      }
    }
    manifest.models[slot] = cache[key]; console.log(`+ model ${slot}: ${cache[key].id}`);
  } catch (err) { console.log(`! model ${slot}: ${err.message}`); }
}
await writeFile(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2));
console.log(`Manifest: ${Object.keys(manifest.textures).length} textures, ${Object.keys(manifest.models || {}).length} modèles, hdri: ${manifest.hdri ? 'oui' : 'non'}`);
