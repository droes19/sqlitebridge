import * as path from 'path';
import * as utils from '../utils';
import { FileInfo, TableDefinition, Version } from '../types';

/**
 * Processes SQL migration files and generates a Dexie.js schema and database class.
 * This allows the application to work with the same database schema on web platforms
 * where SQLite is not available natively.
 *
 * @param directoryPath - Path to directory containing migration SQL files
 * @param outputPath - Path where the output Dexie schema file will be written
 * @param pattern - RegExp pattern to match migration files (default: /^V\d+__.+\.sql$/)
 * 
 * @example
 * ```typescript
 * // Generate Dexie schema from migrations in the migrations folder
 * generateDexieMigrationFromDir('./migrations', './src/app/database/dexie-schema.ts');
 * ```
 */
export function generateDexieMigrationFromDir(
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

        // Parse each file and extract tables and alterations
        const parsedFiles: FileInfo[] = [];

        files.forEach(file => {
            const filePath = path.join(directoryPath, file);
            const version = utils.extractVersionFromFileName(file);

            if (!version) {
                console.warn(`Warning: Could not extract version number from ${file}, skipping.`);
                return;
            }

            console.log(`Processing: ${file} (version ${version})`);

            const sqlContent = utils.readFile(filePath);
            if (!sqlContent) return;

            // Parse CREATE TABLE statements
            const tables = utils.parseCreateTableStatements(sqlContent, file).tables;

            // Parse ALTER TABLE statements and get alterations
            const alterations = utils.parseAlterTableStatements(sqlContent, tables, file);

            parsedFiles.push({
                version,
                tables,
                alterations
            });
        });

        // Group tables by version with proper column tracking
        const versions = processFilesToVersions(parsedFiles);

        // Output some debug information
        versions.forEach((version) => {
            console.log(`\nVersion ${version.version} has ${version.tables.length} tables:`);
            version.tables.forEach(table => {
                console.log(`- ${table.name} with columns: ${table.columns.map(c => c.name).join(', ')}`);
            });
        });

        // Generate Dexie migration array
        const migrationContent = generateDexieMigrationArray(versions);

        // Write output file
        if (utils.writeToFile(outputPath, migrationContent)) {
            console.log(`\nSuccessfully generated Dexie migration versions.`);
            console.log(`Found ${versions.length} schema versions.`);
            console.log(`Output written to: ${outputPath}`);
        }
    } catch (error) {
        console.error('Error generating Dexie migrations:', error);
    }
}

/**
 * Processes parsed files to extract versions with proper column tracking.
 * This function builds the complete database schema evolution across versions.
 * 
 * @param parsedFiles - Array of parsed file information containing tables and alterations
 * @returns Array of version objects with complete schemas
 * 
 * @internal
 */
function processFilesToVersions(parsedFiles: FileInfo[]): Version[] {
    // This is a more careful implementation of version tracking
    const versions: Version[] = [];

    // Track all tables and their columns across versions
    const allTables: Record<string, TableDefinition> = {};

    // Sort by version number
    parsedFiles.sort((a, b) => a.version - b.version);

    console.log("Processing files:", parsedFiles.map(f => ({
        version: f.version,
        tables: f.tables.map(t => t.name),
        alterations: f.alterations ? f.alterations.map(a => `${a.tableName}.${a.columnName}`) : []
    })));

    // Process each file's changes
    parsedFiles.forEach(fileInfo => {
        const version = fileInfo.version;

        // Apply CREATE TABLE statements first
        fileInfo.tables.forEach(table => {
            // If this is a new table, just add it to our tracking
            if (!allTables[table.name]) {
                allTables[table.name] = structuredClone(table);
            } else {
                // If table already exists, this is a table redefinition
                // Replace the existing table definition with the new one
                allTables[table.name] = structuredClone(table);
            }
        });

        // Then apply ALTER TABLE statements
        if (fileInfo.alterations && fileInfo.alterations.length > 0) {
            fileInfo.alterations.forEach(alteration => {
                const { tableName, columnName, columnInfo } = alteration;

                if (allTables[tableName]) {
                    // Check if column already exists
                    const existingColumnIndex = allTables[tableName].columns.findIndex(
                        col => col.name === columnName
                    );

                    if (existingColumnIndex >= 0) {
                        // Update existing column
                        allTables[tableName].columns[existingColumnIndex] = columnInfo;
                    } else {
                        // Add new column
                        allTables[tableName].columns.push(columnInfo);
                    }

                    // Update indexedColumns if needed
                    if (!allTables[tableName].indexedColumns) {
                        allTables[tableName].indexedColumns = [];
                    }

                    if (columnInfo.isPrimaryKey || columnInfo.isUnique || columnName.endsWith('_id')) {
                        if (!allTables[tableName].indexedColumns.includes(columnName)) {
                            allTables[tableName].indexedColumns.push(columnName);
                        }
                    }
                } else {
                    console.warn(`Warning: ALTER TABLE for non-existent table ${tableName} in version ${version}`);
                }
            });
        }

        // Create a deep copy of the current state of all tables for this version
        const versionTables = Object.values(allTables).map(table => structuredClone(table));

        versions.push({
            version,
            tables: versionTables
        });

        // Debug log
        console.log(`After version ${version} processing:`,
            Object.keys(allTables).map(tableName => ({
                name: tableName,
                columns: allTables[tableName].columns.map(c => c.name)
            }))
        );
    });

    return versions;
}

/**
 * Generate Dexie schema structure for all versions.
 * Creates a TypeScript file with a Dexie database class.
 * 
 * @param versions - Array of version objects with tables
 * @returns Generated migration array content as a string
 * 
 * @internal
 */
function generateDexieMigrationArray(versions: Version[]): string {
    let output = `// Auto-generated Dexie.js database class from SQLite migrations\n`;
    output += `// Generated on ${new Date().toISOString()}\n\n`;

    // Import Dexie for TypeScript types
    output += `import Dexie from 'dexie';\n\n`;

    // Add database class that directly uses the versions
    if (versions.length > 0) {
        output += generateDexieDatabaseClass(versions);
    }

    return output;
}

/**
 * Generate a Dexie database class without interfaces.
 * The class includes version definitions for all migrations.
 * 
 * @param versions - Array of version objects with tables
 * @returns Generated database class content as a string
 * 
 * @internal
 */
function generateDexieDatabaseClass(versions: Version[]): string {
    if (!versions || versions.length === 0) {
        return '';
    }

    // Use the latest version for table definitions
    const latestVersion = versions[versions.length - 1];

    let output = `\n/**\n * Dexie database class with all migrations applied\n */\n`;
    output += `export class AppDatabase extends Dexie {\n`;

    // Add table properties
    latestVersion.tables.forEach(table => {
        output += `  // Table for ${table.name}\n`;
        output += `  ${table.name}: Dexie.Table<any, number>;\n`;
    });

    // Constructor with configurable name
    output += `\n  constructor(dbName: string = 'AppDatabase') {\n`;
    output += `    super(dbName);\n\n`;

    // Group commented versions
    output += `    // Define schema versions\n`;

    // Debug: Log each version's tables to help troubleshoot
    console.log("Versions to process for Dexie schema:", versions.map(v => ({
        version: v.version,
        tables: v.tables.map(t => t.name)
    })));

    versions.forEach(version => {
        output += `    // v${version.version} migration\n`;
        output += `    this.version(${version.version}).stores({\n`;

        // Add all tables for this version
        version.tables.forEach((table, i) => {
            const isLast = i === version.tables.length - 1;

            // Generate schema string with all columns for this version
            const schemaString = utils.generateDexieSchemaString(table);

            // Debug: Log the schema string for each table
            console.log(`Version ${version.version}, Table ${table.name} schema: ${schemaString}`);
            console.log(`Columns: ${table.columns.map(c => c.name).join(', ')}`);

            output += `      ${table.name}: '${schemaString}'${isLast ? '' : ','}\n`;
        });

        output += `    });\n\n`;
    });

    // Initialize table references
    output += `    // Initialize table references\n`;
    latestVersion.tables.forEach(table => {
        output += `    this.${table.name} = this.table('${table.name}');\n`;
    });

    output += `  }\n`;
    output += `}\n\n`;

    // Export instance
    output += `// Export a database instance with default name\n`;
    output += `export const db = new AppDatabase();\n`;

    return output;
}