# Sherlock

A read-only database query tool for AI agents. A single binary with secure credential management, for PostgreSQL, MySQL/MariaDB, SQL Server, SQLite and Redis.

Sherlock comes in two parts:

- **The `sherlock` CLI**, a standalone binary that runs the queries.
- **The `sherlock` agent skill**, a [SKILL.md](.claude/skills/sherlock/SKILL.md) that teaches your AI agent how to use the CLI. It follows the [Agent Skills](https://agentskills.io) format, so it works in Claude Code, Codex, Cursor, Gemini CLI and other agents that support skills.

## Features

- **Single binary** - Standalone executable, no runtime dependencies
- **Secure credentials** - Passwords in the OS keychain or environment variables. Plaintext in config is possible but warned about on every query.
- **Read-only enforced** - SQL: a single SELECT/SHOW/DESCRIBE/EXPLAIN/WITH statement, run in a read-only transaction that is always rolled back. Redis: read-only command whitelist
- **Explicit connections** - Name the database to query, or let a project directory select it. There is no default connection, so no accidental production queries.
- **Multiple databases** - PostgreSQL, MySQL/MariaDB, SQL Server, SQLite, Redis
- **SSL/TLS support** - Works with managed databases (Northflank, Supabase, Neon, RDS, Azure SQL) that require encrypted connections
- **Automatic tunnels** - Databases behind a port-forward open on first use and shut down when idle: Northflank addons through the Northflank API, anything else (kubectl, ssh) through a command
- **`doctor`** - Checks a connection step by step, from tunnel target to `SELECT 1`, and reports the first thing that is wrong
- **Paste a connection string** - Set up new connections by pasting a URL — sherlock parses out host, port, user, password, database, and SSL settings
- **Move connections between machines** - Export connections, passwords included, to a passphrase-encrypted file and import them elsewhere
- **Works with any skills-capable agent** - Claude Code, Codex, Cursor, Gemini CLI and more, through the agent skill

## Quick Start

### 1. Install

```bash
curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash
```

This installs the `sherlock` binary to `~/.local/bin`, then offers to install the agent skill for you (step 2). Prebuilt binaries exist for **macOS on Apple silicon**, **Linux x64** and **Linux arm64**. On any other platform, [build from source](#from-source).

The installer reads two optional environment variables, set on the `bash` side of the pipe:

- `SHERLOCK_BIN_DIR` installs the binary somewhere other than `~/.local/bin`, e.g. `curl ... | SHERLOCK_BIN_DIR=$HOME/bin bash`. The directory must be writable without sudo.
- `SHERLOCK_NO_PROMPT=1` asks nothing, as when there is no terminal: the shell config is not edited and the skill install command is printed instead of run.

### 2. Install the agent skill

If you skipped it during install, or want it for more agents:

```bash
npx skills add michaelbromley/sherlock -g
```

The [skills CLI](https://skills.sh) asks which agents to install the skill for. The skill runs `sherlock` from your PATH, so any agent that can run shell commands can use it.

In Claude Code, the installer also allows `Bash(sherlock:*)` in your settings, so Claude does not ask before every sherlock command. This works around [a Claude Code bug](https://github.com/anthropics/claude-code/issues/14956) where a skill's `allowed-tools` are not applied.

### 3. Set up a connection

```bash
sherlock manage
```

The interactive wizard offers two ways to add a connection:

- **Paste a connection string** — paste a URL like `postgres://user:pass@host:5432/db?sslmode=require` and sherlock pulls out the host, port, user, password, database, and SSL settings. You'll only be prompted for whatever's missing.
- **Enter details manually** — answer prompts for database type, host, port, database name, credentials, and SSL/TLS.

After the details, you'll choose secure password storage (OS keychain or env file).

#### Without the wizard

`sherlock connection add` sets up a connection in one command. The password is stored in the OS keychain, so it never appears in the process list or the shell history.

The easiest way is to ask your agent: "set up a connection to the staging database". It works out the details from your conversation and project, and gives you one command to run, ending in `--password-prompt`. Run it, type the password at the hidden prompt, and tell the agent it's done. The agent never sees the password.

```bash
sherlock connection add prod --type postgres --host db.example.com --database app --username dbuser \
  --ssl require --password-prompt
```

When the project already has a database URL in its `.env`, point the connection at it. Sherlock stores only the variable's name, and reads the URL from that project's `.env` on each query, before the environment:

```bash
sherlock connection add shop --url-env DATABASE_URL --directory .
```

For scripts, pipe the password in with `--password-stdin` instead:

```bash
printf '%s' "$PASSWORD" | sherlock connection add prod \
  --type postgres --host db.example.com --database app --username dbuser \
  --password-stdin --ssl require
```

`--from-url postgres://dbuser@host:5432/app` replaces the individual flags. `--password-env VAR` stores a reference to an environment variable instead of a keychain entry. `--tunnel-command`, `--tunnel-northflank` and the other tunnel flags are covered under [Tunnels](#tunnels). Run `sherlock connection add --help` for the full list.

### 4. Ask your agent

Once configured, ask your agent questions about your data:

> "Show me the top 10 customers by order value from prod-db"

> "What tables are in the staging database?"

> "How many users signed up last week?"

The agent uses sherlock to explore schemas and run read-only queries on your behalf.

## Upgrading

```bash
sherlock update                   # the binary
npx skills update sherlock -g     # the agent skill
```

Running the install command again also upgrades the binary.

### Upgrading from 1.x to 2.0

2.0 changes the output of every command, so scripts that parse sherlock's output need converting; see [Output](#output). Agents with the sherlock skill read the new output from `sherlock guide` and need nothing. To keep 1.x output while you convert scripts, stay on the last 1.x release.

### Upgrading from 1.7.0 or earlier

Earlier installers put the binary, the skill and your config together in `~/.claude/skills/sherlock`. **Upgrade by running the install command, not `sherlock update`.** `sherlock update` replaces the binary where it is and keeps the old layout. The install command moves to the new layout. It:

- installs the binary to `~/.local/bin/sherlock`
- moves `config.json`, `.env`, logs and cache to `~/.config/sherlock`, backing up any config already there
- removes the old binary, skill file and PATH line, and updates the Claude Code permission to `Bash(sherlock:*)`

Then install the skill with `npx skills add michaelbromley/sherlock -g`. If a skill manager (the skills CLI, Ferry, a plugin) already manages `~/.claude/skills/sherlock`, the installer leaves that directory alone.

---

## Manual Installation

### From Binary

Download `sherlock-darwin-arm64`, `sherlock-linux-x64` or `sherlock-linux-arm64` from [GitHub Releases](https://github.com/michaelbromley/sherlock/releases) and put it on your PATH:

```bash
chmod +x sherlock-darwin-arm64
mv sherlock-darwin-arm64 ~/.local/bin/sherlock
```

Then install the skill with `npx skills add michaelbromley/sherlock -g`.

### From Source

Requires [Bun](https://bun.sh). This is also the way to run sherlock on platforms without a prebuilt binary, such as Intel Macs.

```bash
git clone https://github.com/michaelbromley/sherlock
cd sherlock
bun install
bun build ./src/query-db.ts --compile --outfile sherlock
mv sherlock ~/.local/bin/
```

`sherlock update` cannot update a binary built from source; pull and rebuild instead.

#### Windows

There is no Windows release. On Windows, build the binary and install it with the PowerShell script, which puts it on your PATH:

```powershell
npm run build:windows   # builds dist/sherlock-windows.exe
.\install.ps1           # installs the local build
```

## Commands

### Query your database

```bash
sherlock -c mydb tables                         # List tables
sherlock -c mydb describe users                 # Show table schema
sherlock -c mydb query "SELECT * FROM users LIMIT 10"
sherlock -c mydb query --file report.sql        # Long queries: from a file...
sherlock -c mydb query - < report.sql           # ...or from stdin
sherlock -c mydb introspect                     # Full schema dump (cached)
sherlock -c mydb introspect --refresh           # Refresh cached schema
sherlock -c mydb sample users -n 10             # Random sample rows
sherlock -c mydb stats users                    # Data profiling (nulls, distinct)
sherlock -c mydb indexes users                  # Show table indexes
sherlock -c mydb fk users                       # Foreign key relationships
sherlock -c mydb query "SELECT * FROM events" --out events.jsonl   # Every row, to a file
```

### Output

Every command prints one JSON object on stdout, on one line:

```json
{"ok":true,"data":{"columns":[{"name":"id","type":"int4"},{"name":"email","type":"text"}],"rows":[[1,"a@example.com"]],"rowCount":1,"truncated":false},"warnings":[],"meta":{"contract":2,"command":"query","connection":"mydb","dbType":"postgres","durationMs":12,"version":"2.0.0"}}
```

- `ok` says whether the command did what was asked, and the exit code agrees: 0, 1, or 2 for a usage error.
- On failure, `error` has a stable `code` (such as `AUTH_FAILED`, `TUNNEL_DOWN` or `QUERY_FAILED`), a `message`, a `fix` saying what to do next, and `details`. `sherlock guide` lists every code.
- `warnings` holds things that did not stop the command, such as a result that was cut or a password stored in plaintext.
- Rows come back as arrays, with the column names and types once in `columns`.
- Results are capped at 200 rows, 500 characters per cell and 32 KB in all, so one query cannot fill an agent's context. Anything cut is reported in `truncated` and a `RESULT_TRUNCATED` warning. Raise the caps with `--max-rows`, `--max-cell` and `--max-bytes`, remove them with `--no-limit`, or set `maxRows`, `maxCellChars` and `maxBytes` on a connection. `--out <file.jsonl|file.csv>` writes every row to a file instead and returns a preview.
- `-f human` prints tables and text for reading instead of the envelope.

Converting a script from 1.x:

| 1.x | 2.0 |
| --- | --- |
| `.rows[]` (objects) | `.data as $d \| $d.rows[] \| [[$d.columns[].name], .] \| transpose \| map({(.[0]): .[1]}) \| add` |
| `.rows \| length` | `.data.rowCount` |
| `.error` | `.error.message`, and branch on `.error.code` |
| `.tables[]` | `.data.tables[]` |
| `.connections[]` | `.data.connections[].name` |
| exit code only | exit code only, now also non-zero for a failed query |

## Configuration

Config lives at `~/.config/sherlock/config.json`:

```json
{
  "version": "2.0",
  "connections": {
    "prod-db": {
      "type": "postgres",
      "host": "prod.example.com",
      "port": 5432,
      "database": "myapp",
      "username": { "$env": "PROD_DB_USER" },
      "password": { "$keychain": "prod-db" },
      "ssl": true
    },
    "local-dev": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "database": "myapp",
      "username": { "$env": "LOCAL_DB_USER" },
      "password": { "$env": "LOCAL_DB_PASS" },
      "logging": true
    },
    "redis-cache": {
      "type": "redis",
      "host": "localhost",
      "port": 6379,
      "password": { "$keychain": "redis-cache" },
      "database": "0"
    }
  }
}
```

### Timeouts

Two settings on a connection limit how long sherlock waits. Both take a duration such as `"30s"`, `"5m"` or `"2h"`.

| Setting | Default | What it limits |
|---|---|---|
| `statementTimeout` | `60s` | How long one statement may run before the database cancels it. `query --timeout 5m` overrides it for one query. |
| `connectTimeout` | `10s` | How long to wait for the database to answer when connecting. Through a tunnel whose far end is gone this is what makes the connection fail quickly, with an error that says the tunnel is the problem. |

### Result caps

Three numeric settings change a connection's [result caps](#output). The command-line flags override them for one command.

| Setting | Default | Flag |
| --- | --- | --- |
| `maxRows` | `200` | `--max-rows` |
| `maxCellChars` | `500` | `--max-cell` |
| `maxBytes` | `32768` | `--max-bytes` |

### SSL/TLS

Add `ssl` to any connection to enable encryption. Managed databases (Northflank, Supabase, Neon, RDS, Azure SQL) typically require this:

| Value | Behaviour |
|---|---|
| omitted / `false` | No SSL (default) |
| `true` | Require SSL, do not verify server certificate — works for most managed DBs |
| `{ "rejectUnauthorized": true }` | Require SSL **and** verify the certificate against system CAs |

The `manage` wizard offers these as three options ("No SSL" / "Require SSL (accept any cert)" / "Require SSL + verify cert"). Use "Configure SSL/TLS" in the edit menu to change SSL on an existing connection.

If you pass an `ssl` field alongside a raw `url:` (instead of individual host/port fields), sherlock overlays the SSL settings onto the URL — handy when you've stored a `DATABASE_URL` and want to enable SSL without rewriting it.

#### MySQL 8 and `caching_sha2_password`

MySQL 8 users use the `caching_sha2_password` plugin by default. To log in, the client must either connect over TLS or encrypt the password with the server's RSA public key. Without either, the connection fails with an error that mentions `caching_sha2_password`. The `mysql` CLI does not hit this, because it uses TLS whenever the server offers it.

Set `"ssl": true` on the connection, or add `?ssl-mode=REQUIRED` to a `--url`. MySQL 8 servers generate a certificate on first start, so this works on most servers.

If the server has no TLS, set `"allowPublicKeyRetrieval": true` on the connection, or add `?allowPublicKeyRetrieval=true` to the URL. Sherlock then asks the server for its public key. Over an unencrypted connection, anyone who can intercept the traffic can send their own key and read the password, so use this only on networks you trust, such as localhost or an SSH tunnel.

```json
{
  "connections": {
    "local-mysql": {
      "type": "mysql",
      "host": "127.0.0.1",
      "database": "app",
      "username": "dev",
      "password": { "$env": "LOCAL_MYSQL_PASSWORD" },
      "allowPublicKeyRetrieval": true
    }
  }
}
```

### Tunnels

Some databases are only reachable through a port-forward: a Northflank addon, a Kubernetes service, a host behind a bastion. Give the connection a `tunnel` block and sherlock opens the tunnel on the first query, reuses it for later commands, and shuts it down once it has gone unused.

A tunnel is opened either by a **provider**, which knows how to reach one platform through its API, or by a **command** you supply. Northflank has a provider. Everything else uses a command.

#### Northflank

```json
"northflank-prod": {
  "type": "postgres",
  "host": "primary.postgresql--my-project--abc1.addon.code.run",
  "username": "vendure",
  "password": { "$keychain": "northflank-prod" },
  "database": "vendure",
  "ssl": true,
  "tunnel": {
    "provider": "northflank",
    "context": "my-team",
    "project": "my-project",
    "addon": "postgresql"
  }
}
```

| Field | Required | Behaviour |
|---|---|---|
| `context` | yes | Name of a login in the Northflank CLI config (`northflank context ls`). Its token is used directly: the CLI's current context is never read or changed |
| `project` | yes | Project id, as in the Northflank URL |
| `addon` | yes | Addon id, as in the Northflank URL |
| `endpoint` | no | `read` or `primary`. Default: the read replica when the addon has one, the primary otherwise. Asking for `read` on an addon with no replica is an error, not a silent fall back |
| `configDir` | no | Directory holding the CLI's `config.json`, for a login kept apart from your usual one. Default: `$NF_CONFIG_DIR`, else `~/.northflank` |
| `port` | no | Name or number of the addon port, when it exposes more than one |
| `team` | no | Team id, for an organisation-scoped token whose context names no team |

The provider forwards the addon to a loopback address without touching `/etc/hosts`, so it needs no root. The token is read from the CLI config on each start and is never logged, stored or passed on a command line. Log in with the Northflank CLI first (`northflank login --name my-team`).

Set `host` to the addon's internal hostname, as shown in the Northflank dashboard. It is replaced by the tunnel's local address at connect time, but `sherlock doctor` compares it with the tunnel's project and addon to catch a tunnel that points at a different database.

#### Command tunnels

A `tunnel` block with no `provider` runs a shell command:

```json
{
  "connections": {
    "prod-behind-bastion": {
      "type": "postgres",
      "username": "vendure",
      "password": { "$keychain": "prod-behind-bastion" },
      "database": "vendure",
      "ssl": true,
      "tunnel": {
        "command": "ssh -N -L {{port}}:db.internal:5432 bastion.example.com",
        "idleTimeout": "10m"
      }
    }
  }
}
```

| Field | Required | Behaviour |
|---|---|---|
| `command` | yes | Shell command that forwards the remote database to a local port |
| `localPort` | no | Fixed local port. When omitted, sherlock picks a free one and substitutes it for `{{port}}` |
| `endpointPattern` | no | Regex that reads the endpoint out of the command's own output, for tools that choose their own port |
| `idleTimeout` | no | Shut down after this long with no queries (default `10m`). Applies to provider tunnels too |
| `readyTimeout` | no | How long to wait for the port to start accepting (default `30s`). Applies to provider tunnels too |

Write `{{port}}` wherever the command takes the local port. Sherlock replaces it with the port it allocated, so parallel tunnels never collide. Tools that take a port this way include `ssh -L`, `cloud-sql-proxy`, and `kubectl port-forward`. If the forwarding command needs a fixed port, set `localPort` instead and hard-code the same port in the command. If it takes no port at all, see the next section.

#### Tools that choose their own port

Some forwarding commands take no port argument and choose one themselves, printing it on startup. For those, set `endpointPattern` to a regex with a named `port` group and an optional named `host` group, and sherlock reads the endpoint out of the command's output instead of dictating it.

The Northflank CLI works this way, for connections set up before the provider existed. Its `forward` command needs root by default, because it writes the addon's hostname into `/etc/hosts`. Passing `--skipHostnames` removes that requirement. With that flag the addon is exposed on an IP address and northflank chooses the port. This form uses whichever Northflank login is current in your terminal, so the provider above is the better choice:

```json
"northflank-prod": {
  "type": "postgres",
  "host": "pg.northflank.internal",
  "username": "vendure",
  "password": { "$keychain": "northflank-prod" },
  "database": "vendure",
  "ssl": true,
  "tunnel": {
    "command": "northflank forward addon --project my-proj --addon pg --skipHostnames",
    "endpointPattern": "exposed (?:locally )?on (?<host>[\\d.]+):(?<port>\\d+)"
  }
}
```

`kubectl port-forward svc/postgres :5432` behaves the same way, and matches `"Forwarding from 127\\.0\\.0\\.1:(?<port>\\d+)"`.

`endpointPattern` cannot be combined with `localPort` or `{{port}}`, since those dictate an endpoint rather than discovering one. If the pattern never matches, the error shows the pattern alongside the command's actual output so you can see what to change.

#### Commands that need sudo

The forwarding process runs in the background with no terminal, so that it outlives the sherlock command that started it. `sudo` therefore has nowhere to prompt for a password, and the tunnel fails immediately. Three ways round it, best first:

1. **Use a provider, or the tool's no-root option** if it has one, such as Northflank's `--skipHostnames` above. Nothing else to configure.
2. **Grant that one command passwordless sudo** with a `NOPASSWD` rule in `/etc/sudoers`.
3. **Use `sudo -A`** with `SUDO_ASKPASS` pointing at a helper that supplies the password without a terminal.

Sherlock detects this failure and lists these three options in the error.

The connection's `host` and `port` are replaced by the tunnel's local endpoint, so they can be left out or left pointing at the real remote address, whichever documents the connection better.

The `sherlock manage` wizard asks whether a connection needs a tunnel when you add one, and "Configure tunnel" in the edit menu changes it later. It asks how the database is reached: through a provider, or a command. For a Northflank addon it lists the contexts in your Northflank CLI config, then that context's projects and their database addons, so nothing has to be typed or looked up.

To set one up in a single command, `sherlock connection add` takes the same settings as flags:

```bash
# a northflank addon, through the provider
printf '%s' "$PASSWORD" | sherlock connection add vcloud-dev \
  --type postgres --host primary.pg--my-project--abc1.addon.code.run \
  --database app --username dbuser --password-stdin --ssl require \
  --tunnel-provider northflank \
  --tunnel-option context=my-team --tunnel-option project=my-project --tunnel-option addon=pg

# anything that takes a port
printf '%s' "$PASSWORD" | sherlock connection add bastion \
  --type postgres --host db.internal --database app --username dbuser --password-stdin \
  --tunnel-command 'ssh -N -L {{port}}:db.internal:5432 bastion.example.com'
```

`--tunnel-provider <id>` takes the provider's settings as repeated `--tunnel-option key=value`. `--tunnel-northflank <project>/<addon>` writes a Northflank CLI command tunnel instead, with the command and the pattern that reads the port back out of its output. `--tunnel-local-port`, `--tunnel-endpoint-pattern`, `--tunnel-idle-timeout` and `--tunnel-ready-timeout` map to the config fields above. The tunnel settings are validated as the connection is written, so a bad command or duration fails there rather than on the first query.

Manage running tunnels with:

```bash
sherlock tunnel status                 # Show running tunnels
sherlock tunnel stop northflank-prod   # Stop one tunnel
sherlock tunnel stop                   # Stop all tunnels
```

Sherlock waits for the local port to start accepting before it connects, so a tunnel that fails to come up reports the provider's or the forwarding command's own error rather than a connection refusal. Each tunnel's log is kept in `~/.config/sherlock/tunnels/`.

`sherlock connection list` reports each connection's tunnel the same way `connection add` and `tunnel status` do:

```json
"tunnel": {
  "kind": "provider",
  "provider": "northflank",
  "target": "my-project/postgresql (read)",
  "details": { "context": "my-team", "project": "my-project", "addon": "postgresql", "endpoint": "read" }
}
```

`kind` is `command` for a command tunnel. A `northflank forward` command is still a command tunnel, but its `details` name the project and addon so `doctor` can check them.

- **Tunnels are refused in a project-local `.sherlock.json`.** A command tunnel runs a shell command, and a provider tunnel uses your platform login. Honouring one from the current directory would mean that cloning a repository and running any sherlock command runs what that repository put in the file. A connection there that has a tunnel fails with an error saying so. Tunnels are read only from your user config directory, a config next to the binary, `--config`, or `SHERLOCK_CONFIG`.
- **`{ "rejectUnauthorized": true }` cannot work through a tunnel.** Certificate verification checks the hostname, which after tunnelling is a loopback address and will never match the database's certificate. Use `"ssl": true` (`--ssl require`) to keep the connection encrypted without hostname verification. Sherlock warns if you configure both.


#### When a connection does not work

```bash
sherlock doctor northflank-prod
```

`doctor` runs these checks in order and stops at the first failure, with what it found and what to change:

1. the connection and its tunnel block are valid;
2. the tunnel forwards to the database the `host` names. A provider tunnel, or a `northflank forward` command, is compared with a Northflank addon hostname; any other command is reported as not checkable rather than passed;
3. the provider can reach its target: for Northflank, the context exists, can see the project, and the addon is a running database of the connection's type;
4. every credential resolves. It reports where each one comes from, never its value;
5. the tunnel comes up;
6. the session is encrypted, when `ssl` is set;
7. `SELECT 1` succeeds in a read-only transaction (PING for Redis), and whether the server is a primary or a replica.

When a check fails, `ok` is false, `error.code` is that check's cause (such as `AUTH_FAILED` or `TUNNEL_DOWN`), `error.details.check` names the check, and `data.checks` holds every check that ran.

#### Adding a tunnel provider

Providers live in `src/tunnel/providers/`, one directory each, and implement the `TunnelProvider` interface in `types.ts`: validate the block, describe the target, open the forward, and optionally diagnose it and recognise the platform's CLI in a command tunnel. Register it in `providers/index.ts`. Nothing else in sherlock refers to a particular provider.


### Credential Sources

Credentials can come from:

| Source | Config syntax | Notes |
|--------|--------------|-------|
| Environment variable | `{ "$env": "VAR_NAME" }` | Also reads from `~/.config/sherlock/.env` |
| OS Keychain | `{ "$keychain": "account-name" }` | macOS Keychain, Windows Credential Manager, Linux Secret Service |

### Managing Keychain Credentials

```bash
# Store a password
sherlock keychain set prod-db

# Show where each connection's password comes from, and whether it is there
sherlock keychain list

# Check whether an entry exists (never prints the password)
sherlock keychain get prod-db

# Delete a password
sherlock keychain delete prod-db
```

### Moving Connections to Another Machine

`sherlock config export` writes your connections, passwords included, to one file encrypted with a passphrase. `sherlock config import` adds them on the other machine.

```bash
# on your laptop
sherlock config export                  # every connection, to ./sherlock-connections.enc
sherlock config export prod -o prod.enc # only "prod"
scp sherlock-connections.enc server:

# on the server
sherlock config import sherlock-connections.enc
rm sherlock-connections.enc
```

- **Every storage method is exported.** Sherlock reads each password from the keychain, the `.env` file, an environment variable or config.json, whichever holds it. A `$env` reference whose variable is not set on the exporting machine is exported as the reference, not a value.
- **Import stores passwords in the OS keychain**, the same way `connection add --password-stdin` does. A plaintext password in the source config.json arrives in the keychain, not in plaintext.
- **With no keychain** (a headless Linux server usually has none), import asks before writing passwords in plaintext into config.json. That file is readable by your user only. Answer no and nothing is imported. On a Mac reached over SSH, the keychain is usually locked rather than missing: answer no, run `security unlock-keychain`, and import again.
- **Existing connections are skipped.** A connection whose name already exists is left alone and reported. Pass `--force` to replace it. If an import fails part-way, config.json is not changed and sherlock puts back the keychain entries it had written, naming any it could not. With `--force`, a replaced connection's `sherlock/<name>` or `sherlock.url/<name>` keychain entry is deleted if it used that entry and nothing in your user config still does. Keychain entries under any other name are never deleted.
- **Import always writes to your user config** (`~/.config/sherlock/config.json`), even when run in a directory with a `.sherlock.json`. `--config` cannot be combined with import. If commands run in that directory, or with `SHERLOCK_CONFIG` set, read a different config, import warns that they will not see the imported connections.
- **The passphrase is always typed at a prompt**, never passed as an argument or piped in, so it stays out of the shell history and the process list. It must be at least 12 characters.
- **Encryption:** scrypt (N=2¹⁷, r=8, p=1) derives the key and AES-256-GCM encrypts the file. The GCM tag covers the file's header as well as its contents. A wrong passphrase, a corrupted file and an edited file all fail to decrypt, and nothing is imported. A file that is incomplete or not an export at all is reported before you are asked for the passphrase. No plaintext copy of a password is written to disk at any point.
- **Check tunnels after import.** A tunnel command runs on the machine that imports it, so import lists every tunnel command it added.
- Delete the export file once it has been imported. It is only as safe as its passphrase.

## Commands

### SQL Commands (require `-c <connection>`)

```bash
sherlock -c <conn> tables              # List all tables
sherlock -c <conn> describe <table>    # Show table schema
sherlock -c <conn> introspect          # Full schema dump (cached)
sherlock -c <conn> introspect --refresh # Refresh cached schema
sherlock -c <conn> query "SELECT ..."  # Execute read-only query
sherlock -c <conn> query --file q.sql  # Query from a file ("-" reads stdin)
sherlock -c <conn> query --timeout 5m "SELECT ..."  # Override the statement timeout
sherlock -c <conn> sample <table>      # Random sample rows (-n <limit>)
sherlock -c <conn> stats <table>       # Data profiling (row count, nulls, distinct)
sherlock -c <conn> indexes <table>     # Show table indexes
sherlock -c <conn> fk <table>          # Foreign key relationships
```

### Redis Commands (require `-c <connection>`)

```bash
sherlock -c <conn> info                # Server info, memory, keyspace
sherlock -c <conn> info --section memory # Specific INFO section
sherlock -c <conn> keys "user:*"       # Scan for keys matching pattern
sherlock -c <conn> keys --limit 50     # Limit results (default 100)
sherlock -c <conn> get <key>           # Get value (auto-detects type)
sherlock -c <conn> inspect <key>       # Key metadata (type, TTL, memory, encoding)
sherlock -c <conn> slowlog             # Recent slow queries
sherlock -c <conn> command GET mykey   # Any read-only Redis command
```

### Management Commands

```bash
sherlock manage               # Connection manager (add, edit, delete, test, keychain, tunnel)
sherlock connection list      # List connections and their targets
sherlock doctor <conn>        # Check a connection step by step
sherlock guide [topic]        # Instructions for AI agents (topics: transfer)
sherlock connection add <n>   # Add a connection non-interactively (see --help)
sherlock update               # Update the binary to the latest release (--yes outside a terminal)
sherlock tunnel status        # Show running tunnels
sherlock tunnel stop [conn]   # Stop one tunnel, or all when no name is given
sherlock config export [conn] # Write connections and passwords to an encrypted file
sherlock config import <file> # Add the connections from an export file
```

### Options

```bash
-c, --connection <name>    # Connection to use (required unless -u is given or a project directory selects one)
-u, --url <url>            # Connect to a database URL without saving it
--config <path>            # Override config file location
--no-log                   # Disable query logging (overrides config)
-f, --format <format>      # json (the envelope, default) or human (markdown is another name for it)
--max-rows <n>             # Most rows a result returns (default 200)
--max-cell <n>             # Most characters of a text cell (default 500)
--max-bytes <n>            # Most bytes of a whole result as JSON (default 32768)
--no-limit                 # Remove all three caps
```

## Query Logging

Query logging is **disabled by default** to protect sensitive production data. When enabled, queries and results are logged to `~/.config/sherlock/logs/<connection>.md`.

### Enabling Logging

Enable logging per-connection in your config:

```json
{
  "connections": {
    "local-dev": {
      "type": "postgres",
      "logging": true
    }
  }
}
```

Or toggle it via the interactive wizard:

```bash
sherlock manage
# Edit connection → Toggle query logging
```

The `--no-log` CLI flag can override to force logging off even if enabled in config.

## Agent Skill

The `sherlock` skill lives in [.claude/skills/sherlock](.claude/skills/sherlock) and follows the [Agent Skills](https://agentskills.io) format. Install it for any supported agent with the [skills CLI](https://skills.sh):

```bash
npx skills add michaelbromley/sherlock -g          # choose agents interactively
npx skills add michaelbromley/sherlock -g -a codex # or name them
```

The skill expects `sherlock` on your PATH and says so in its `compatibility` field. It is deliberately short: it tells the agent when to use sherlock, and to start by running `sherlock guide`, which prints the full instructions for agents. The guide is built into the binary, so it always describes the commands the installed version has, even when the skill and the binary were installed or updated at different times. `sherlock guide transfer` covers moving connections between machines. The guide's text lives in [src/guide](src/guide).

## Demo Database

Test with the included Chinook sample database:

```bash
# Download sample data and start Docker containers
bun run setup:demo
docker-compose up -d

# Query it by URL, no connection setup needed
sherlock -u "postgres://dbuser:password@localhost:5432/chinook" tables
sherlock -u "postgres://dbuser:password@localhost:5432/chinook" query "SELECT name FROM artist LIMIT 5"
```

## Security

- **Read-only enforced** - SQL: INSERT, UPDATE, DELETE, DROP etc. are blocked, and the database itself refuses writes (see below). Redis: SET, DEL, FLUSHDB etc. are blocked
- **No default connection** - A query names its connection with `-c`, or runs inside a directory configured for one
- **Secure credential storage** - Keychain or env vars. A plaintext password in config works, with a `PLAINTEXT_PASSWORD` warning on every command that uses it
- **Config permissions** - Files created with 0600 (owner read/write only)
- **Query validation** - SQL: one statement only, and dangerous keywords blocked even in subqueries. String literals, quoted identifiers and comments are set aside first, following each database's quoting rules, so `WHERE action = 'delete'` is allowed. MySQL executable comments (`/*! ... */`) are refused. Redis: whitelist of allowed commands with subcommand validation
- **Read-only at the database** - On PostgreSQL and MySQL/MariaDB every statement runs inside a read-only transaction that is always rolled back, so a write the keyword check cannot see, such as one made by a function, is refused by the database. On MySQL the session is read-only too, because a DDL statement commits the transaction implicitly and would otherwise run outside it. The statement is sent through a protocol on which the server refuses a second statement chained after it (a cursor on PostgreSQL, a connection without multiple statements on MySQL), so a statement cannot end the transaction and write after it even if the keyword check misreads it. SQLite databases are opened read-only, and SQLite runs only the first statement. SQL Server has neither a read-only transaction nor a single-statement protocol, so there the keyword check is the only guard
- **Statement timeout** - Every statement is cancelled after 60 seconds by default. Set `"statementTimeout": "5m"` on a connection to change it, or pass `query --timeout`
- **Connect timeout** - A connection that gets no answer within 10 seconds fails, rather than waiting on the driver's own longer default. A tunnel whose far end is gone still accepts connections locally, so this is what makes it fail fast, with an error that names the tunnel and how to restart it. Set `"connectTimeout": "30s"` on a connection that is slow to answer

### Allowed SQL Query Types

- `SELECT`
- `SHOW`
- `DESCRIBE`
- `EXPLAIN`
- `WITH` (CTEs)

### Allowed Redis Commands

Read-only commands only: `GET`, `MGET`, `HGETALL`, `LRANGE`, `SMEMBERS`, `ZRANGE`, `SCAN`, `TYPE`, `TTL`, `INFO`, `DBSIZE`, `SLOWLOG GET`, `MEMORY USAGE`, and more. Mutations (`SET`, `DEL`, `HSET`, `LPUSH`, etc.) and admin commands (`FLUSHDB`, `CONFIG SET`, `SHUTDOWN`, etc.) are blocked.

## Building

```bash
# Development
bun run src/query-db.ts -c mydb tables

# Build binary
bun build ./src/query-db.ts --compile --outfile sherlock

# Cross-platform builds
bun build ./src/query-db.ts --compile --target=bun-darwin-arm64 --outfile sherlock-macos-arm64
bun build ./src/query-db.ts --compile --target=bun-linux-x64 --outfile sherlock-linux-x64
bun build ./src/query-db.ts --compile --target=bun-linux-arm64 --outfile sherlock-linux-arm64
```

A Linux binary only stores passwords in the OS keychain if you build it on a Linux machine with the same architecture. Sherlock reaches the Linux keychain through `@napi-rs/keyring`, a native module, and `bun install` only installs the copy for the machine it runs on. A cross-compiled Linux binary works with passwords from `.env` or environment variables, but fails when it reads or writes the keychain. The release workflow builds each Linux binary on a runner of its own architecture.

## Releasing a New Version

1. Update the version in `package.json`
2. Update `CHANGELOG.md` with all changes since the last release (check `git log` since the last version tag)
3. Commit the changes:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Bump version to X.Y.Z"
   ```
4. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```

The GitHub Actions workflow builds the macOS (Apple silicon), Linux x64 and Linux arm64 binaries and creates a release.

## License

MIT
