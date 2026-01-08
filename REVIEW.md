# Sherlock Code Review - Nigel's Report

## Must Fix - DONE

1. ~~**`any` types everywhere**~~ - Added proper types: `QueryResult`, `SchemaInfo`, `TableDescription`, `ErrorWithMessage`, `DbType`
2. ~~**Validation logic buried in CLI**~~ - Extracted to `src/query-validation/index.ts`
3. ~~**`process.exit()` in `withConnection()`**~~ - Removed, errors now bubble up to top-level handler
4. ~~**Dead code**~~ - Deleted `src/load-config.ts`

## Should Fix - MOSTLY DONE

5. ~~**Handrolled password prompt**~~ - Now uses `@clack/prompts`
6. ~~**Magic string DB types**~~ - Centralized in `src/db-types.ts` with `DB_TYPES`, `DEFAULT_PORTS`, `TEST_QUERIES`
7. **Config singleton with mutable state** - Still pending (lower priority)
8. ~~**Inconsistent error handling**~~ - Standardized to `error: unknown` with helper functions

## Nice to Have - DONE

9. ~~Magic numbers~~ - Extracted `MAX_LOG_ROWS` and `SECURE_FILE_MODE` constants
10. ~~Naming inconsistencies~~ - Reviewed, current naming is actually consistent (`get*`, `ensure*`, `find*`)
11. ~~Obvious comments~~ - Removed redundant ones, kept useful section markers
12. ~~Platform-specific chmod~~ - Added `setSecurePermissions()` helper that skips on Windows

## Positive Notes

- Credential provider architecture is solid
- Config discovery order is textbook
- Whitelist approach in validateReadOnlyQuery is correct
- File permissions on sensitive files
- TUI wizards are nice
- Native macOS security command for keychain

## File References

- Main CLI: `src/query-db.ts`
- Config system: `src/config/index.ts`
- Type definitions: `src/config/types.ts`
- Credentials: `src/credentials/`
- Keychain provider: `src/credentials/providers/keychain.ts`
- TUI: `src/tui/index.ts`
- Dead code: `src/load-config.ts`
