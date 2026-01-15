# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `sample` command: get random rows from a table (`sherlock -c mydb sample users -n 10`)
- `indexes` command: show indexes for a table (`sherlock -c mydb indexes users`)

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
