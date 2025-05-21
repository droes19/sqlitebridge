/**
 * Migration Generator Module
 * 
 * This module processes SQLite migration files and generates TypeScript code
 * for handling database migrations in both native SQLite and web environments.
 * It extracts SQL queries from migration files and organizes them into a structured
 * format that can be used with @capacitor-community/sqlite.
 * 
 * @packageDocumentation
 */

import { basename, join } from 'node:path';
import { Migration } from '../types';
import * as utils from '../utils';

/**
 * Generate SQLite migrations array from a directory of migration files.
 * 
 * This function scans a directory for SQL migration files, extracts the SQL queries,
 * and generates a TypeScript file with an array of all migrations and helper functions.
 * 
 * @param directoryPath - Path to the directory containing migration files
 * @param outputPath - Path where the output file will be written
 * @param pattern - Regular expression pattern to match migration files (default: /^V\d+__.+\.sql$/)
 * 
 * @example
 * ```typescript
 * // Generate migrations from all SQL files in the 'migrations' directory
 * generateSqliteMigrationsFromDir('./migrations', './src/app/core/database/migrations.ts');
 * ```
 */
export function generateSqliteMigrationsFromDir(
    directoryPath: string,
    outputPath: string,
    pattern: RegExp = /^V\d+__.+\.sql$/
): void {
    try {
        // Validate directory exists
        if (!utils.checkDirExists(directoryPath)) {
            console.error(`Error: ${directoryPath} is not a valid directory.`);
            return;
        }

        console.log(`Processing migration files in ${directoryPath}...`);

        // Get all SQL files in the directory that match the pattern
        const files = utils.getSqlFilesInDirectory(directoryPath, pattern);

        if (files.length === 0) {
            console.error(`No migration files matching the pattern ${pattern} found in ${directoryPath}.`);
            return;
        }

        console.log(`Found ${files.length} migration files.`);

        // Process each file to extract migrations
        const migrations = extractMigrationsFromFiles(files, directoryPath);

        // Sort migrations by version
        migrations.sort((a, b) => a.version - b.version);

        // Generate output content
        const output = generateMigrationsArrayContent(migrations);

        // Write output file
        if (utils.writeToFile(outputPath, output)) {
            console.log(`\nSuccessfully generated SQLite migrations array.`);
            console.log(`Generated ${migrations.length} migration versions.`);
            console.log(`Output written to: ${outputPath}`);
        }
    } catch (error) {
        console.error('Error generating SQLite migrations array:', error);
    }
}

/**
 * Extracts migrations from a list of SQL files.
 * 
 * @param files - Array of file names
 * @param directoryPath - Path to the directory containing the files
 * @returns Array of migration objects
 * 
 * @internal
 */
function extractMigrationsFromFiles(files: string[], directoryPath: string): Migration[] {
    const migrations: Migration[] = [];

    files.forEach(file => {
        const filePath = join(directoryPath, file);
        const versionInfo = utils.extractVersionInfo(file);

        if (!versionInfo) {
            console.warn(`Warning: Could not extract version information from ${file}, skipping.`);
            return;
        }

        console.log(`Processing: ${file} (version ${versionInfo.version} - ${versionInfo.description})`);

        const content = utils.readFile(filePath);
        if (!content) return;

        const queries = utils.extractQueriesFromContent(content);

        if (queries.length === 0) {
            console.warn(`Warning: No valid SQL queries found in ${file}, skipping.`);
            return;
        }

        migrations.push({
            version: versionInfo.version,
            description: versionInfo.description,
            queries: queries
        });
    });

    return migrations;
}

/**
 * Generate the content of the migrations array.
 * 
 * @param migrations - Array of migration objects
 * @returns Generated content as a string
 * 
 * @internal
 */
function generateMigrationsArrayContent(migrations: Migration[]): string {
    let output = `// Auto-generated SQLite migrations array from SQL files\n`;
    output += `// Generated on ${new Date().toISOString()}\n\n`;

    output += `import { capSQLiteVersionUpgrade } from "@capacitor-community/sqlite";\n\n`;

    // Generate Migration interface
    output += generateMigrationInterface();

    // Add the migrations array
    output += `/**\n * Array of all SQLite migrations to apply\n */\n`;
    output += `export const ALL_MIGRATIONS: Migration[] = [\n`;

    // Add each migration
    migrations.forEach((migration, index) => {
        const isLast = index === migrations.length - 1;

        output += `  {\n`;
        output += `    version: ${migration.version},\n`;
        output += `    description: '${migration.description.replace(/'/g, "\\'")}',\n`;
        output += `    queries: [\n`;

        // Add each query with proper formatting
        migration.queries.forEach((query, queryIndex) => {
            const isLastQuery = queryIndex === migration.queries.length - 1;

            // Format SQL string with consistent indentation
            output += `      \`${query}\`${isLastQuery ? '' : ','}\n`;
        });

        output += `    ]\n`;
        output += `  }${isLast ? '' : ','}\n`;
    });

    output += `];\n\n`;

    // Add migration setup helper for Capacitor SQLite
    output += generateMigrationHelpers();

    return output;
}

/**
 * Generates the Migration interface definition.
 * 
 * @returns Generated interface as a string
 * 
 * @internal
 */
function generateMigrationInterface(): string {
    let output = `/**\n * SQLite migration definition\n */\n`;
    output += `export interface Migration {\n`;
    output += `  /** Version number of this migration */\n`;
    output += `  version: number;\n`;
    output += `  /** Human-readable description of what this migration does */\n`;
    output += `  description: string;\n`;
    output += `  /** Array of SQL queries to execute for this migration */\n`;
    output += `  queries: string[];\n`;
    output += `}\n\n`;
    
    return output;
}

/**
 * Generates helper functions for migration handling.
 * 
 * @returns Generated helper functions as a string
 * 
 * @internal
 */
function generateMigrationHelpers(): string {
    let output = `/**\n * Prepare migration statements for Capacitor SQLite\n * @returns Upgrade statements for Capacitor SQLite\n */\n`;
    output += `export function prepareMigrations(): capSQLiteVersionUpgrade[] {\n`;
    output += `  // Create migrations table first\n`;
    output += `  const createMigrationsTable = \`\n`;
    output += `    CREATE TABLE IF NOT EXISTS migrations (\n`;
    output += `      version INTEGER PRIMARY KEY,\n`;
    output += `      description TEXT NOT NULL,\n`;
    output += `      executed_at TEXT NOT NULL\n`;
    output += `    )\n`;
    output += `  \`;\n\n`;

    output += `  // Prepare upgrade statements for each version\n`;
    output += `  const upgradeStatements: capSQLiteVersionUpgrade[] = [];\n\n`;

    output += `  // Add upgrade statement for each migration\n`;
    output += `  for (const migration of ALL_MIGRATIONS) {\n`;
    output += `    upgradeStatements.push({\n`;
    output += `      toVersion: migration.version,\n`;
    output += `      statements: [createMigrationsTable, ...migration.queries]\n`;
    output += `    });\n`;
    output += `  }\n\n`;

    output += `  return upgradeStatements;\n`;
    output += `}\n`;
    
    return output;
}

/**
 * Generate SQLite migrations array from a single file with multiple queries.
 * 
 * This function processes a single SQL file, extracts the SQL queries,
 * and generates a TypeScript file with the migration and helper functions.
 * 
 * @param sqlFilePath - Path to the SQL file
 * @param outputPath - Path where the output file will be written
 * 
 * @example
 * ```typescript
 * // Generate migrations from a single SQL file
 * generateSqliteMigrationsFromFile('./migrations/V1__initial_schema.sql', './src/app/core/database/migrations.ts');
 * ```
 */
export function generateSqliteMigrationsFromFile(sqlFilePath: string, outputPath: string): void {
    try {
        // Check if file exists and read content
        const content = utils.readFile(sqlFilePath);
        if (!content) {
            console.error(`Error: Could not read file ${sqlFilePath}.`);
            return;
        }

        console.log(`Processing file: ${sqlFilePath}`);

        const fileName = basename(sqlFilePath);
        const versionInfo = utils.extractVersionInfo(fileName);

        // If can't extract version from filename, use version 1 and generic description
        const version = versionInfo ? versionInfo.version : 1;
        const description = versionInfo ? versionInfo.description : 'Initial Schema';

        // Extract SQL queries from the file
        const queries = utils.extractQueriesFromContent(content);

        if (queries.length === 0) {
            console.error(`Error: No valid SQL queries found in ${sqlFilePath}.`);
            return;
        }

        // Create a single migration
        const migrations: Migration[] = [
            {
                version: version,
                description: description,
                queries: queries
            }
        ];

        // Generate output content
        const output = generateMigrationsArrayContent(migrations);

        // Write output file
        if (utils.writeToFile(outputPath, output)) {
            console.log(`\nSuccessfully generated SQLite migrations array.`);
            console.log(`Generated 1 migration version with ${queries.length} queries.`);
            console.log(`Output written to: ${outputPath}`);
        }
    } catch (error) {
        console.error('Error generating SQLite migrations array:', error);
    }
}