// lib/sheets.ts
type RowObj = Record<string, string>;

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v.trim();
}

function normalizeRange(rawRange: string) {
  // Accept "<tab>!A1:Z999" and auto-quote tab only if needed
  const m = rawRange.trim().match(/^([^!]+)!(.+)$/);
  if (!m) throw new Error("GOOGLE_SHEETS_RANGE must look like <tab>!A1:Z1000");
  let [_, tab, cells] = m;
  if (!tab.startsWith("'") && /[^A-Za-z0-9_]/.test(tab)) tab = `'${tab}'`;
  return `${tab}!${cells}`;
}

export async function fetchSheetRows(): Promise<RowObj[]> {
  const id = mustEnv("GOOGLE_SHEETS_ID");
  const apiKey = mustEnv("GOOGLE_SHEETS_API_KEY");
  const range = normalizeRange(mustEnv("GOOGLE_SHEETS_RANGE"));

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}`;
  const url = `${base}?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Google Sheets API error: ${res.status} ${res.statusText}\n` +
      `URL: ${url}\n` +
      `Range: ${range}\n` +
      `Body: ${body}`
    );
  }

  const data = (await res.json()) as { values?: string[][] };
  if (!data.values || data.values.length === 0) return [];

  const [header, ...rows] = data.values;
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export async function getBusinessBySlug(slug: string) {
  const rows = await fetchSheetRows();
  const target = slug.trim().toLowerCase();
  return rows.find((r) => (r.slug || "").trim().toLowerCase() === target) ?? null;
}
