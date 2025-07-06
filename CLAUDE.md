# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
- `npm run build` - Build TypeScript to JavaScript in dist/
- `npm run build:bun` - Build using Bun runtime
- `npm run dev` - Run CLI tool in development mode using tsx
- `npm run dev:bun` - Run CLI tool in development mode using Bun
- `npm run test` - Run tests using Vitest
- `npm run test:bun` - Run tests using Bun
- `npm run prepublishOnly` - Runs before publishing, executes build

### CLI Commands
- `npx sqlitebridge all` - Generate all artifacts (models, migrations, services, dexie, database service)
- `npx sqlitebridge model` - Generate TypeScript models from SQL migrations
- `npx sqlitebridge service` - Generate service classes/hooks from SQL queries
- `npx sqlitebridge migration` - Generate migration utilities
- `npx sqlitebridge dexie` - Generate Dexie.js schema for web platform
- `npx sqlitebridge database-service` - Generate database service for platform detection and management
- `npx sqlitebridge config` - Show configuration help and current settings
- `npx sqlitebridge version` - Display version information

## Architecture

### Core Structure
This is a CLI tool that generates TypeScript code from SQLite migrations and SQL queries. It supports both Angular and React frameworks and runs on both Node.js and Bun runtimes.

### Key Components
- **CLI Entry Point**: `src/bin/sqlitebridge.ts` - Main CLI interface using Commander.js
- **Configuration**: `src/config.ts` - Runtime detection and configuration management
- **Generators**: `src/generators/` - Code generation modules:
  - `model-generator.ts` - Generates TypeScript interfaces from SQL tables
  - `service-generator.ts` - Generates Angular services or React hooks
  - `migrate-generator.ts` - Generates migration utilities
  - `dexie-generator.ts` - Generates Dexie.js schemas for web platform
  - `database-service-generator.ts` - Generates main database service with platform detection
- **Utils**: `src/utils/` - Utility functions:
  - `sql-parser.ts` - Parses SQL DDL statements
  - `type-mapping.ts` - Maps SQL types to TypeScript types
  - `file-utils.ts` - Cross-platform file operations
  - `runtime-detector.ts` - Detects Bun vs Node.js runtime

### Runtime Support
The codebase is designed to work with both Bun and Node.js runtimes:
- Uses conditional imports and runtime detection
- File operations abstracted through `file-utils.ts`
- Cross-platform path handling in `config.ts`

### Framework Support
- **Angular**: Generates Injectable services with dependency injection
- **React**: Generates hooks and context providers
- Framework detection through config file or CLI options

### Input/Output Flow
1. **Input**: SQL migration files (V1__description.sql format) + SQL query files
2. **Processing**: Parse SQL DDL, extract table definitions, analyze queries
3. **Output**: TypeScript models, services/hooks, migration utilities, Dexie schemas, database service

### Configuration
- `sqlitebridge.config.json` - Project configuration file
- Default configurations for Angular and React frameworks
- Configurable output paths and generation options

### Testing
- Uses Vitest for testing (Node.js) and Bun's built-in test runner (Bun)
- No test files exist yet - tests would need to be created
- Test files should follow Vitest conventions for Node.js or Bun test patterns

## Development Notes

### Adding New Generators
New generators should be added to `src/generators/` and exported from `index.ts`. They should follow the pattern of taking input paths, output paths, and configuration options.

### Cross-Platform Compatibility
When adding file operations, use the utilities in `src/utils/file-utils.ts` to ensure compatibility across Bun and Node.js runtimes.

### SQL Parsing
The SQL parser in `src/utils/sql-parser.ts` handles CREATE TABLE, ALTER TABLE, and CREATE INDEX statements. Extend this when adding support for new SQL constructs.

### Migration File Naming
Migration files must follow the pattern `V<version>__<description>.sql` (e.g., `V1__create_user_table.sql`). This pattern is defined by the `migrationPattern` config option.

### Query Files
Custom SQL queries should be placed in separate files named after the table (e.g., `users.sql`) with query names prefixed by `-- :<queryName>` comments.

### Database Service Generation
The database service generator automatically creates a `database.service.ts` file when generating services. This service handles:
- Platform detection (native vs web)
- Database initialization and migration management
- Connection handling for both SQLite (native) and Dexie (web)
- Development mode database reset functionality
- The service is automatically generated if it doesn't exist and won't overwrite existing customizations