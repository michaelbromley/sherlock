import { SQL } from 'bun';
const sql = new SQL('postgres://postgres:password@127.0.0.1:55432/postgres');
const single = (s: any, q: string) => s(Object.assign([q], { raw: [q] }));
async function wrapped<T>(fn: (r: any) => Promise<T>): Promise<T> {
  const r = await sql.reserve();
  try { await r.unsafe('BEGIN TRANSACTION READ ONLY'); await r.unsafe('SET LOCAL statement_timeout = 60000'); return await fn(r); }
  finally { await r.unsafe('ROLLBACK').catch(() => {}); r.release(); }
}
const mem = () => Math.round(process.memoryUsage().rss / 1e6) + 'MB';
async function time(label: string, fn: () => Promise<any>) {
  const t = performance.now();
  try { const out = await fn(); console.log(label.padEnd(42), `${Math.round(performance.now() - t)}ms`.padStart(8), mem(), out); }
  catch (e: any) { console.log(label.padEnd(42), 'ERROR', e.code ?? '', e.message.slice(0, 110)); }
}
const cursor = (q: string, n = 201) => wrapped(async r => { await single(r, `DECLARE sherlock_c NO SCROLL CURSOR FOR ${q}`); const rows = await single(r, `FETCH ${n} FROM sherlock_c`).values(); return { rows: rows.length, cmd: rows.command }; });
await time('full fetch select * from events', () => wrapped(async r => (await single(r, 'select * from events').values()).length));
await time('cursor select * from events', () => cursor('select * from events'));
await time('cursor WITH', () => cursor('with x as (select id from events) select * from x'));
await time('cursor VALUES', () => cursor('values (1),(2)'));
await time('cursor TABLE events', () => cursor('table events'));
await time('cursor trailing semicolon', () => cursor('select 1;'));
await time('cursor trailing ; and comment', () => cursor('select 1; -- done'));
await time('cursor injected 2nd stmt', () => cursor('select 1; delete from events'));
await time('cursor SHOW', () => cursor('show server_version'));
await time('cursor EXPLAIN', () => cursor('explain select 1'));
await time('cursor dup names', () => wrapped(async r => { await single(r, 'DECLARE c CURSOR FOR select 1 as a, 2 as a'); return (await single(r, 'FETCH 5 FROM c').values())[0]; }));
await time('cursor bad column -> error surfaces at DECLARE?', () => cursor('select nope from events'));
await time('cursor runtime error after first rows', () => cursor('select 1/(id-150) from events order by id', 201));
await time('cursor + write via CTE (read-only txn)', () => cursor('with d as (delete from events where id=1 returning *) select * from d'));
await time('cursor statement_timeout honoured', () => wrapped(async r => { await r.unsafe('SET LOCAL statement_timeout = 500'); await single(r, 'DECLARE c CURSOR FOR select pg_sleep(2)'); return (await single(r, 'FETCH 1 FROM c').values()).length; }));
await sql.close();
