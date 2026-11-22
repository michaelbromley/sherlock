import { Database } from 'bun:sqlite';
import { SQL } from 'bun';
const file = `./events.db`;
{ const w = new Database(file, { create: true });
  w.run('drop table if exists events'); w.run('create table events (id integer primary key, body text, payload json, bin blob, amount numeric, at datetime)');
  w.run(`with recursive g(n) as (select 1 union all select n+1 from g where n < 100000) insert into events select n, printf('%.2000c', 'x'), json_object('g', n), randomblob(500), n * 1.5, datetime('now') from g`); w.close(); }
const mem = () => Math.round(process.memoryUsage().rss / 1e6) + 'MB';
function time(label: string, fn: () => any) { const t = performance.now(); return Promise.resolve().then(fn).then(out => console.log(label.padEnd(40), `${Math.round(performance.now() - t)}ms`.padStart(7), mem(), JSON.stringify(out)), (e: any) => console.log(label.padEnd(40), 'ERROR', e.code ?? '', e.message.slice(0, 100))); }

console.log('--- Bun.SQL sqlite (as production)');
const b = new SQL(`sqlite://${file}`);
await time('full fetch values()', async () => { const r: any = await b.unsafe('select * from events').values(); return { rows: r.length, keys: Object.keys(r).filter(k => isNaN(+k)) }; });
await b.close();

console.log('--- bun:sqlite');
const db = new Database(file, { readonly: true });
await time('columnNames/declaredTypes before run', () => { const s = db.prepare('select *, 1 as id, amount * 2 as x from events'); return { names: s.columnNames, declared: s.declaredTypes }; });
await time('iterate() stop after 201', () => { const s = db.prepare('select * from events'); let n = 0; for (const _ of s.iterate()) if (++n === 201) break; return n; });
await time('iterate() row shape on dup names', () => { const s = db.prepare('select 1 as a, 2 as "2024", 3 as a'); return [...s.iterate()][0]; });
await time('values() all rows (arrays)', () => db.prepare('select * from events').values().length);
await time('zero rows: names still known', () => db.prepare('select id, body from events where 0').columnNames);
await time('prepare refuses 2nd statement?', () => { const s = db.prepare('select 1; delete from events'); return { ran: s.all(), count: db.query('select count(*) as n from events').get() }; });
await time('readonly refuses writes', () => db.run('delete from events'));
await time('blob type', () => { const v: any = db.prepare('select bin from events limit 1').values()[0][0]; return v?.constructor?.name; });
