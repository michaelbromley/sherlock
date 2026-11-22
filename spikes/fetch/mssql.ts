import mssql from 'mssql';
const cfg = { server: '127.0.0.1', port: 51433, user: 'sa', password: 'Spike_Passw0rd!', database: 'master', options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 60000 };
const pool = await new mssql.ConnectionPool(cfg).connect();
const mem = () => Math.round(process.memoryUsage().rss / 1e6) + 'MB';
async function time(label: string, fn: () => Promise<any>) {
  const t = performance.now();
  try { const out = await fn(); console.log(label.padEnd(36), `${Math.round(performance.now() - t)}ms`.padStart(7), mem(), JSON.stringify(out)); }
  catch (e: any) { console.log(label.padEnd(36), 'ERROR', e.code ?? '', e.message.slice(0, 110)); }
}
function streamCapped(q: string, n = 201): Promise<any> {
  return new Promise((resolve, reject) => {
    const req: any = pool.request(); req.stream = true; req.arrayRowMode = true;
    let columns: any[] = []; const rows: any[] = []; let cancelled = false; let sets = 0;
    req.on('recordset', (cols: any) => { sets++; if (sets === 1) columns = cols; });
    req.on('row', (row: any) => { if (sets > 1 || cancelled) return; rows.push(row); if (rows.length === n) { cancelled = true; req.cancel(); } });
    req.on('error', (e: any) => { if (cancelled && e.code === 'ECANCEL') return; reject(e); });
    req.on('done', () => resolve({ rows: rows.length, cancelled, columns: columns.map((c: any) => `${c.name}:${c.type?.declaration ?? c.type?.name}`) }));
    req.query(q);
  });
}
await time('full fetch (today\'s adapter)', async () => (await pool.request().query('select * from events')).recordset.length);
await time('stream + cancel at 201', () => streamCapped('select * from events'));
await time('pool usable after cancel', async () => (await pool.request().query('select 1 as ok')).recordset[0]);
await time('stream dup + numeric names', () => streamCapped('select 1 as a, 2 as [2024], 3 as a'));
await time('stream zero rows', () => streamCapped('select id, body from events where 1=0'));
await time('stream ORDER BY + WITH (no rewrite)', () => streamCapped('with x as (select id from events) select id from x order by id desc'));
await time('stream EXEC sp_who', () => streamCapped('exec sp_who'));
await time('stream runtime error past row 201', () => streamCapped('select 1/(id-5000) as v from events order by id'));
await time('stream runtime error before 201', () => streamCapped('select 1/(id-50) as v from events order by id'));
await time('SET ROWCOUNT 201 in batch', async () => (await pool.request().query('set rowcount 201; select * from events')).recordset.length);
await time('request timeout still applies', () => { const p = new mssql.ConnectionPool({ ...cfg, requestTimeout: 500 }); return p.connect().then(async pp => { try { return await new Promise((res, rej) => { const r: any = pp.request(); r.stream = true; r.on('error', rej); r.on('done', res); r.query("waitfor delay '00:00:02'; select 1"); }); } finally { await pp.close(); } }); });
await pool.close();
