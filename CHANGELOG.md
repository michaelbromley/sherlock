# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-08-19

### Added

- **`sherlock connection add`** sets up a connection in one non-interactive command, for scripting and for asking an AI assistant to do it. The password is read from stdin and stored in the OS keychain, so it never appears in the process list or the shell history. `--password-env` stores a reference to an environment variable instead.
  - `--tunnel-northflank <project>/<addon>` expands to the full `northflank forward --skipHostnames` command and the pattern that reads the port back out of its output.
  - `--tunnel-command` and the other tunnel flags cover every other forwarding tool, and are validated as the connection is written rather than on the first query.
  - `--from-url` replaces the individual host, port, username and database flags. A password in the URL is ignored.
- `sherlock connection list` lists configured connections. `sherlock connections` still works and is kept as a hidden alias.
- The `sherlock manage` wizard asks whether a connection needs a tunnel when adding one. Previously a tunnel could only be added by editing a connection after creating it.

### Fixed

- "Edit connection details" in `sherlock manage` no longer discards an existing tunnel. The config was rebuilt from the answers given, and the tunnel block was not carried over.
- Storing a password in the macOS keychain no longer passes it as a command-line argument to `security`, where any local user could read it from the process list.
- Writing config no longer replaces a config file that exists but cannot be parsed. Every connection in an unreadable config would have been lost on the next write.

## [1.5.0] - 2026-08-19

### Added

- **Automatic tunnels** for databases only reachable through a port-forwarding process (Northflank, kubectl, ssh, cloud-sql-proxy). Add a `tunnel` block to a connection and sherlock starts the forwarding command on the first query, reuses it across later commands, and shuts it down once it has gone unused.
  - `{{port}}` in the command is replaced with a free local port, so parallel tunnels never collide. Use `localPort` instead when the forwarding tool needs a fixed port.
  - `endpointPattern` reads the endpoint out of the command's own output, for tools that take no port argument and choose one themselves. Northflank's `forward --skipHostnames` and `kubectl port-forward` both work this way.
  - A tunnel command that needs `sudo` cannot work, because the tunnel runs in the background with no terminal for sudo to prompt at. Sherlock detects this and names the alternatives in the error.
  - `idleTimeout` (default `10m`) controls automatic shutdown; queries in flight keep their own tunnel alive.
  - `sherlock tunnel status`, `sherlock tunnel stop <connection>`, `sherlock tunnel stop` to stop all.
  - Sherlock waits for the local port to accept before connecting, so a tunnel that fails to start reports the forwarding command's own error.
  - Tunnels are ignored in a project-local `.sherlock.json`, since honouring one would let a cloned repository run a shell command.
  - "Configure tunnel" added to the connection edit menu in `sherlock manage`.

### Changed

- **The connection picker in `sherlock manage` filters as you type.** Start typing and the list narrows to matching connections; arrow keys still work if you would rather scroll. Ten connections are shown at a time instead of the whole list, which used to overflow the terminal once you had more than a handful.
- Connection names are listed alphabetically everywhere: the picker, `sherlock connections`, the keychain status list, and the "List connections" view. Previously they appeared in whatever order they were written to the config file.
- Upgraded `@clack/prompts` to 1.7.0. Every prompt now shows a keyboard hint footer, and `note()` boxes are no longer dimmed.

## [1.4.0] - 2026-05-21

### Added

- **SSL/TLS support** for managed databases (Northflank, Supabase, Neon, RDS, Azure SQL). New `ssl` field on connection configs; `true` to encrypt, `{ rejectUnauthorized: true }` to also verify the cert.
- **Paste a connection string** in the setup wizard — sherlock parses host/port/user/password/database/ssl from the URL and only prompts for what's missing.
- IPv6 hosts are now bracketed in built URLs.

## [1.3.0] - 2026-03-11

### Added

- Added support for Microsoft SQL Server (MSSQL)

## [1.2.0] - 2026-03-02

### Added

- **Ad hoc `--url` (`-u`) connections** — connect directly via a database URL without any config file setup. Ideal for projects with a `DATABASE_URL` in `.env`
  - `sherlock -u "postgres://user:pass@host:5432/db" tables`
  - `sherlock -u "redis://localhost:6379" info`
  - Auto-detects database type from URL prefix (`postgres://`, `mysql://`, `sqlite://`, `redis://`)
  - Mutually exclusive with `-c` — clear error if both are used
  - Schema caching works under a synthetic name derived from the URL
  - Query logging disabled for ad hoc connections (no config entry to enable it)
- `detectDbTypeFromUrl()` shared utility for URL-to-type detection (replaces duplicated inline logic)
- `withConnectionFromConfig()` / `withRedisConnectionFromConfig()` for direct config-based connections without name lookup

## [1.1.1] - 2026-02-28

### Fixed

- Connection testing no longer fails with cryptic "awaitPromise is not defined" error — replaced `sql.unsafe()` with explicit `sql.connect()` for connection tests

## [1.1.0] - 2026-02-25

### Added

- Directory selection prompt when setting up connections — choose between current directory, custom path, or skip (replaces free-text input)
- `manage` and `update` commands spotlight on landing page

### Fixed

- Password-less database connections now work correctly — password is optional in both the setup wizard and config resolution (supports trust/peer auth for local dev databases)
- Storage method prompt no longer shown when no password is entered

## [1.0.0] - 2026-02-20

### Added

- **Self-update command** — `sherlock update` checks for new releases and updates in-place
- **GitHub Pages landing page** — project website at michaelbromley.github.io/sherlock
- **Redis support** — 6 new commands for read-only Redis inspection, zero new dependencies (uses Bun's native `RedisClient`)
  - `info` — server info, memory stats, keyspace overview (`--section` for specific sections)
  - `keys [pattern]` — scan for keys matching a glob pattern (`--limit`, `--no-types`)
  - `get <key>` — get value with auto type detection (string/hash/list/set/zset/stream)
  - `inspect <key>` — key metadata: type, TTL, memory usage, encoding, length
  - `slowlog` — recent slow queries from Redis slow log
  - `command <cmd> [args...]` — execute any read-only Redis command with whitelist validation
- Redis connection setup in `manage` wizard (host, port, password, database number 0-15)
- `redis://` and `rediss://` URL auto-detection in connection config
- Read-only enforcement for Redis — whitelist of allowed commands, subcommand validation for multi-word commands (e.g. `CONFIG GET` allowed, `CONFIG SET` blocked)
- Clear error messages when using SQL commands on Redis connections and vice versa
- `manage` auto-triggers setup wizard when no config exists
- Enhanced connection list in manage menu showing type + host/database info
- Dedicated "Delete connection" option in manage menu (no longer buried inside edit)
- Keychain submenu in manage menu (store, check, delete passwords)
- Interactive migrate option in manage menu (prompts for legacy config path)
- "Set project directory" option in edit connection menu

### Changed

- Consolidated all connection/config management into a single `manage` command
- `sherlock --help` now shows 15 commands (8 SQL + 6 Redis + `manage`)
- `setup`, `add`, `edit` commands removed (fully replaced by `manage` menu)
- `connections`, `test`, `init`, `migrate`, `keychain` commands hidden from help (still work for scripting/CI)
- Edit connection no longer asks for password — use dedicated "Update password" option instead
- `test` command now handles both SQL (SELECT 1) and Redis (PING) connections

## [0.2.0] - 2026-02-20

### Added

- Auto-detect connection by working directory: connections can now have a `directory` field, and when your cwd is inside that path, the connection is selected automatically without needing `-c`
- Setup wizard now prompts for a project directory when adding or editing connections

## [0.1.2] - 2026-02-19

### Fixed

- SQL queries containing `!` (e.g. `!=`, `NOT IN`) now work correctly when invoked via shells/tools that escape `!` to `\!` (zsh history expansion prevention)

## [0.1.0] - 2025-01-15

### Added

- `sample` command: get random rows from a table (`sherlock -c mydb sample users -n 10`)
- `indexes` command: show indexes for a table (`sherlock -c mydb indexes users`)
- `--format` option: output as `json` (default) or `markdown` tables (`sherlock -c mydb query "SELECT..." -f markdown`)
- Schema caching: `introspect` results are cached per-connection, use `--refresh` to update
- `stats` command: data profiling (row count, null counts, distinct counts per column)
- `fk` command: show foreign key relationships (outgoing and incoming)

### Changed

- Major refactor: split query-db.ts (1362→695 lines) into focused modules:
  - `src/db/operations.ts` - database introspection operations
  - `src/db/connection.ts` - connection lifecycle management
  - `src/output/formatters.ts` - JSON/markdown formatting
  - `src/cache/schema.ts` - schema caching logic
  - `src/logging/query-log.ts` - query logging
- Extracted `validateTableExists()` helper (was duplicated 6x)
- Extracted `requireConnection()` helper (was duplicated 8x)

### Security

- Table name validation prevents SQL injection via maliciously-named database objects

## [0.0.6] - 2025-01-15

### Fixed

- Empty password strings now work correctly for passwordless database connections (e.g., local MariaDB with root user)

## [0.0.5] - 2025-01-08

### Added

- Per-connection `logging` option in config (default: `false`)
- "Toggle query logging" option in edit wizard (`sherlock edit`)

### Changed

- Query logging now disabled by default (security: protects sensitive prod data)
- Logging must be explicitly enabled per-connection with `"logging": true`
- SKILL.md condensed from 162 to 41 lines (removed redundant instructions for LLM)

## [0.0.4] - 2025-01-08

### Added

- Install script detects existing installations and shows version transition on upgrade
- Install script automatically adds sherlock to Claude Code allowed permissions
  - Workaround for [claude-code#14956](https://github.com/anthropics/claude-code/issues/14956)
- Upgrade documentation in README

### Changed

- Install script skips "Next steps" and PATH tip when upgrading (user already knows)

## [0.0.3] - 2025-01-08

### Added

- Portable mode: config, logs, and binary all stored in `~/.claude/skills/sherlock/`
- SQLite config now accepts `path` as alias for `filename`
- Install script creates empty config.json to enable portable mode
- Install script shows tip for adding sherlock to PATH

### Fixed

- SQLite connections now work correctly (added required `file://` protocol prefix for Bun.SQL)
- Version command now reads from package.json instead of hardcoded value

## [0.0.1] - 2025-01-08

### Added

- Initial release
- Single binary distribution (~57MB) via Bun compile
- Support for PostgreSQL, MySQL/MariaDB, and SQLite
- Read-only query enforcement with comprehensive validation
- Secure credential management via OS keychain or environment variables
- Interactive setup wizard (`sherlock setup`)
- Connection management TUI (`sherlock manage`)
- Schema introspection commands (`tables`, `describe`, `introspect`)
- Query execution with automatic logging
- Claude Code skill integration (`/sherlock`)
- Cross-platform builds (macOS ARM64, macOS x64, Linux x64)
- One-line installer script

### Security

- Passwords never accepted via CLI arguments (prevents shell history exposure)
- Config files created with restricted permissions (0600)
- Whitelist-based query validation (only SELECT, SHOW, DESCRIBE, EXPLAIN, WITH allowed)
- No default database connection (prevents accidental production queries)
- Credentials stored via `$keychain` or `$env` references, never plaintext in config
