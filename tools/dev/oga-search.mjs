// Dev helper: searches OpenGameArt and prints title, author, licenses, link
// and file names for each hit so candidates can be vetted before download.
//   node tools/dev/oga-search.mjs "<keywords>" [sfx|music] [max]
const [keys, kind = 'sfx', max = '14'] = process.argv.slice(2);
const type = kind === 'music' ? 12 : 13;
const UA = { 'User-Agent': 'Mozilla/5.0 (asset research script)' };
const url = `https://opengameart.org/art-search-advanced?keys=${encodeURIComponent(keys)}&field_art_type_tid%5B%5D=${type}&sort_by=count&sort_order=DESC&items_per_page=48`;
const html = await (await fetch(url, { headers: UA })).text();
const seen = new Set();
const hits = [];
for (const m of html.matchAll(/<span class="art-preview-title"><a href="(\/content\/[^"]+)">([^<]+)<\/a>/g)) {
  if (!seen.has(m[1])) { seen.add(m[1]); hits.push({ path: m[1], title: m[2] }); }
}
export async function describe(path) {
  const page = await (await fetch('https://opengameart.org' + path, { headers: UA })).text();
  const lic = [...page.matchAll(/class='license-name'>([^<]+)</g)].map((m) => m[1]);
  const author = (page.match(/Author:&nbsp;.*?<a href="\/users\/[^"]+">([^<]+)<\/a>/s) || [])[1];
  const files = [...page.matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+)"/g)].map((m) => m[1]);
  return { lic: [...new Set(lic)], author, files: [...new Set(files)] };
}
for (const h of hits.slice(0, Number(max))) {
  const d = await describe(h.path);
  console.log(`${h.title} | by ${d.author} | ${d.lic.join(', ')} | https://opengameart.org${h.path}\n     files: ${d.files.map((f) => decodeURIComponent(f.split('/').pop())).slice(0, 10).join(', ')}`);
}
