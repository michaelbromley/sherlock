import { SQL } from 'bun';
import mysql from 'mysql2/promise';
const mem = () => Math.round(process.memoryUsage().rss / 1e6) + 'MB';
async function time(label: string, fn: () => Promise<any>) {
  const t = performance.now();
  try { const out = await fn(); console.log(label.padEnd(44), `${Math.round(performance.now() - t)}ms`.padStart(7), mem(), JSON.stringify(out)); }
  catch (e: any) { console.log(label.padEnd(44), 'ERROR', e.code ?? '', e.message.slice(0, 100)); }
}
console.log('--- Bun.SQL (one-connection pool, as production)');
const b = new SQL('mysql://root:password@127.0.0.1:53306/spike', { max: 1, allowPublicKeyRetrieval: true } as any);
const single = (q: string) => (b as any)(Object.assign([q], { raw: [q] }));
const ro = async <T>(limit: number | null, fn: () => Promise<T>) => {
  await b.unsafe('SET SESSION max_execution_time = 60000');
  await b.unsafe(`SET SESSION sql_select_limit = ${limit ?? 'DEFAULT'}`);
  await b.unsafe('START TRANSACTION READ ONLY');
  try { return await fn(); } finally { await b.unsafe('ROLLBACK'); await b.unsafe('SET SESSION sql_select_limit = DEFAULT'); }
};
await time('DECLARE outside a procedure', () => single('DECLARE c CURSOR FOR select 1'));
await time('full fetch select *', () => ro(null, async () => (await single('select * from events').values()).length));
await time('sql_select_limit=201 select *', () => ro(201, async () => (await single('select * from events').values()).length));
await time('limit=201, WITH + UNION', () => ro(201, async () => (await single('with x as (select id from events) select id from x union all select id from x').values()).length));
await time('limit=201, user LIMIT 1000 wins', () => ro(201, async () => (await single('select id from events limit 1000').values()).length));
await time('limit=201, subquery not limited', () => ro(201, async () => (await single('select count(*) from (select id from events) t').values())[0]));
await time('limit=201, SHOW not limited', () => ro(201, async () => (await single('show variables').values()).length));
await time('limit=3, SHOW too?', () => ro(3, async () => (await single('show variables').values()).length));
await time('limit applies to injected 2nd stmt?', () => ro(201, () => single('select 1; select 2')));
await b.close();

console.log('--- mysql2');
const c = await mysql.createConnection({ uri: 'mysql://root:password@127.0.0.1:53306/spike', rowsAsArray: true });
const desc = (fields: any[]) => fields.map((f: any) => `${f.name}:${f.columnType}/${f.type}`);
await c.query('SET SESSION sql_select_limit = 201');
await time('execute select * (prepared)', async () => { const [rows, fields] = await c.execute('select * from events'); return { rows: (rows as any).length, cols: desc(fields as any) }; });
await time('execute dup + numeric names', async () => { const [rows, fields] = await c.execute('select 1 as a, 2 as `2024`, 3 as a'); return { rows, cols: desc(fields as any) }; });
await time('execute zero rows', async () => { const [rows, fields] = await c.execute('select id, body from events where false'); return { rows: (rows as any).length, cols: desc(fields as any) }; });
await time('execute SHOW', async () => { const [rows, fields] = await c.execute('show variables like "version"'); return { rows, cols: desc(fields as any) }; });
await time('execute injected 2nd stmt', () => c.execute('select 1; delete from events'));
await time('query injected 2nd stmt (no multi)', () => c.query('select 1; delete from events'));
await c.end();
