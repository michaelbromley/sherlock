# Setting Up a Connection

Add a connection without the interactive wizard. The password is stored in the OS keychain, and never appears in the process list, the shell history, or your context.

**When the project already has a database URL**, such as `DATABASE_URL` in its `.env`, set the connection up yourself. Sherlock stores only the variable's name, and reads the URL from the project's `.env` on each query:

```bash
sherlock connection add shop --url-env DATABASE_URL --directory /path/to/project
sherlock doctor shop
```

Run both yourself, and tell the user the result in a line or two. The project's `.env` is read before the environment, so a `DATABASE_URL` exported for another project cannot win. Queries still name it with `-c`. Never copy the URL or its password into a command.

**Otherwise, do everything except the password.** Work out the details from the conversation and the project: the type, host, port, database, username, SSL, a tunnel, and a short connection name. Ask only for what you cannot find. Then give the user one command to run in their own terminal, ending in `--password-prompt`:

```bash
sherlock connection add prod --type postgres --host db.example.com --database app --username dbuser --ssl require --password-prompt
```

It checks every flag first, then asks them for the password at a hidden prompt and stores it in the keychain. Give it as a single line they can paste, and tell them it will ask for the password. When they say it is done, run `sherlock doctor <name>` and report what it finds. If the command failed, they will tell you the error: it names the flag, so fix the command and give it to them again. Run the command yourself only to check it, without `--password-prompt`: it fails with `USAGE` when there is no terminal to ask in.

When the password is already in an environment variable, use `--password-env VAR` and run the command yourself. To script it, pipe the password in with `--password-stdin`:

```bash
# a Northflank addon, forwarded through the Northflank API
printf '%s' "$PASSWORD" | sherlock connection add prod \
  --type postgres --host primary.pg--my-project--abc1.addon.code.run --database app --username dbuser \
  --password-stdin --ssl require \
  --tunnel-provider northflank \
  --tunnel-option context=my-team --tunnel-option project=my-project --tunnel-option addon=pg

# a plain database, no tunnel
printf '%s' "$PASSWORD" | sherlock connection add local \
  --from-url postgres://dbuser@localhost:5432/app --password-stdin

# a tunnel through anything else; {{port}} receives a free local port
printf '%s' "$PASSWORD" | sherlock connection add bastion \
  --type postgres --host db.internal --database app --username dbuser --password-stdin \
  --tunnel-command 'ssh -N -L {{port}}:db.internal:5432 bastion.example.com'
```

- `--from-url <url>` replaces `--host`, `--port`, `--username` and `--database`. A password in the URL is ignored, since it would already be in the shell history. This is a separate flag from the global `-u/--url`, which connects to a URL without saving it.
- `--password-env VAR` stores only the variable name. Sherlock reads the password from that variable on each query.
- `--ssl` takes `off`, `require` or `verify`. `require` is right for most managed databases.
- A MySQL 8 login that fails with an error naming `caching_sha2_password` needs TLS or the server's public key. Try `--ssl require` (or `?ssl-mode=REQUIRED` on a `-u` URL) first. Only if the server has no TLS, ask the user before adding `?allowPublicKeyRetrieval=true` to the `-u` or `--from-url` URL: without TLS, anyone who can intercept the connection can read the password.
- `--tunnel-provider northflank` takes its settings as repeated `--tunnel-option key=value`. It needs `context` (a login name from `northflank context ls`), `project` and `addon` (the ids from the Northflank URL, not the display names). Optional: `endpoint=read` or `endpoint=primary` (default: the read replica if the addon has one), `configDir=~/.northflank-other` when that login lives in a separate CLI config directory, and `port=<name or number>` when the addon exposes several. Ask the user for the context, project and addon if you do not know them. Set `--host` to the addon's internal hostname so `doctor` can check that the tunnel goes to the right addon.
- `--tunnel-northflank <project>/<addon>` writes a `northflank forward --skipHostnames` command tunnel instead. That uses whichever Northflank login is current in the user's terminal, so prefer `--tunnel-provider northflank`.
- `--force` replaces an existing connection of the same name. Without it, an existing name is an error.
- Bad flag combinations fail immediately with `USAGE`, naming the flag in `details.flag`, before anything is written.
- Things worth knowing about the new connection, such as `NO_PASSWORD`, come back as warnings.

Never ask the user to tell you a password, never guess one, and never pass one as a command-line argument: `--password-prompt` lets them type it where you cannot see it.

`connection add --password-stdin` stores the password in the OS keychain. Connections created in other ways may keep it elsewhere: `{ "$env": "VAR" }` (read from the environment or the sherlock `.env` file), `{ "$keychain": "name" }`, or a plaintext string in config.json. A plaintext password brings a `PLAINTEXT_PASSWORD` warning on every command that uses it.

## Tell Later Sessions About It

When the connection is for a project, set it up with `--directory <project>`. Then run this in the project's directory once `doctor` passes:

```bash
sherlock agents-md
```

It writes a short section to the project's AGENTS.md or CLAUDE.md, naming the connections whose `directory` is the project and sherlock's rules, so later sessions see them without reading this guide first. It replaces its own section when run again, and leaves the rest of the file alone. Tell the user which file it changed: `data.file` names it.

## Tunnelled Connections

Some connections reach the database through a tunnel: a Northflank addon forwarded through the Northflank API, or a port-forwarding command (kubectl, ssh). Sherlock opens the tunnel on the first query and reuses it for later commands. You do not need to open one yourself. `connection list` shows each connection's tunnel provider and target.

```bash
sherlock tunnel status                  # Show running tunnels
sherlock tunnel stop <conn>             # Stop one tunnel
sherlock tunnel stop                    # Stop all tunnels
```

**Stop the tunnel when you have finished with a database.** An idle tunnel shuts itself down eventually, so leaving one running does no harm. Stopping it releases the database connection and the local port straight away.

A connection that gets no answer within 10s fails with `CONNECT_TIMEOUT`, and one whose tunnel's far end has gone with `TUNNEL_DOWN`. Their `fix` gives the `sherlock tunnel stop <conn>` command that restarts the tunnel. Run that once and retry. If it fails the same way again, run `doctor` and report what it says rather than retrying further. Agents running sherlock inside a network sandbox may see this on every attempt, because the sandbox's proxy can block the tunnel's connection to Northflank.

A tunnel that fails to start is `TUNNEL_FAILED`, and its message includes the provider's or the forwarding command's own output: read it before retrying. `PROVIDER_AUTH` means the provider rejected the login (for Northflank, log in again), and `PROVIDER_NOT_FOUND` that the login cannot see the project or addon. A command that needs `sudo` cannot work at all, because the tunnel runs with no terminal for sudo to prompt at, and the error names the alternatives.

## When a Connection Does Not Work

Run `sherlock doctor <conn>` before trying fixes of your own. It checks, in order, and stops at the first failure:

1. the config and tunnel are valid;
2. the tunnel forwards to the database the connection's host names, which catches a tunnel copied from another connection;
3. the tunnel provider can see its target (for Northflank: the context exists and can see the project and the addon);
4. every credential resolves, reported by where it comes from, never by value;
5. the tunnel comes up;
6. the session is encrypted, when `ssl` is set;
7. `SELECT 1` succeeds (PING for Redis).

When a check fails, `ok` is false and `error.code` is that check's cause, such as `AUTH_FAILED` or `TUNNEL_DOWN`, not a generic failure. `error.details.check` names the check, and `data.checks` holds every check that ran, each with a `detail` and, when it failed, a `fix`. Tell the user what failed and what the fix is. Changing their Northflank login, keychain or config is for them to do unless they ask you to.
