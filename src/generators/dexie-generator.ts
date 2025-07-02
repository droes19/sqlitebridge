/**
 * Dexie Generator Module
 * 
 * This module processes SQLite migration files and generates Dexie.js schema and database class.
 * It enables seamless development across mobile and web platforms by creating TypeScript code
 * that works with both SQLite (mobile) and Dexie.js (web) implementations.
 * Supports both Angular and React frameworks with framework-specific optimizations.
 * 
 * @packageDocumentation
 */

import * as path from 'node:path';
import * as utils from '../utils';
import { FileInfo, TableDefinition, Version } from '../types';
import { FrameworkType } from '../config';

/**
 * Processes SQL migration files and generates a Dexie.js schema and database class.
 * This allows the application to work with the same database schema on web platforms
 * where SQLite is not available natively.
 *
 * @param directoryPath - Path to directory containing migration SQL files
 * @param outputPath - Path where the output Dexie schema file will be written
 * @param pattern - RegExp pattern to match migration files (default: /^V\d+__.+\.sql$/)
 * @param framework - Target framework ('angular' | 'react')
 * 
 * @example
 * ```typescript
 * // Generate Dexie schema from migrations for React
 * await generateDexieMigrationFromDir('./migrations', './src/database/dexie-schema.ts', /^V\d+__.+\.sql$/, 'react');
 * 
 * // Generate Dexie schema from migrations for Angular
 * await generateDexieMigrationFromDir('./migrations', './src/app/database/dexie-schema.ts', /^V\d+__.+\.sql$/, 'angular');
 * ```
 */
export async function generateDexieMigrationFromDir(
	directoryPath: string,
	outputPath: string,
	pattern: RegExp = /^V\d+__.+\.sql$/,
	framework: FrameworkType
): Promise<void> {
	try {
		// Validate directory exists
		if (!(await utils.checkDirExists(directoryPath))) {
			console.error(`Error: ${directoryPath} is not a valid directory.`);
			return;
		}

		console.log(`Processing migration files in ${directoryPath}...`);
		console.log(`Target framework: ${framework}`);

		// Get all SQL files in the directory that match the pattern
		const files = await utils.getSqlFilesInDirectory(directoryPath, pattern);

		if (files.length === 0) {
			console.error(`No migration files matching the pattern ${pattern} found in ${directoryPath}.`);
			return;
		}

		console.log(`Found ${files.length} migration files.`);

		// Parse each file and extract tables and alterations
		const parsedFiles: FileInfo[] = [];

		for (const file of files) {
			const filePath = path.join(directoryPath, file);
			const version = utils.extractVersionFromFileName(file);

			if (!version) {
				console.warn(`Warning: Could not extract version number from ${file}, skipping.`);
				continue;
			}

			console.log(`Processing: ${file} (version ${version})`);

			const sqlContent = await utils.readFile(filePath);
			if (!sqlContent) continue;

			// Parse CREATE TABLE statements
			const { tables, enums } = utils.parseCreateTableStatements(sqlContent, file);

			// Parse ALTER TABLE statements and get alterations
			const alterations = utils.parseAlterTableStatements(sqlContent, tables, file);

			parsedFiles.push({
				version,
				tables,
				alterations
			});
		}

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
		const migrationContent = generateDexieMigrationArray(versions, framework);

		// Write output file
		if (await utils.writeToFile(outputPath, migrationContent)) {
			console.log(`\nSuccessfully generated Dexie migration versions for ${framework}.`);
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
 * @param framework - Target framework ('angular' | 'react')
 * @returns Generated migration array content as a string
 * 
 * @internal
 */
function generateDexieMigrationArray(versions: Version[], framework: FrameworkType): string {
	let output = `// Auto-generated Dexie.js database class from SQLite migrations\n`;
	output += `// Generated on ${new Date().toISOString()}\n`;
	output += `// Target framework: ${framework}\n\n`;

	// Add framework-specific imports
	output += generateFrameworkImports(framework);

	// Add database class that directly uses the versions
	if (versions.length > 0) {
		output += generateDexieDatabaseClass(versions, framework);
	}

	// Add framework-specific utilities
	output += generateFrameworkUtilities(versions, framework);

	return output;
}

/**
 * Generate framework-specific imports.
 * 
 * @param framework - Target framework
 * @returns Generated imports as a string
 * 
 * @internal
 */
function generateFrameworkImports(framework: FrameworkType): string {
	let output = `import Dexie from 'dexie';\n`;

	if (framework === 'react') {
		output += `import { useState, useEffect, useCallback } from 'react';\n`;
		output += `import { useLiveQuery } from 'dexie-react-hooks';\n`;
	} else {
		output += `import { Injectable } from '@angular/core';\n`;
		output += `import { BehaviorSubject, Observable } from 'rxjs';\n`;
	}

	output += `\n`;
	return output;
}

/**
 * Generate a Dexie database class with framework-specific features.
 * The class includes version definitions for all migrations.
 * 
 * @param versions - Array of version objects with tables
 * @param framework - Target framework
 * @returns Generated database class content as a string
 * 
 * @internal
 */
function generateDexieDatabaseClass(versions: Version[], framework: FrameworkType): string {
	if (!versions || versions.length === 0) {
		return '';
	}

	// Use the latest version for table definitions
	const latestVersion = versions[versions.length - 1];

	let output = generateClassHeader(framework);

	// Add table properties
	latestVersion.tables.forEach(table => {
		output += `  // Table for ${table.name}\n`;
		output += `  ${table.name}: Dexie.Table<any, number>;\n`;
	});

	// Add framework-specific properties
	if (framework === 'react') {
		output += `\n  // React-specific properties\n`;
		output += `  private _initialized = false;\n`;
		output += `  private _initPromise: Promise<void> | null = null;\n`;
	} else {
		output += `\n  // Angular-specific properties\n`;
		output += `  private _ready$ = new BehaviorSubject<boolean>(false);\n`;
		output += `  public ready$ = this._ready$.asObservable();\n`;
	}

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

	// Add framework-specific initialization
	if (framework === 'react') {
		output += `\n    // React initialization\n`;
		output += `    this.open().then(() => {\n`;
		output += `      this._initialized = true;\n`;
		output += `      console.log('Dexie database initialized for React');\n`;
		output += `    }).catch(error => {\n`;
		output += `      console.error('Failed to initialize Dexie database:', error);\n`;
		output += `    });\n`;
	} else {
		output += `\n    // Angular initialization\n`;
		output += `    this.open().then(() => {\n`;
		output += `      this._ready$.next(true);\n`;
		output += `      console.log('Dexie database initialized for Angular');\n`;
		output += `    }).catch(error => {\n`;
		output += `      console.error('Failed to initialize Dexie database:', error);\n`;
		output += `      this._ready$.next(false);\n`;
		output += `    });\n`;
	}

	output += `  }\n\n`;

	// Add framework-specific methods
	output += generateFrameworkMethods(latestVersion.tables, framework);

	output += `}\n\n`;

	// Export instance
	output += generateDatabaseInstance(framework);

	return output;
}

/**
 * Generate class header based on framework.
 * 
 * @param framework - Target framework
 * @returns Generated class header
 * 
 * @internal
 */
function generateClassHeader(framework: FrameworkType): string {
	let output = `/**\n * Dexie database class with all migrations applied\n`;

	if (framework === 'react') {
		output += ` * Optimized for React applications with hooks integration\n`;
	} else {
		output += ` * Injectable Angular service with Observable integration\n`;
	}

	output += ` */\n`;

	if (framework === 'angular') {
		output += `@Injectable({\n`;
		output += `  providedIn: 'root'\n`;
		output += `})\n`;
	}

	output += `export class AppDatabase extends Dexie {\n`;
	return output;
}

/**
 * Generate framework-specific methods.
 * 
 * @param tables - Array of table definitions
 * @param framework - Target framework
 * @returns Generated methods
 * 
 * @internal
 */
function generateFrameworkMethods(tables: TableDefinition[], framework: FrameworkType): string {
	let output = '';

	if (framework === 'react') {
		output += generateReactMethods(tables);
	} else {
		output += generateAngularMethods(tables);
	}

	return output;
}

/**
 * Generate React-specific methods.
 * 
 * @param tables - Array of table definitions
 * @returns Generated React methods
 * 
 * @internal
 */
function generateReactMethods(tables: TableDefinition[]): string {
	let output = `  // React-specific methods\n\n`;

	output += `  /**\n`;
	output += `   * Check if database is initialized for React\n`;
	output += `   */\n`;
	output += `  get isInitialized(): boolean {\n`;
	output += `    return this._initialized;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Wait for database initialization\n`;
	output += `   */\n`;
	output += `  async waitForReady(): Promise<void> {\n`;
	output += `    if (this._initialized) return;\n`;
	output += `    \n`;
	output += `    if (!this._initPromise) {\n`;
	output += `      this._initPromise = this.open().then(() => {\n`;
	output += `        this._initialized = true;\n`;
	output += `      });\n`;
	output += `    }\n`;
	output += `    \n`;
	output += `    return this._initPromise;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Clear all data (useful for React development)\n`;
	output += `   */\n`;
	output += `  async clearAllData(): Promise<void> {\n`;
	output += `    await Promise.all([\n`;
	tables.forEach((table, index) => {
		const isLast = index === tables.length - 1;
		output += `      this.${table.name}.clear()${isLast ? '' : ','}\n`;
	});
	output += `    ]);\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate Angular-specific methods.
 * 
 * @param tables - Array of table definitions
 * @returns Generated Angular methods
 * 
 * @internal
 */
function generateAngularMethods(tables: TableDefinition[]): string {
	let output = `  // Angular-specific methods\n\n`;

	output += `  /**\n`;
	output += `   * Get database ready status as Observable\n`;
	output += `   */\n`;
	output += `  isReady(): Observable<boolean> {\n`;
	output += `    return this.ready$;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Wait for database to be ready (Promise-based)\n`;
	output += `   */\n`;
	output += `  async waitForReady(): Promise<boolean> {\n`;
	output += `    return new Promise((resolve) => {\n`;
	output += `      const subscription = this.ready$.subscribe(isReady => {\n`;
	output += `        if (isReady) {\n`;
	output += `          subscription.unsubscribe();\n`;
	output += `          resolve(true);\n`;
	output += `        }\n`;
	output += `      });\n`;
	output += `    });\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Get database statistics for Angular dashboard\n`;
	output += `   */\n`;
	output += `  async getStats(): Promise<{ [tableName: string]: number }> {\n`;
	output += `    const stats: { [tableName: string]: number } = {};\n`;
	output += `    \n`;
	tables.forEach(table => {
		output += `    stats.${table.name} = await this.${table.name}.count();\n`;
	});
	output += `    \n`;
	output += `    return stats;\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate database instance export.
 * 
 * @param framework - Target framework
 * @returns Generated instance export
 * 
 * @internal
 */
function generateDatabaseInstance(framework: FrameworkType): string {
	let output = '';

	if (framework === 'react') {
		output += `// Export a database instance for React\n`;
		output += `export const db = new AppDatabase();\n\n`;
		output += `// Default export for convenience\n`;
		output += `export default db;\n`;
	} else {
		output += `// Export the database class for Angular DI\n`;
		output += `// Use it as: constructor(private db: AppDatabase)\n`;
	}

	return output;
}

/**
 * Generate framework-specific utilities.
 * 
 * @param versions - Array of version objects
 * @param framework - Target framework
 * @returns Generated utilities
 * 
 * @internal
 */
function generateFrameworkUtilities(versions: Version[], framework: FrameworkType): string {
	let output = '';

	if (framework === 'react') {
		output += generateReactHooks(versions);
	} else {
		output += generateAngularUtilities(versions);
	}

	return output;
}

/**
 * Generate React hooks for database operations.
 * 
 * @param versions - Array of version objects
 * @returns Generated React hooks
 * 
 * @internal
 */
function generateReactHooks(versions: Version[]): string {
	if (versions.length === 0) return '';

	const latestVersion = versions[versions.length - 1];

	let output = `\n// React hooks for database operations\n\n`;

	output += `/**\n`;
	output += ` * React hook to check if Dexie database is ready\n`;
	output += ` */\n`;
	output += `export function useDatabaseReady(): boolean {\n`;
	output += `  const [isReady, setIsReady] = useState(db.isInitialized);\n`;
	output += `  \n`;
	output += `  useEffect(() => {\n`;
	output += `    if (!db.isInitialized) {\n`;
	output += `      db.waitForReady().then(() => setIsReady(true));\n`;
	output += `    }\n`;
	output += `  }, []);\n`;
	output += `  \n`;
	output += `  return isReady;\n`;
	output += `}\n\n`;

	output += `/**\n`;
	output += ` * React hook for live database statistics\n`;
	output += ` */\n`;
	output += `export function useDatabaseStats() {\n`;
	output += `  return useLiveQuery(async () => {\n`;
	output += `    const stats: { [key: string]: number } = {};\n`;
	latestVersion.tables.forEach(table => {
		output += `    stats.${table.name} = await db.${table.name}.count();\n`;
	});
	output += `    return stats;\n`;
	output += `  }, []);\n`;
	output += `}\n\n`;

	output += `/**\n`;
	output += ` * React hook for clearing all database data\n`;
	output += ` */\n`;
	output += `export function useClearDatabase() {\n`;
	output += `  const [loading, setLoading] = useState(false);\n`;
	output += `  \n`;
	output += `  const clearAll = useCallback(async () => {\n`;
	output += `    setLoading(true);\n`;
	output += `    try {\n`;
	output += `      await db.clearAllData();\n`;
	output += `    } finally {\n`;
	output += `      setLoading(false);\n`;
	output += `    }\n`;
	output += `  }, []);\n`;
	output += `  \n`;
	output += `  return { clearAll, loading };\n`;
	output += `}\n`;

	return output;
}

/**
 * Generate Angular utilities.
 * 
 * @param versions - Array of version objects
 * @returns Generated Angular utilities
 * 
 * @internal
 */
function generateAngularUtilities(versions: Version[]): string {
	let output = `\n// Angular utilities\n\n`;

	output += `/**\n`;
	output += ` * Database configuration interface for Angular\n`;
	output += ` */\n`;
	output += `export interface DatabaseConfig {\n`;
	output += `  name: string;\n`;
	output += `  version: number;\n`;
	output += `  tables: string[];\n`;
	output += `}\n\n`;

	output += `/**\n`;
	output += ` * Get database configuration for Angular services\n`;
	output += ` */\n`;
	output += `export function getDatabaseConfig(): DatabaseConfig {\n`;
	output += `  return {\n`;
	output += `    name: 'AppDatabase',\n`;
	output += `    version: ${versions.length > 0 ? versions[versions.length - 1].version : 1},\n`;
	output += `    tables: [${versions.length > 0 ? versions[versions.length - 1].tables.map(t => `'${t.name}'`).join(', ') : ''}]\n`;
	output += `  };\n`;
	output += `}\n`;

	return output;
}
