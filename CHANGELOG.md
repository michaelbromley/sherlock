# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
