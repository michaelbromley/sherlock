# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Tunnel providers.** A `tunnel` block can name a `provider` instead of giving a `command`. The first is `northflank`, which forwards an addon through the Northflank API using a named context from the Northflank CLI config (`"context"`, `"project"`, `"addon"`). It never reads or changes the CLI's current context, needs no root, and defaults to the addon's read replica when it has one (`"endpoint": "read" | "primary"`). `"configDir"` points at a separate CLI config directory. A `tunnel` block with no `provider` behaves exactly as before
- `connection add --tunnel-provider <id> --tunnel-option key=value` sets up a provider tunnel without the wizard
- The `sherlock manage` wizard sets up provider tunnels too. It first asks how the database is reached, then asks the provider's own questions: for Northflank, pick a context from the CLI config, then a project and a database addon listed from the API. An existing provider tunnel can be edited there rather than only in config.json
- `sherlock doctor <connection>` checks a connection in order: config, tunnel target against the configured host, provider access, credentials, tunnel, TLS and `SELECT 1`. It stops at the first failure and says what to change
- `query --file <path>`, and `query -` to read the query from stdin
- `query --timeout <duration>` and a `statementTimeout` connection setting. Statements are cancelled after 60s by default
- `connection list` reports each connection's type, target and tunnel alongside the names
- `sherlock guide` prints the instructions for AI agents, built into the binary so they always match its version. `sherlock guide transfer` replaces the skill's `references/transfer.md`
- A `connectTimeout` connection setting, default 10s. A connection through a tunnel whose far end is gone now fails within it, with an error that says the tunnel is the problem and how to restart it, instead of waiting 30s per connection

### Changed

- **The agent skill is now a short pointer to `sherlock guide`.** It keeps the description that tells agents when to use sherlock, how to find the binary, and the rules that apply to every version. Everything else moved into the guide, so updating the binary updates what agents are told. Update the skill with `npx skills update sherlock -g`
- Every PostgreSQL and MySQL/MariaDB statement now runs in a read-only transaction that is rolled back, so the database refuses writes the keyword check cannot see, such as those made by functions. The statement is sent as a prepared statement, so the server also refuses a second statement chained after it. SQLite connections refuse writes with `query_only`
- The read-only check ignores string literals, quoted identifiers and comments, following the quoting rules of the database the connection resolves to. Line comments end at a carriage return as well as a line feed. `WHERE action = 'delete'` and `SELECT 'a;b'` are no longer rejected. `SELECT ... INTO` and MySQL executable comments (`/*! ... */`) are now rejected
- The default Northflank `endpointPattern` also matches the CLI's newer `exposed locally on` wording

### Fixed

- **Renaming a connection in `sherlock manage` deleted its keychain password**, leaving the renamed connection pointing at an entry that no longer existed. The password now moves to the new name, and the rename is refused if that name already has an entry
- **`sherlock manage` edited the wrong file.** It read whichever config discovery picked, such as a project's `.sherlock.json` or `SHERLOCK_CONFIG`, then saved all of it to the user config, copying that file's connections and tunnels in, and deleted connections came back. It now reads and writes the user config, and warns when commands run here read a different file
- Editing connection details in `sherlock manage` keeps a host or username read from an environment variable or the keychain, instead of replacing it with what is typed. A connection defined by a URL is no longer rewritten as separate fields; the wizard says how to change the URL
- Deleting a connection removes only the keychain entry it uses, and stops its tunnel
- "Update password" refuses an empty password, which pointed the connection at a password that was never stored, and is not offered for SQLite
- Updating a password in the `.env` file no longer corrupts one containing `$&` or `$1`
- `sherlock migrate` backs up an existing `.env` instead of overwriting it, and `sherlock init` leaves an existing `.env` alone. A missing legacy config no longer ends the `manage` session
- `sherlock keychain get` reports whether an entry exists instead of printing the password
- `sherlock keychain list` and the keychain check in `manage` show where each password comes from (keychain, environment variable, plaintext, URL, none), not only whether a keychain entry is named after the connection
- "Test connection" in `manage` runs the same checks as `sherlock doctor`, and the connection list there shows each connection's target and tunnel
- Every non-interactive command reports errors as `{"error": "..."}` on stderr and exits 1. Some printed a plain `Error:` line. `tunnel stop <name>` exits 1 when no such tunnel is running, and `update` exits 1 when it fails
- The "no configuration file" error and the steps `init` and `migrate` print point at `manage`, `connection add`, `connection list` and `doctor`, rather than hidden commands. The unreachable "Initialize config template" menu item is gone
- `query ""` says the query is empty, and the port prompt in `manage` accepts only 1 to 65535
- The hidden `sherlock test <connection>` command no longer fails on SQL connections
- `connection add --directory .` stored the relative path, which made the connection auto-select in every directory. Directories are now stored absolute
- A connection that cannot reach its server says which host and port it tried, instead of "Failed to connect" or "Max reconnection attempts reached"
- The read-only check allows the `REPLACE()` and `TRUNCATE()` functions and a column called `comment`, and suggests quoting when a keyword may be a name
- A query that would be refused is refused before a tunnel is started, when the config says which database it is
- Editing a connection in `sherlock manage` keeps its `statementTimeout` and `connectTimeout`
- An unparseable connection URL is no longer quoted, password included, in the error
- A tunnel block with a provider's settings but no `"provider"` says which provider it looks like
- `connection add` suggests `info` rather than `tables` for Redis, and `doctor` for a tunnelled connection; notes a connection stored with no password and `--ssl verify` combined with a tunnel; and refuses `--password-stdin` from a terminal instead of waiting forever
- Tunnels are reported in one shape everywhere (`kind`, `provider`, `target`, `details`) by `connection add`, `connection list` and `tunnel status`
- `doctor` advises on a missing credential by its cause, and no longer suggests `echo`ing a password

## [1.9.1] - 2026-10-15

### Added

- `allowPublicKeyRetrieval` connection option for MySQL, also accepted as `?allowPublicKeyRetrieval=true` in a URL. It lets sherlock log in users with MySQL 8's default `caching_sha2_password` plugin over a connection without TLS (#9)

### Changed

- When a MySQL server needs TLS or public key retrieval to log a user in, the error now names the sherlock settings that fix it: `"ssl": true` or `allowPublicKeyRetrieval` (#9)

## [1.9.0] - 2026-09-29

### Added

- Prebuilt `sherlock-linux-arm64` binary in releases. `install.sh` and `sherlock update` select it on Linux arm64 machines (#21)

## [1.8.0] - 2026-09-28

### Changed

- **The binary and the agent skill are now installed separately.** `install.sh` puts the binary in `~/.local/bin/sherlock` (or `$SHERLOCK_BIN_DIR`), then offers to install the skill with the [skills CLI](https://skills.sh): `npx skills add michaelbromley/sherlock -g`. The skill works in any agent that supports Agent Skills (Claude Code, Codex, Cursor, Gemini CLI and more), and runs `sherlock` from PATH instead of a fixed path under `~/.claude/skills`.
  - Running `install.sh` over an earlier install migrates it: `config.json`, `.env`, logs and cache move from `~/.claude/skills/sherlock` to `~/.config/sherlock` (an existing config there is backed up first), and the old binary, skill file, PATH line and Claude Code permission are removed or updated. A skill directory owned by a skill manager (a symlink) is left alone.
  - The installer no longer creates a `config.json` in the skill directory. That file switched sherlock to portable mode, which kept your connections and credentials inside a directory that skill managers replace and sync.
  - Run without a terminal, the installer asks nothing, edits no shell config and prints the skill install command instead of running it.
  - Upgrade from 1.7.0 or earlier by running `install.sh`, not `sherlock update`. Updating a 1.7.0 binary with `sherlock update` keeps the old layout. Until you run the installer, the skill falls back to the old binary path and tells you to run it, and later runs of `sherlock update` print the install command.
  - Log and cache files whose names are already taken in `~/.config/sherlock` are kept with a `.migrated-<time>` suffix. The old Claude Code permission is removed from both `settings.json` and `settings.local.json`, and the rest of each allow list keeps its order.
  - `SHERLOCK_BIN_DIR` changes where the binary goes, and `SHERLOCK_NO_PROMPT=1` makes the installer ask nothing.
  - `install.ps1` always puts its install directory on the user PATH, since the skill runs `sherlock` from PATH.
- The skill follows the Agent Skills specification: a description that says when to use it, a `compatibility` field naming the CLI it needs, and `allowed-tools: Bash(sherlock:*)`. The walkthrough for moving connections between machines moved to `references/transfer.md`, which agents load only when needed.
- `sherlock update` updates only the binary, and no longer writes a `SKILL.md` next to it. Update the skill with `npx skills update sherlock -g`.
- The password prompts in `sherlock manage` now say they ask for the database password, and name the connection it belongs to.

### Fixed

- The README and website only describe platforms that have a release (macOS on Apple silicon, Linux x64), and the installer and `sherlock update` say so on other platforms instead of failing to download. They no longer refer to commands that do not exist (`sherlock setup`, `sherlock edit`), and the website's examples use the real command syntax.
- The installer's questions work when it is run with `curl ... | bash`. They read from the terminal; before, they read from the piped script and were always answered no.

## [1.7.0] - 2026-09-28

### Added

- **`sherlock config export` and `sherlock config import`** move connections, passwords included, to another machine in a single passphrase-encrypted file. The key is derived with scrypt and the file is encrypted with AES-256-GCM. A wrong passphrase and a modified or corrupted file are both refused.
  - Export reads each password from wherever it is stored: the keychain, the `.env` file, an environment variable or config.json. `sherlock config export <name>` exports one connection.
  - Import stores passwords in the OS keychain, as `connection add --password-stdin` does. On a machine with no keychain it asks before writing them into config.json.
  - A connection whose name already exists is skipped unless `--force` is given.
  - The passphrase is only ever read from a prompt.

### Fixed

- `sherlock connection add` no longer copies a project's `.sherlock.json` into your user config. It read connections from whichever config applied in the current directory but wrote them to the user config, so adding a connection inside a project with a `.sherlock.json` replaced your user config with the project's connections, tunnel commands included.
- Storing a password in the macOS keychain no longer hangs when sherlock runs in a terminal. `security` read the password from the terminal rather than from sherlock, so `connection add --password-stdin` and the keychain option in `sherlock manage` waited for input that never came.

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
