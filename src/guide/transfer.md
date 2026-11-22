# Moving Connections to Another Machine

Use this when the user wants their connections on another machine, such as a server where sherlock has just been installed. Do everything yourself except the one command that needs the user.

**The user must be involved for exactly two things:** typing the passphrase, which you must never see, and deciding whether to replace connections that already exist on the other machine. Do not ask them anything else. Work out the rest yourself.

`sherlock config export` and `sherlock config import` read the passphrase from a hidden prompt in a real terminal. They refuse piped input, take no passphrase flag, and fail in your shell. Never ask the user for the passphrase, and never try to supply it.

## 1. Check both machines yourself

First find the sherlock binary on each machine, and use those full paths in every later command. A non-interactive `ssh` does not load the PATH set in the shell profile, so search the usual install locations as well:

```bash
FIND='for p in "$(command -v sherlock)" ~/.local/bin/sherlock /usr/local/bin/sherlock ~/.claude/skills/sherlock/sherlock; do [ -x "$p" ] && echo "$p" && break; done'
sh -c "$FIND"                     # <local-sherlock>
ssh <host> "$FIND"                # <remote-sherlock>
```

Then check that both have the commands, and list what is already on each side:

```bash
<local-sherlock> config import --help >/dev/null && echo local-ok
<local-sherlock> connection list
ssh <host> '<remote-sherlock> config import --help >/dev/null && echo remote-ok'
ssh <host> '<remote-sherlock> connection list'
```

- **The host:** use the SSH alias or `user@host` the user named. If they did not name one, look in `~/.ssh/config`. Ask only when there is no way to tell.
- **Sherlock is missing on the remote**, or has no `config import` command: install or update it yourself with `ssh <host> 'curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash'`. Run without a terminal, the installer asks nothing and puts the binary in `~/.local/bin/sherlock`. Do the same locally if the local binary is too old.
- **Which connections:** export all of them unless the user named some. The command below exports one connection by adding its name after `export`. For several, but not all, run the whole command once per connection.
- **Names that exist on both machines:** this is the one decision to ask about. Ask once, listing the names: replace them (add `--force` to the import) or keep the remote ones (leave it off, and import skips them). If nothing overlaps, do not ask.
- **Tunnelled connections** need their forwarding tool on the remote, for example `ssh <host> 'command -v northflank'`. Check this and report anything missing. It does not block the import.

## 2. Give the user one command to paste into their own terminal

Fill in `<host>`, both binary paths, and `--force` in place of `[--force]` if they chose to replace (otherwise remove it). Present it as a single block to copy:

```bash
D="$(mktemp -d)" && F="$D/sherlock-connections.enc" && { <local-sherlock> config export -o "$F"; [ -f "$F" ] && scp -q "$F" <host>:sherlock-connections.enc && ssh -t <host> '<remote-sherlock> config import sherlock-connections.enc [--force]; rm -f sherlock-connections.enc'; rm -f "$F"; rmdir "$D"; }
```

It exports, copies the file, imports on the remote, and deletes the file on both machines, including after a failure. Nothing runs unless the temporary directory was created. Do not change the cleanup to `rm -rf`. Tell the user, briefly, what they will be asked:

1. A new passphrase, twice. They only need it for the next minute, so a long random phrase is fine.
2. The same passphrase once more, on the remote.
3. Possibly "Store the imported passwords in config.json?". This appears when the remote has no usable OS keychain, which is usual on a headless Linux server. Answering yes stores the passwords in plaintext in a file only their user can read. Answering no imports nothing.

**A Mac as the remote** (check with `ssh <host> uname`, which prints `Darwin`): its login keychain is usually locked over SSH, and import would then offer plaintext. Put `security unlock-keychain; ` at the start of the quoted remote command, before `<remote-sherlock>`, and tell the user they will be asked for their Mac login password there.

Then ask them to tell you when it has finished. You do not need them to paste the output back.

## 3. Check the result yourself

```bash
ssh <host> '<remote-sherlock> connection list'
ssh <host> '<remote-sherlock> -c <one imported connection> tables'
```

Compare the remote list with what you meant to export. A connection is missing when it was skipped:

- **Skipped on export:** its keychain entry could not be read on this machine. Fix that entry locally, then repeat step 2 for that connection alone.
- **Skipped on import:** the name already existed and `--force` was not given. This is expected if the user chose to keep the remote connections.

Report what arrived, what was skipped and why, and anything still missing on the remote, such as a tunnel tool that is not installed. If import stopped with "Giving up after 3 attempts", the passphrase was mistyped on the remote. Give them the same command again. Any other import error, such as "not valid JSON" or "corrupted", means the file did not arrive intact, and running the command again makes a fresh file.

Two things do not carry over in a useful form. The `directory` auto-select paths are local-machine paths. A `$env` password whose variable was not set here arrives as a reference to that variable, which must then be set on the remote.

## Reference

```bash
sherlock config export [conn] [-o file] [--force]   # --force overwrites the output file
sherlock config import <file> [--force]             # --force replaces same-named connections
```

- Export reads each password from wherever it is stored and encrypts the file with the passphrase (scrypt + AES-256-GCM). A wrong passphrase and a modified file are both refused.
- Import stores passwords in the OS keychain, and falls back to config.json only after the user agrees. It always writes to the user config, never a project `.sherlock.json`, and does not accept `--config`.
- If an import fails part-way, it leaves config.json unchanged and puts back the keychain entries it wrote. Running it again is safe. If the error also names keychain entries it "could not put back", tell the user. Once the keychain is usable, give them exactly the same command again. Add `--force` only if they chose it the first time, because it would also replace connections the first run skipped.
- Export exits 1 if it skipped any connection, even though the file was still written.
