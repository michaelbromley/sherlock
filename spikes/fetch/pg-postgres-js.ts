import postgres from 'postgres';
const sql = postgres('postgres://postgres:password@127.0.0.1:55432/postgres', { max: 1, onnotice: () => {} });
const mem = () => Math.round(process.memoryUsage().rss / 1e6) + 'MB';
async function time(label: string, fn: () => Promise<any>) {
  const t = performance.now();
  try { const out = await fn(); console.log(label.padEnd(36), `${Math.round(performance.now() - t)}ms`.padStart(7), mem(), JSON.stringify(out)); }
  catch (e: any) { console.log(label.padEnd(36), 'ERROR', e.code ?? '', e.message.slice(0, 100)); }
}
async function ro<T>(fn: (r: any) => Promise<T>) {
  const r = await sql.reserve();
  try { await r.unsafe('BEGIN TRANSACTION READ ONLY'); await r.unsafe('SET LOCAL statement_timeout = 60000'); return await fn(r); }
  finally { await r.unsafe('ROLLBACK').catch(() => {}); r.release(); }
}
// Stop after n rows with the protocol's own row limit (Execute maxRows), no DECLARE
async function capped(r: any, q: string, n = 201) {
  let rows: any[] = [], columns: any;
  for await (const chunk of r.unsafe(q).values().cursor(n)) { rows = chunk; columns = chunk.columns; break; }
  if (!columns) { const res = await r.unsafe(q).values(); columns = res.columns; rows = res; } // zero rows: cursor yields nothing
  return { rows: rows.length, columns: columns?.map((c: any) => `${c.name}:${c.type}`) };
}
await time('full fetch, columns', () => ro(async r => { const res = await r.unsafe('select * from events').values(); return { rows: res.length, columns: res.columns.map((c: any) => c.name) }; }));
await time('cursor(201) select *', () => ro(r => capped(r, 'select * from events')));
await time('cursor dup + numeric names', () => ro(r => capped(r, 'select 1 as a, 2 as "2024", 3 as a')));
await time('cursor zero rows', () => ro(r => capped(r, 'select id, body from events where false')));
await time('cursor SHOW', () => ro(r => capped(r, 'show server_version')));
await time('cursor EXPLAIN', () => ro(r => capped(r, 'explain select * from events')));
await time('cursor injected 2nd stmt', () => ro(r => capped(r, 'select 1; delete from events')));
await time('cursor write in ro txn', () => ro(r => capped(r, 'with d as (delete from events where id=1 returning id) select * from d')));
await time('describe() only, zero cost', () => ro(async r => { const d = await r.unsafe('select 1 as a, 2 as a, now() as t').describe(); return d.columns.map((c: any) => c.name + ':' + c.type); }));
await time('type names for OIDs', () => sql`select oid::int, typname from pg_type where oid = any(${[23, 25, 3802, 17, 1700, 1184]})`.then(r => r.map((x: any) => x.typname)));
await sql.end();
