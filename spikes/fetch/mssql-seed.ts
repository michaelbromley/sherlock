import mssql from 'mssql';
const cfg = { server: '127.0.0.1', port: 51433, user: 'sa', password: 'Spike_Passw0rd!', database: 'master', options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 300000 };
let pool;
for (let i = 0; i < 40; i++) { try { pool = await new mssql.ConnectionPool(cfg).connect(); break; } catch { await Bun.sleep(3000); } }
if (!pool) throw new Error('mssql never came up');
await pool.request().batch(`if object_id('events') is not null drop table events;
create table events (id int primary key, body nvarchar(max), payload nvarchar(max), bin varbinary(max), amount decimal(12,2), at datetime2);
with g as (select top 100000 row_number() over (order by (select null)) n from sys.all_objects a cross join sys.all_objects b)
insert into events select n, replicate(cast('x' as nvarchar(max)), 2000), concat('{"g":', n, '}'), cast(replicate(cast(0xab as varbinary(max)), 500) as varbinary(max)), n * 1.5, sysdatetime() from g;`);
console.log((await pool.request().query('select count(*) n from events')).recordset[0]);
await pool.close();
