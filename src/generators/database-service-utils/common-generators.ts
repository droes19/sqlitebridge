/**
 * Common Generators
 * 
 * Shared generators for both Angular and React database services
 */

import { FrameworkType } from '../../config';

/**
 * Generate file header with documentation.
 * 
 * @param framework - Target framework
 * @returns Generated header
 */
export function generateHeader(framework: FrameworkType): string {
	let output = `/**\n`;
	output += ` * Database Service - Auto-generated\n`;
	output += ` * Generated on ${new Date().toISOString()}\n`;
	output += ` * Target framework: ${framework}\n`;
	output += ` * \n`;
	output += ` * This service handles both SQLite (native/mobile) and Dexie.js (web) database operations.\n`;

	if (framework === 'react') {
		output += ` * Provides React hooks and context for database operations.\n`;
	} else {
		output += ` * Injectable Angular service with Observable integration.\n`;
	}

	output += ` */\n\n`;
	return output;
}

/**
 * Generate framework-specific imports.
 * 
 * @param framework - Target framework
 * @param withDexie - Whether to include Dexie imports
 * @returns Generated imports
 */
export function generateImports(framework: FrameworkType, withDexie: boolean): string {
	let output = '';

	if (framework === 'react') {
		output += `import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';\n`;
		output += `import { Capacitor } from '@capacitor/core';\n`;
		if (withDexie) {
			output += `import Dexie from 'dexie';\n`;
		}
	} else {
		output += `import { Injectable } from '@angular/core';\n`;
		output += `import { Platform } from '@ionic/angular';\n`;
		output += `import { BehaviorSubject } from 'rxjs';\n`;
		if (withDexie) {
			output += `import Dexie from 'dexie';\n`;
		}
	}

	output += `import {\n`;
	output += `  CapacitorSQLite,\n`;
	output += `  capTask,\n`;
	output += `  SQLiteConnection,\n`;
	output += `  SQLiteDBConnection\n`;
	output += `} from '@capacitor-community/sqlite';\n`;

	if (framework === 'angular') {
		output += `import { Directory, Filesystem } from '@capacitor/filesystem';\n`;
		output += `import { environment } from '../environments/environment';\n`;
	}

	output += `import { DATABASE_CONFIG } from './database.config';\n`;
	output += `import { validateMigrations } from './migration-helper';\n`;
	output += `import { ALL_MIGRATIONS, prepareMigrations } from './migrations';\n`;

	if (withDexie) {
		output += `import { AppDatabase } from './dexie-schema';\n`;
	}

	output += `\n`;
	return output;
}

/**
 * Generate common migration methods that both frameworks use.
 * 
 * @param framework - Target framework (affects indentation and syntax)
 * @returns Generated migration methods
 */
export function generateCommonMigrationMethods(framework: FrameworkType): string {
	const isAngular = framework === 'angular';
	const thisPrefix = isAngular ? 'this.' : '';
	const asyncPrefix = isAngular ? 'async ' : '';

	let output = `  /**\n`;
	output += `   * Create migrations table for tracking database changes\n`;
	output += `   */\n`;
	output += `  private ${asyncPrefix}createMigrationsTable(): Promise<void> {\n`;
	output += `    if (!${thisPrefix}db || !${thisPrefix}isNative) return${isAngular ? '' : ' Promise.resolve()'};\n\n`;

	output += `    ${isAngular ? 'try {' : 'return new Promise(async (resolve, reject) => {'}\n`;
	output += `      ${isAngular ? '' : 'try {'}\n`;
	output += `      await (${thisPrefix}db as SQLiteDBConnection).execute(\`\n`;
	output += `        CREATE TABLE IF NOT EXISTS migrations (\n`;
	output += `          id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
	output += `          version INTEGER UNIQUE NOT NULL,\n`;
	output += `          description TEXT,\n`;
	output += `          executed_at TEXT NOT NULL\n`;
	output += `        )\n`;
	output += `      \`);\n`;

	if (isAngular) {
		output += `    } catch (error) {\n`;
		output += `      console.error('Error creating migrations table:', error);\n`;
		output += `      throw error;\n`;
		output += `    }\n`;
	} else {
		output += `        resolve();\n`;
		output += `      } catch (error) {\n`;
		output += `        console.error('Error creating migrations table:', error);\n`;
		output += `        reject(error);\n`;
		output += `      }\n`;
		output += `    });\n`;
	}

	output += `  }\n\n`;

	// Run migrations method
	output += `  /**\n`;
	output += `   * Run database migrations for SQLite\n`;
	output += `   */\n`;
	output += `  private ${asyncPrefix}runMigrations(): Promise<void> {\n`;
	output += `    if (!${thisPrefix}isNative || !${thisPrefix}db) return${isAngular ? '' : ' Promise.resolve()'};\n\n`;

	output += `    ${isAngular ? 'try {' : 'return new Promise(async (resolve, reject) => {'}\n`;
	output += `      ${isAngular ? '' : 'try {'}\n`;
	output += `      const versionResult = await (${thisPrefix}db as SQLiteDBConnection).query(\n`;
	output += `        \`SELECT MAX(version) as version FROM migrations\`\n`;
	output += `      );\n`;
	output += `      const currentVersion = versionResult.values && versionResult.values.length > 0 && versionResult.values[0].version\n`;
	output += `        ? versionResult.values[0].version\n`;
	output += `        : 0;\n\n`;

	output += `      const pendingMigrations = ALL_MIGRATIONS\n`;
	output += `        .filter(migration => migration.version > currentVersion)\n`;
	output += `        .sort((a, b) => a.version - b.version);\n\n`;

	output += `      if (pendingMigrations.length === 0) {\n`;
	output += `        ${isAngular ? 'return;' : 'resolve(); return;'}\n`;
	output += `      }\n\n`;

	output += `      const upgradeStatements = prepareMigrations();\n`;
	output += `      const pendingUpgrades = upgradeStatements.filter(\n`;
	output += `        upgrade => upgrade.toVersion > currentVersion\n`;
	output += `      );\n\n`;

	output += `      if (pendingUpgrades.length > 0) {\n`;
	output += `        await ${thisPrefix}sqlite!.addUpgradeStatement(DATABASE_CONFIG.name, pendingUpgrades);\n`;
	output += `      }\n\n`;

	output += `      for (const migration of pendingMigrations) {\n`;
	output += `        const recordStatement = {\n`;
	output += `          statement: \`INSERT INTO migrations (version, description, executed_at) VALUES (?, ?, ?)\`,\n`;
	output += `          values: [migration.version, migration.description, new Date().toISOString()]\n`;
	output += `        } as capTask;\n\n`;

	output += `        await (${thisPrefix}db as SQLiteDBConnection).run(recordStatement.statement, recordStatement.values);\n`;
	output += `      }\n`;

	if (isAngular) {
		output += `    } catch (error) {\n`;
		output += `      console.error('Error running migrations:', error);\n`;
		output += `      throw error;\n`;
		output += `    }\n`;
	} else {
		output += `        resolve();\n`;
		output += `      } catch (error) {\n`;
		output += `        console.error('Error running migrations:', error);\n`;
		output += `        reject(error);\n`;
		output += `      }\n`;
		output += `    });\n`;
	}

	output += `  }\n\n`;

	return output;
}

/**
 * Generate common database operation methods.
 * 
 * @param framework - Target framework
 * @returns Generated common methods
 */
export function generateCommonMethods(framework: FrameworkType): string {
	const isAngular = framework === 'angular';
	const thisPrefix = isAngular ? 'this.' : '';
	const asyncPrefix = isAngular ? 'async ' : '';

	let output = `  /**\n`;
	output += `   * Execute a raw query on SQLite (only for native platforms)\n`;
	output += `   */\n`;
	output += `  ${asyncPrefix}executeQuery(query: string, params: any[] = []): Promise<any> {\n`;
	output += `    if (!${thisPrefix}isNative || !${thisPrefix}db) {\n`;
	output += `      ${isAngular ? 'throw' : 'return Promise.reject('} new Error('SQLite not available on this platform or database not initialized')${isAngular ? ';' : ');'}\n`;
	output += `    }\n\n`;

	if (isAngular) {
		output += `    try {\n`;
		output += `      return await (${thisPrefix}db as SQLiteDBConnection).query(query, params);\n`;
		output += `    } catch (error) {\n`;
		output += `      console.error('Error executing query:', error);\n`;
		output += `      throw error;\n`;
		output += `    }\n`;
	} else {
		output += `    return new Promise(async (resolve, reject) => {\n`;
		output += `      try {\n`;
		output += `        const result = await (${thisPrefix}db as SQLiteDBConnection).query(query, params);\n`;
		output += `        resolve(result);\n`;
		output += `      } catch (error) {\n`;
		output += `        console.error('Error executing query:', error);\n`;
		output += `        reject(error);\n`;
		output += `      }\n`;
		output += `    });\n`;
	}

	output += `  }\n\n`;

	// Execute command method
	output += `  /**\n`;
	output += `   * Execute a raw non-query command (INSERT, UPDATE, DELETE) on SQLite\n`;
	output += `   */\n`;
	output += `  ${asyncPrefix}executeCommand(query: string, params: any[] = []): Promise<any> {\n`;
	output += `    if (!${thisPrefix}isNative || !${thisPrefix}db) {\n`;
	output += `      ${isAngular ? 'throw' : 'return Promise.reject('} new Error('SQLite not available on this platform or database not initialized')${isAngular ? ';' : ');'}\n`;
	output += `    }\n\n`;

	if (isAngular) {
		output += `    try {\n`;
		output += `      return await (${thisPrefix}db as SQLiteDBConnection).run(query, params);\n`;
		output += `    } catch (error) {\n`;
		output += `      console.error('Error executing command:', error);\n`;
		output += `      throw error;\n`;
		output += `    }\n`;
	} else {
		output += `    return new Promise(async (resolve, reject) => {\n`;
		output += `      try {\n`;
		output += `        const result = await (${thisPrefix}db as SQLiteDBConnection).run(query, params);\n`;
		output += `        resolve(result);\n`;
		output += `      } catch (error) {\n`;
		output += `        console.error('Error executing command:', error);\n`;
		output += `        reject(error);\n`;
		output += `      }\n`;
		output += `    });\n`;
	}

	output += `  }\n\n`;

	// Other common methods
	output += `  /**\n`;
	output += `   * Check if using native database\n`;
	output += `   */\n`;
	output += `  isNativeDatabase(): boolean {\n`;
	output += `    return ${thisPrefix}isNative;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Get Dexie instance (web only)\n`;
	output += `   */\n`;
	output += `  getDexieInstance(): any {\n`;
	output += `    if (!${thisPrefix}isNative && ${thisPrefix}dexieDb) {\n`;
	output += `      return ${thisPrefix}dexieDb;\n`;
	output += `    }\n`;
	output += `    return null;\n`;
	output += `  }\n\n`;

	return output;
}
