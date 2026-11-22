# Fetch spike: stopping at maxRows + 1, and column metadata

Step 4 of the 2.0 CLI contract. Each driver was run against a 100,000-row table
with a 2,000-character text column, JSON, a 500-byte binary column, a decimal
and a timestamp. Measured on 2026-11-22 with Bun 1.4.0, on an Apple Silicon Mac,
against local containers. Times are wall-clock for one run.

**Result: every database can stop early, but Bun.SQL reports no column
metadata, so PostgreSQL and MySQL cannot meet "columns come from the driver"
while they run on Bun.SQL.**

| Database   | Stop after 201 rows                                      | Full fetch | Capped | Column names and types                                 |
| ---------- | -------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------ |
| PostgreSQL | Bun.SQL: `DECLARE … CURSOR` + `FETCH 201`                | 1,183 ms   | 4 ms   | Bun.SQL: none                                          |
| PostgreSQL | `postgres` (npm): `.cursor(201)`, the protocol row limit | 1,242 ms   | 5 ms   | Names, order, duplicates, type OIDs; also on zero rows |
| MySQL      | `SET SESSION sql_select_limit = 201`, either driver      | 1,075 ms   | 4 ms   | Bun.SQL: none. `mysql2`: names, order, type codes      |
| SQL Server | `mssql` stream, `request.cancel()` at row 201            | 2,028 ms   | 16 ms  | Names, order, duplicates, type names; also on zero rows |
| SQLite     | `bun:sqlite` `iterate()`, stopped at row 201             | 145 ms     | 1 ms   | `columnNames` before running; `declaredTypes`          |

## Bun.SQL has no column metadata

A Bun.SQL result is an array with `count`, `command`, `lastInsertRowid` and
`affectedRows`, and nothing else, in objects mode, `.values()` mode and
`.raw()` mode. The design assumed "results carry columns"; they do not.

- Objects mode loses columns: `select 1 as a, 2 as "2024", 3 as a` gives
  `{"2024": 2, "a": 3}`. The duplicate is merged and `2024` moves first.
- `.values()` keeps every value in order, but has no names.
- A zero-row result has no columns at all.

There is no query-level way round it on PostgreSQL. Temporary views are refused
in a read-only transaction, `pg_prepared_statements` gives types but not names,
and wrapping the query is ruled out by the design.

## PostgreSQL

**Bun.SQL with a cursor.** `DECLARE sherlock_c NO SCROLL CURSOR FOR <query>`,
sent through the existing single-statement (prepared) path inside the
read-only transaction, then `FETCH 201`:

- Works for `SELECT`, `WITH`, `VALUES` and `TABLE`, with or without a trailing
  `;` or comment.
- `select 1; delete from events` is still refused: "cannot insert multiple
  commands into a prepared statement".
- `statement_timeout` still cancels it.
- `SHOW` and `EXPLAIN` cannot be declared (syntax error), so they would need
  statement-type detection and a full fetch.
- A data-modifying `WITH` is refused by `DECLARE` itself.

This stops early but still gives no column names.

**The `postgres` package** (porsager/postgres 4.1.1, the library Bun.SQL was
ported from). `sql.unsafe(q).values().cursor(201)` uses the protocol's own row
limit on the portal (Execute with a maximum row count):

- Stops every row-returning statement, including `SHOW` and `EXPLAIN`, with no
  `DECLARE` and no statement-type detection.
- `result.columns` gives `name` and `type` (an OID) in the order the server
  sends them, with duplicates and numeric names intact.
- Zero rows: the cursor yields nothing, so the columns come from a second run
  or from `.describe()`, which costs one round trip and runs nothing.
- `unsafe` without parameters uses the extended protocol, so a second statement
  is refused as it is today.
- The read-only transaction behaves the same (`25006` for a write).
- OIDs map to type names with one `pg_type` lookup per result, or a static
  table for the built-in types.

## MySQL

There is no cursor outside stored procedures: `DECLARE` is a syntax error, as
expected.

`sql_select_limit`, a session variable, stops the server after N rows without
touching the query. It can be set beside `max_execution_time` in the read-only
wrapper, which already sets session variables on sherlock's own connection.

- Works with Bun.SQL and `mysql2`, through prepared statements, for `WITH` and
  `UNION`, and for `SHOW` (MySQL 8 answers `SHOW` from `information_schema`).
- An explicit `LIMIT` in the query wins: `limit 1000` returns 1,000 rows,
  which sherlock then cuts. The fetch is bounded by the user's own limit, but is
  more than maxRows + 1.
- It does not limit subqueries, which is what a row cap wants.
- It must be reset (`= DEFAULT`) after the statement, as the timeout is.

So MySQL needs no `FETCHED_ALL_ROWS` fallback, against the design's
expectation.

`mysql2` 3.24.6 returns `fields` with `name` and a numeric `columnType`, in
order, with duplicates, and on zero rows. `execute()` and `query()` both refuse
a second statement. TEXT and BLOB share a type code; the binary flag or
character set 63 tells them apart. Type names need a small code-to-name table.

## SQL Server

The design's plan works as written. With `request.stream = true` and
`request.arrayRowMode = true`:

- The `recordset` event gives every column's name and `type.declaration`
  (`int`, `nvarchar`, `varbinary`, `datetime2`), with duplicates, on zero rows.
- `request.cancel()` at row 201 ends the request; the cancel arrives as an
  `ECANCEL` error, which is expected and ignored. The pool is usable after it.
- No rewrite: `WITH … ORDER BY` and `EXEC sp_who` stream as sent.
- A runtime error in a row after the cut is never reached; one before it is
  reported (`Divide by zero`).
- The request timeout still applies (`ETIMEOUT`).

`SET ROWCOUNT 201` in the same batch also works (6 ms), but means sending
sherlock's own statement in the user's batch, so the stream is preferred.

## SQLite

Production opens SQLite through Bun.SQL, which has the same missing metadata.
`bun:sqlite`, opened `readonly`, has what is needed except an array iterator:

- `stmt.columnNames` is known before the statement runs, in order, with
  duplicates, including on zero rows.
- `stmt.declaredTypes` is available after the first step (`INTEGER`, `TEXT`;
  `null` for expressions, so `type` is left out there).
- `iterate()` stops after 201 rows in 1 ms, but yields objects, so duplicate
  names merge. `values()` gives arrays but reads every row. `raw()` and
  `as(Array)` give no array iterator.
- `prepare('select 1; delete from events')` runs the first statement and
  silently ignores the rest. The guard refuses multiple statements before this,
  and the database is opened read-only.

So: iterate and index each object by `columnNames` when the names are unique,
which is exact and stops early; when names repeat, read all rows with
`values()`, cut afterwards, and warn `FETCHED_ALL_ROWS`. SQLite is a local file,
so the full read costs time and memory, not network.

## Running it

```sh
docker run -d --name sherlock-spike-pg -e POSTGRES_PASSWORD=password -p 127.0.0.1:55432:5432 postgres:16-alpine
docker run -d --name sherlock-spike-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=spike -p 127.0.0.1:53306:3306 mysql:8.0
docker run -d --platform linux/amd64 --name sherlock-spike-mssql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='Spike_Passw0rd!' -p 127.0.0.1:51433:1433 mcr.microsoft.com/mssql/server:2022-latest
cd spikes/fetch && bun install
bun seed-pg-mysql.ts && bun mssql-seed.ts
bun pg-bun-cursor.ts; bun pg-postgres-js.ts; bun mysql.ts; bun mssql.ts; bun sqlite.ts; bun sqlite-metadata.ts
```
