/**
 * Migration Generator Module
 * 
 * This module processes SQLite migration files and generates TypeScript code
 * for handling database migrations in both native SQLite and web environments.
 * It extracts SQL queries from migration files and organizes them into a structured
 * format that can be used with @capacitor-community/sqlite.
 * Supports both Angular and React frameworks with framework-specific optimizations.
 * 
 * @packageDocumentation
 */

import { basename, join } from 'node:path';
import { Migration } from '../types';
import { FrameworkType } from '../config';
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
 * @param framework - Target framework ('angular' | 'react')
 * 
 * @example
 * ```typescript
 * // Generate migrations from all SQL files in the 'migrations' directory for React
 * await generateSqliteMigrationsFromDir('./migrations', './src/database/migrations.ts', /^V\d+__.+\.sql$/, 'react');
 * ```
 */
export async function generateSqliteMigrationsFromDir(
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

		// Process each file to extract migrations
		const migrations = await extractMigrationsFromFiles(files, directoryPath);

		// Sort migrations by version
		migrations.sort((a, b) => a.version - b.version);

		// Generate output content
		const output = generateMigrationsArrayContent(migrations, framework);

		// Write output file
		if (await utils.writeToFile(outputPath, output)) {
			console.log(`\nSuccessfully generated SQLite migrations array for ${framework}.`);
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
async function extractMigrationsFromFiles(files: string[], directoryPath: string): Promise<Migration[]> {
	const migrations: Migration[] = [];

	for (const file of files) {
		const filePath = join(directoryPath, file);
		const versionInfo = utils.extractVersionInfo(file);

		if (!versionInfo) {
			console.warn(`Warning: Could not extract version information from ${file}, skipping.`);
			continue;
		}

		console.log(`Processing: ${file} (version ${versionInfo.version} - ${versionInfo.description})`);

		const content = await utils.readFile(filePath);
		if (!content) continue;

		const queries = utils.extractQueriesFromContent(content);

		if (queries.length === 0) {
			console.warn(`Warning: No valid SQL queries found in ${file}, skipping.`);
			continue;
		}

		migrations.push({
			version: versionInfo.version,
			description: versionInfo.description,
			queries: queries
		});
	}

	return migrations;
}

/**
 * Generate the content of the migrations array.
 * 
 * @param migrations - Array of migration objects
 * @param framework - Target framework
 * @returns Generated content as a string
 * 
 * @internal
 */
function generateMigrationsArrayContent(migrations: Migration[], framework: FrameworkType): string {
	let output = `// Auto-generated SQLite migrations array from SQL files\n`;
	output += `// Generated on ${new Date().toISOString()}\n`;
	output += `// Target framework: ${framework}\n\n`;

	// Add framework-specific imports
	if (framework === 'react') {
		output += generateReactImports();
	} else {
		output += generateAngularImports();
	}

	// Generate Migration interface
	output += generateMigrationInterface(framework);

	// Add the migrations array
	output += generateMigrationsArray(migrations, framework);

	// Add migration setup helpers
	output += generateMigrationHelpers(framework);

	// Add framework-specific utilities
	if (framework === 'react') {
		output += generateReactUtilities();
	} else {
		output += generateAngularUtilities();
	}

	return output;
}

/**
 * Generates React-specific imports.
 * 
 * @returns Generated imports as a string
 * 
 * @internal
 */
function generateReactImports(): string {
	let output = `import { capSQLiteVersionUpgrade } from "@capacitor-community/sqlite";\n`;
	output += `import { useCallback, useEffect, useState } from "react";\n\n`;
	return output;
}

/**
 * Generates Angular-specific imports.
 * 
 * @returns Generated imports as a string
 * 
 * @internal
 */
function generateAngularImports(): string {
	return `import { capSQLiteVersionUpgrade } from "@capacitor-community/sqlite";\n\n`;
}

/**
 * Generates the Migration interface definition.
 * 
 * @param framework - Target framework
 * @returns Generated interface as a string
 * 
 * @internal
 */
function generateMigrationInterface(framework: FrameworkType): string {
	let output = `/**\n * SQLite migration definition\n`;

	if (framework === 'react') {
		output += ` * Optimized for React applications with hooks and state management\n`;
	} else {
		output += ` * Compatible with Angular services and dependency injection\n`;
	}

	output += ` */\n`;
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
 * Generates the migrations array.
 * 
 * @param migrations - Array of migration objects
 * @param framework - Target framework
 * @returns Generated migrations array as a string
 * 
 * @internal
 */
function generateMigrationsArray(migrations: Migration[], framework: FrameworkType): string {
	let output = `/**\n * Array of all SQLite migrations to apply\n`;

	if (framework === 'react') {
		output += ` * Use this with React hooks for migration management\n`;
	} else {
		output += ` * Use this with Angular services for migration management\n`;
	}

	output += ` */\n`;
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

	return output;
}

/**
 * Generates helper functions for migration handling.
 * 
 * @param framework - Target framework
 * @returns Generated helper functions as a string
 * 
 * @internal
 */
function generateMigrationHelpers(framework: FrameworkType): string {
	let output = `/**\n * Prepare migration statements for Capacitor SQLite\n`;

	if (framework === 'react') {
		output += ` * Use this in React components or custom hooks\n`;
	} else {
		output += ` * Use this in Angular services\n`;
	}

	output += ` * @returns Upgrade statements for Capacitor SQLite\n */\n`;
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
	output += `}\n\n`;

	// Add database version utilities
	output += `/**\n * Get the latest migration version\n`;

	if (framework === 'react') {
		output += ` * Useful for React state management and migration status\n`;
	} else {
		output += ` * Useful for Angular services and migration status\n`;
	}

	output += ` * @returns Latest migration version number\n */\n`;
	output += `export function getLatestMigrationVersion(): number {\n`;
	output += `  if (ALL_MIGRATIONS.length === 0) return 0;\n`;
	output += `  return Math.max(...ALL_MIGRATIONS.map(m => m.version));\n`;
	output += `}\n\n`;

	output += `/**\n * Get migration by version number\n`;
	output += ` * @param version - Version number to find\n`;
	output += ` * @returns Migration object or undefined if not found\n */\n`;
	output += `export function getMigrationByVersion(version: number): Migration | undefined {\n`;
	output += `  return ALL_MIGRATIONS.find(m => m.version === version);\n`;
	output += `}\n\n`;

	output += `/**\n * Get all migration versions\n`;
	output += ` * @returns Array of all migration version numbers\n */\n`;
	output += `export function getAllMigrationVersions(): number[] {\n`;
	output += `  return ALL_MIGRATIONS.map(m => m.version).sort((a, b) => a - b);\n`;
	output += `}\n\n`;

	return output;
}

/**
 * Generates React-specific utilities.
 * 
 * @returns Generated React utilities as a string
 * 
 * @internal
 */
function generateReactUtilities(): string {
	let output = `// React-specific migration utilities\n\n`;

	// Migration state type
	output += `/**\n * React state type for migration management\n */\n`;
	output += `export interface MigrationState {\n`;
	output += `  currentVersion: number;\n`;
	output += `  latestVersion: number;\n`;
	output += `  isUpgrading: boolean;\n`;
	output += `  error: string | null;\n`;
	output += `  completedMigrations: number[];\n`;
	output += `}\n\n`;

	// Migration hook type
	output += `/**\n * React hook return type for migration management\n */\n`;
	output += `export interface UseMigrationResult {\n`;
	output += `  migrationState: MigrationState;\n`;
	output += `  runMigrations: () => Promise<void>;\n`;
	output += `  resetMigrations: () => Promise<void>;\n`;
	output += `  checkMigrationStatus: () => Promise<void>;\n`;
	output += `}\n\n`;

	// Migration progress type
	output += `/**\n * Migration progress callback type for React\n */\n`;
	output += `export type MigrationProgressCallback = (\n`;
	output += `  currentMigration: number,\n`;
	output += `  totalMigrations: number,\n`;
	output += `  migrationDescription: string\n`;
	output += `) => void;\n\n`;

	// Migration utilities for React
	output += `/**\n * Get initial migration state for React\n */\n`;
	output += `export function getInitialMigrationState(): MigrationState {\n`;
	output += `  return {\n`;
	output += `    currentVersion: 0,\n`;
	output += `    latestVersion: getLatestMigrationVersion(),\n`;
	output += `    isUpgrading: false,\n`;
	output += `    error: null,\n`;
	output += `    completedMigrations: []\n`;
	output += `  };\n`;
	output += `}\n\n`;

	// Migration status checker
	output += `/**\n * Check if migrations are needed\n */\n`;
	output += `export function needsMigration(currentVersion: number): boolean {\n`;
	output += `  return currentVersion < getLatestMigrationVersion();\n`;
	output += `}\n\n`;

	// Get pending migrations
	output += `/**\n * Get migrations that need to be applied\n */\n`;
	output += `export function getPendingMigrations(currentVersion: number): Migration[] {\n`;
	output += `  return ALL_MIGRATIONS.filter(m => m.version > currentVersion);\n`;
	output += `}\n\n`;

	// Migration validator
	output += `/**\n * Validate migration sequence\n */\n`;
	output += `export function validateMigrationSequence(): { valid: boolean; errors: string[] } {\n`;
	output += `  const errors: string[] = [];\n`;
	output += `  const versions = getAllMigrationVersions();\n`;
	output += `  \n`;
	output += `  // Check for sequential versions starting from 1\n`;
	output += `  for (let i = 0; i < versions.length; i++) {\n`;
	output += `    const expectedVersion = i + 1;\n`;
	output += `    if (versions[i] !== expectedVersion) {\n`;
	output += `      errors.push(\`Missing migration version \${expectedVersion}\`);\n`;
	output += `    }\n`;
	output += `  }\n`;
	output += `  \n`;
	output += `  return { valid: errors.length === 0, errors };\n`;
	output += `}\n\n`;

	return output;
}

/**
 * Generates Angular-specific utilities.
 * 
 * @returns Generated Angular utilities as a string
 * 
 * @internal
 */
function generateAngularUtilities(): string {
	let output = `// Angular-specific migration utilities\n\n`;

	// Migration status interface
	output += `/**\n * Migration status interface for Angular services\n */\n`;
	output += `export interface MigrationStatus {\n`;
	output += `  currentVersion: number;\n`;
	output += `  latestVersion: number;\n`;
	output += `  needsUpgrade: boolean;\n`;
	output += `  pendingMigrations: Migration[];\n`;
	output += `}\n\n`;

	// Migration result interface
	output += `/**\n * Migration execution result for Angular services\n */\n`;
	output += `export interface MigrationResult {\n`;
	output += `  success: boolean;\n`;
	output += `  fromVersion: number;\n`;
	output += `  toVersion: number;\n`;
	output += `  appliedMigrations: number[];\n`;
	output += `  error?: string;\n`;
	output += `}\n\n`;

	// Migration status checker
	output += `/**\n * Get migration status for Angular services\n */\n`;
	output += `export function getMigrationStatus(currentVersion: number): MigrationStatus {\n`;
	output += `  const latestVersion = getLatestMigrationVersion();\n`;
	output += `  const needsUpgrade = currentVersion < latestVersion;\n`;
	output += `  const pendingMigrations = ALL_MIGRATIONS.filter(m => m.version > currentVersion);\n`;
	output += `  \n`;
	output += `  return {\n`;
	output += `    currentVersion,\n`;
	output += `    latestVersion,\n`;
	output += `    needsUpgrade,\n`;
	output += `    pendingMigrations\n`;
	output += `  };\n`;
	output += `}\n\n`;

	// Migration validator
	output += `/**\n * Validate migration consistency for Angular\n */\n`;
	output += `export function validateMigrations(): { isValid: boolean; issues: string[] } {\n`;
	output += `  const issues: string[] = [];\n`;
	output += `  const versions = getAllMigrationVersions();\n`;
	output += `  \n`;
	output += `  // Check for duplicate versions\n`;
	output += `  const uniqueVersions = new Set(versions);\n`;
	output += `  if (uniqueVersions.size !== versions.length) {\n`;
	output += `    issues.push('Duplicate migration versions detected');\n`;
	output += `  }\n`;
	output += `  \n`;
	output += `  // Check for sequential versions\n`;
	output += `  for (let i = 0; i < versions.length; i++) {\n`;
	output += `    const expectedVersion = i + 1;\n`;
	output += `    if (versions[i] !== expectedVersion) {\n`;
	output += `      issues.push(\`Migration version \${expectedVersion} is missing\`);\n`;
	output += `    }\n`;
	output += `  }\n`;
	output += `  \n`;
	output += `  return { isValid: issues.length === 0, issues };\n`;
	output += `}\n\n`;

	// Migration summary
	output += `/**\n * Get migration summary for Angular dashboard/logging\n */\n`;
	output += `export function getMigrationSummary(): {\n`;
	output += `  totalMigrations: number;\n`;
	output += `  latestVersion: number;\n`;
	output += `  migrationsByVersion: { version: number; description: string; queryCount: number }[];\n`;
	output += `} {\n`;
	output += `  return {\n`;
	output += `    totalMigrations: ALL_MIGRATIONS.length,\n`;
	output += `    latestVersion: getLatestMigrationVersion(),\n`;
	output += `    migrationsByVersion: ALL_MIGRATIONS.map(m => ({\n`;
	output += `      version: m.version,\n`;
	output += `      description: m.description,\n`;
	output += `      queryCount: m.queries.length\n`;
	output += `    }))\n`;
	output += `  };\n`;
	output += `}\n\n`;

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
 * @param framework - Target framework ('angular' | 'react')
 * 
 * @example
 * ```typescript
 * // Generate migrations from a single SQL file for React
 * generateSqliteMigrationsFromFile('./migrations/V1__initial_schema.sql', './src/database/migrations.ts', 'react');
 * ```
 */
export async function generateSqliteMigrationsFromFile(
	sqlFilePath: string,
	outputPath: string,
	framework: FrameworkType
): Promise<void> {
	try {
		// Check if file exists and read content
		const content = await utils.readFile(sqlFilePath);
		if (!content) {
			console.error(`Error: Could not read file ${sqlFilePath}.`);
			return;
		}

		console.log(`Processing file: ${sqlFilePath}`);
		console.log(`Target framework: ${framework}`);

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
		const output = generateMigrationsArrayContent(migrations, framework);

		// Write output file
		if (await utils.writeToFile(outputPath, output)) {
			console.log(`\nSuccessfully generated SQLite migrations array for ${framework}.`);
			console.log(`Generated 1 migration version with ${queries.length} queries.`);
			console.log(`Output written to: ${outputPath}`);
		}
	} catch (error) {
		console.error('Error generating SQLite migrations array:', error);
	}
}
