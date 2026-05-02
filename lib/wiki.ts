async function fromWikipediaSummary(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'salon-quiz/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.originalimage?.source || data?.thumbnail?.source || null;
}

async function fromCommonsSearch(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '800',
    format: 'json',
    origin: '*',
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'salon-quiz/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages || typeof pages !== 'object') return null;

  type Candidate = { url: string; width: number };
  const candidates: Candidate[] = [];
  for (const id of Object.keys(pages)) {
    const info = pages[id]?.imageinfo?.[0];
    if (!info) continue;
    const mime: string = info.mime || '';
    if (!mime.startsWith('image/')) continue;
    if (mime === 'image/svg+xml') continue;
    const width: number = info.thumbwidth || info.width || 0;
    if (width < 300) continue;
    const u: string | undefined = info.thumburl || info.url;
    if (u) candidates.push({ url: u, width });
  }
  if (!candidates.length) return null;
  // prefer width closest to 800
  candidates.sort((a, b) => Math.abs(a.width - 800) - Math.abs(b.width - 800));
  return candidates[0].url;
}

export async function fetchWikiImage(query: string): Promise<string | null> {
  if (!query) return null;
  try {
    const fromWp = await fromWikipediaSummary(query);
    if (fromWp) return fromWp;
  } catch {}
  try {
    const fromCm = await fromCommonsSearch(query);
    if (fromCm) return fromCm;
  } catch {}
  return null;
}
