// Seeds a 100,000-row table with wide text, JSON and binary columns on the
// throwaway PostgreSQL and MySQL containers (see README.md).
import { SQL } from 'bun';

const pg = new SQL('postgres://postgres:password@127.0.0.1:55432/postgres');
await pg.unsafe(`drop table if exists events;
create table events (id int primary key, body text, payload jsonb, blob bytea, amount numeric(12,2), at timestamptz);
insert into events select g, repeat('x', 2000), jsonb_build_object('g', g), decode(repeat('ab', 500), 'hex'), g * 1.5, now()
from generate_series(1, 100000) g;`).simple();
console.log('pg seeded', (await pg`select count(*)::int as n from events`)[0]);
await pg.close();

const my = new SQL('mysql://root:password@127.0.0.1:53306/spike', { max: 1, allowPublicKeyRetrieval: true } as any);
await my.unsafe('drop table if exists events');
await my.unsafe('create table events (id int primary key, body text, payload json, bin blob, amount decimal(12,2), at datetime)');
await my.unsafe('set session cte_max_recursion_depth = 200000');
await my.unsafe(`insert into events with recursive g(n) as (select 1 union all select n+1 from g where n < 100000)
select n, repeat('x', 2000), json_object('g', n), unhex(repeat('ab', 500)) as bin, n * 1.5, now() from g`);
console.log('mysql seeded', (await my.unsafe('select count(*) as n from events'))[0]);
await my.close();
