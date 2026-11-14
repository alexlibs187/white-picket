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

// ---------- 3D models (CC0) ----------
const MODELS = {
  sofa:     { re: /sofa|couch/i, max: 80000 },
  armchair: { re: /arm_?chair/i, max: 60000 },
  coffee:   { re: /coffee_?table/i, max: 40000 },
  table:    { re: /table/i, not: /coffee|side|bedside|night|desk|tennis|pool|picnic|garden/i, max: 50000 },
  chair:    { re: /(^|_)(dining_)?chair(_\d+)?$/i, not: /arm|rocking|office|high|sofa|bar|wheel|garden|plastic|stool|set|table|outdoor|lounge|century|deck|folding|camp|beach/i, max: 30000 },
  shelf:    { re: /book_?(shelf|case)|shelf/i, not: /wall_shelf|spice/i, max: 60000 },
  bed:      { re: /(^|_)bed($|_)/i, not: /bedside|flower/i, max: 80000 },
  plant:    { re: /potted|houseplant|pot_?plant/i, max: 40000 }
};
function findGltf(files) {
  const g = files.gltf; if (!g) return null;
  const res = g['1k'] || g['2k'] || Object.values(g)[0]; if (!res) return null;
  return res.gltf || Object.values(res)[0];
}
try {
  const list = await json(`${API}/assets?type=models`);
  const entries = Object.entries(list).sort((a, b) => (b[1].download_count || 0) - (a[1].download_count || 0));
  manifest.models = {};
  await mkdir(new URL('models/', OUT), { recursive: true });
  for (const [slot, def] of Object.entries(MODELS)) {
    let done = false;
    for (const [id, a] of entries) {
      if (done) break;
      const hay = id;
      if (!def.re.test(hay) || (def.not && def.not.test(hay))) continue;
      const poly = a.polycount || 0;
      if (poly && poly > def.max) continue;
      try {
        const files = await json(`${API}/files/${id}`); const g = findGltf(files); if (!g || !g.url) continue;
        const dir = `models/${slot}/`; await mkdir(new URL(dir, OUT), { recursive: true });
        const name = g.url.split('/').pop();
        await save(g.url, dir + name);
        for (const [rel, f] of Object.entries(g.include || {})) {
          const sub = new URL(dir + rel, OUT); await mkdir(new URL('.', sub), { recursive: true });
          await writeFile(sub, Buffer.from(await (await get(f.url)).arrayBuffer()));
        }
        manifest.models[slot] = { id, gltf: 'assets/' + dir + name, polycount: poly };
        console.log(`+ model ${slot}: ${id} (${poly} polys)`); done = true;
      } catch (err) { console.log(`! model ${slot} ${id}: ${err.message}`); }
    }
    if (!done) console.log(`- model ${slot}: aucun`);
  }
} catch (err) { console.log(`! models: ${err.message}`); }
await writeFile(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2));
console.log(`Manifest: ${Object.keys(manifest.textures).length} textures, ${Object.keys(manifest.models || {}).length} modèles, hdri: ${manifest.hdri ? 'oui' : 'non'}`);
