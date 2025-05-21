import { basename, join } from 'node:path';
import { Migration } from '../types';
import * as utils from '../utils'

/**
 * Generate SQLite migrations array from a directory of migration files
 * @param directoryPath Path to the directory containing migration files
 * @param outputPath Path where the output file will be written
 * @param pattern Regular expression pattern to match migration files
 * @returns void
 */
export function generateSqliteMigrationsFromDir(
    directoryPath: string,
    outputPath: string,
    pattern: RegExp = /^V\d+__.+\.sql$/
): void {
    try {
        // Check if directory exists
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

        // Process each file
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
 * Generate the content of the migrations array
 * @param migrations Array of migration objects
 * @returns Generated content
 */
function generateMigrationsArrayContent(migrations: Migration[]): string {
    let output = `// Auto-generated SQLite migrations array from SQL files\n`;
    output += `// Generated on ${new Date().toISOString()}\n\n`;

    output += `import { capSQLiteVersionUpgrade } from "@capacitor-community/sqlite";\n\n`

    output += `/**\n * SQLite migration definition\n */\n`;
    output += `export interface Migration {\n`;
    output += `  /** Version number of this migration */\n`;
    output += `  version: number;\n`;
    output += `  /** Human-readable description of what this migration does */\n`;
    output += `  description: string;\n`;
    output += `  /** Array of SQL queries to execute for this migration */\n`;
    output += `  queries: string[];\n`;
    output += `}\n\n`;

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
    output += `/**\n * Prepare migration statements for Capacitor SQLite\n * @returns Upgrade statements for Capacitor SQLite\n */\n`;
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
 * Generate SQLite migrations array from a single file with multiple queries
 * @param sqlFilePath Path to the SQL file
 * @param outputPath Path where the output file will be written
 * @returns void
 */
export function generateSqliteMigrationsFromFile(sqlFilePath: string, outputPath: string): void {
    try {
        // Check if file exists
        const content = utils.readFile(sqlFilePath);
        if (!content) return;

        console.log(`Processing file: ${sqlFilePath}`);

        const fileName = basename(sqlFilePath);
        const versionInfo = utils.extractVersionInfo(fileName);

        // If can't extract version from filename, use version 1 and generic description
        const version = versionInfo ? versionInfo.version : 1;
        const description = versionInfo ? versionInfo.description : 'Initial Schema';

        const queries = utils.extractQueriesFromContent(content);

        if (queries.length === 0) {
            console.error(`Error: No valid SQL queries found in ${sqlFilePath}.`);
            return;
        }

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
