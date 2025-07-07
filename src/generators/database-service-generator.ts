/**
 * Database Service Generator Module
 * 
 * This module generates the main database service file that handles platform detection,
 * database initialization, migration management, and provides the core database operations.
 * Supports both Angular (service classes) and React (service functions) frameworks.
 * 
 * @packageDocumentation
 */

import * as utils from '../utils';
import { FrameworkType } from '../config';
import { dirname, join } from 'node:path';

/**
 * Generate database service file if it doesn't exist.
 * 
 * @param outputPath - Full path where the database service should be created
 * @param framework - Target framework ('angular' | 'react')
 * @param withDexie - Whether to include Dexie.js support
 * @param databaseName - Optional database name (defaults to 'your_database_name')
 * @param replaceExisting - Whether to overwrite existing file if it exists
 * @returns Promise<boolean> - True if file was created or already exists, false on error
 * 
 * @example
 * ```typescript
 * // Generate Angular database service
 * await generateDatabaseService('./src/app/core/database/database.service.ts', 'angular', true, 'my_app_db', true);
 * 
 * // Generate React database service with custom database name
 * await generateDatabaseService('./src/database/services/database.service.ts', 'react', true, 'my_app_db', true);
 * ```
 */
export async function generateDatabaseService(
	outputPath: string,
	framework: FrameworkType,
	withDexie: boolean = true,
	databaseName?: string,
	replaceExisting: boolean = false
): Promise<boolean> {
	try {
		// Check if the file already exists
		if (await utils.checkFileExists(outputPath) && !replaceExisting) {
			console.log(`Database service already exists at ${outputPath}, skipping generation.`);
			return true;
		}

		console.log(`Generating ${framework} database service at ${outputPath}...`);

		// Generate the appropriate service content
		const serviceContent = framework === 'angular'
			? generateAngularDatabaseService(withDexie)
			: generateReactDatabaseService(withDexie);

		// Ensure the output directory exists
		const outputDir = dirname(outputPath);
		if (!(await utils.ensureDir(outputDir))) {
			console.error(`Error: Could not create output directory ${outputDir}.`);
			return false;
		}

		// Write the service file
		const success = await utils.writeToFile(outputPath, serviceContent);
		if (success) {
			console.log(`✓ Generated ${framework} database service: ${outputPath}`);

			// Generate additional required files
			const dbName = databaseName || 'your_database_name';
			await generateDatabaseConfigFile(outputDir, dbName);
			await generateMigrationHelperFile(outputDir);

			return true;
		} else {
			console.error(`✗ Failed to write database service to ${outputPath}`);
			return false;
		}
	} catch (error) {
		console.error('Error generating database service:', error);
		return false;
	}
}

/**
 * Generate Angular database service content.
 * 
 * @param withDexie - Whether to include Dexie.js support
 * @returns Generated Angular service content
 * 
 * @internal
 */
function generateAngularDatabaseService(withDexie: boolean): string {
	let output = generateAngularHeader();
	output += generateAngularImports(withDexie);
	output += generateAngularClassDefinition();
	output += generateAngularConstructor();
	output += generateAngularInitializeMethod(withDexie);
	output += generateAngularInitNativeMethod();
	output += generateAngularInitWebMethod(withDexie);
	output += generateAngularMigrationMethods();
	output += generateAngularQueryMethods();
	output += generateAngularUtilityMethods();
	output += generateAngularDevelopmentMethod();
	output += `}\n`;

	return output;
}

/**
 * Generate React database service content.
 * 
 * @param withDexie - Whether to include Dexie.js support
 * @returns Generated React service content
 * 
 * @internal
 */
function generateReactDatabaseService(withDexie: boolean): string {
	let output = generateReactHeader();
	output += generateReactImports(withDexie);
	output += generateReactInterfaceDefinitions();
	output += generateReactClassDefinition();
	output += generateReactConstructor();
	output += generateReactInitializeMethod(withDexie);
	output += generateReactInitNativeMethod();
	output += generateReactInitWebMethod(withDexie);
	output += generateReactMigrationMethods();
	output += generateReactQueryMethods();
	output += generateReactUtilityMethods();
	output += generateReactDevelopmentMethod();
	output += `}\n\n`;
	output += `export default DatabaseService;\n`;

	return output;
}

/**
 * Generate Angular header comment.
 * 
 * @internal
 */
function generateAngularHeader(): string {
	return `// Auto-generated Angular Database Service
// Generated on ${new Date().toISOString()}
// Handles database initialization, migrations, and platform detection

`;
}

/**
 * Generate React header comment.
 * 
 * @internal
 */
function generateReactHeader(): string {
	return `// Auto-generated React Database Service
// Generated on ${new Date().toISOString()}
// Handles database initialization, migrations, and platform detection

`;
}

/**
 * Generate Angular imports.
 * 
 * @param withDexie - Whether to include Dexie imports
 * @internal
 */
function generateAngularImports(withDexie: boolean): string {
	let output = `import { Injectable } from '@angular/core';\n`;
	output += `import { Platform } from '@ionic/angular';\n`;
	output += `import {\n`;
	output += `  CapacitorSQLite,\n`;
	output += `  capTask,\n`;
	output += `  SQLiteConnection,\n`;
	output += `  SQLiteDBConnection\n`;
	output += `} from '@capacitor-community/sqlite';\n`;

	if (withDexie) {
		output += `import Dexie from 'dexie';\n`;
	}

	output += `import { DATABASE_CONFIG } from './database.config';\n`;
	output += `import { validateMigrations } from './migration-helper';\n`;
	output += `import { ALL_MIGRATIONS, prepareMigrations } from '../migrations';\n`;
	output += `import { BehaviorSubject } from 'rxjs';\n`;
	output += `import { environment } from 'src/environments/environment';\n`;
	output += `import { Directory, Filesystem } from '@capacitor/filesystem';\n\n`;

	output += `// In development mode, validate migrations on service initialization\n`;
	output += `// This helps catch migration versioning errors early\n`;
	output += `const isDevelopment = !environment.production;\n\n`;

	return output;
}

/**
 * Generate React imports.
 * 
 * @param withDexie - Whether to include Dexie imports
 * @internal
 */
function generateReactImports(withDexie: boolean): string {
	let output = `import {\n`;
	output += `  CapacitorSQLite,\n`;
	output += `  capTask,\n`;
	output += `  SQLiteConnection,\n`;
	output += `  SQLiteDBConnection\n`;
	output += `} from '@capacitor-community/sqlite';\n`;

	if (withDexie) {
		output += `import Dexie from 'dexie';\n`;
	}

	output += `import { DATABASE_CONFIG } from '../database.config';\n`;
	output += `import { validateMigrations } from '../migration-helper';\n`;
	output += `import { ALL_MIGRATIONS, prepareMigrations } from '../migrations';\n`;
	output += `import { Capacitor } from '@capacitor/core';\n`;
	output += `import { Directory, Filesystem } from '@capacitor/filesystem';\n\n`;

	output += `// In development mode, validate migrations on service initialization\n`;
	output += `// This helps catch migration versioning errors early\n`;
	output += `const isDevelopment = process.env.NODE_ENV === 'development';\n\n`;

	return output;
}

/**
 * Generate React interface definitions.
 * 
 * @internal
 */
function generateReactInterfaceDefinitions(): string {
	let output = `export interface DatabaseReadyState {\n`;
	output += `  isReady: boolean;\n`;
	output += `  subscribe: (callback: (ready: boolean) => void) => () => void;\n`;
	output += `}\n\n`;

	return output;
}

/**
 * Generate Angular class definition.
 * 
 * @internal
 */
function generateAngularClassDefinition(): string {
	let output = `@Injectable({\n`;
	output += `  providedIn: 'root'\n`;
	output += `})\n`;
	output += `export class DatabaseService {\n`;
	output += `  private sqlite: SQLiteConnection | null = null;\n`;
	output += `  private db: SQLiteDBConnection | Dexie | null = null;\n`;
	output += `  private isNative = false;\n`;
	output += `  private dexieDb: any = null;\n`;
	output += `  private _isReady = new BehaviorSubject<boolean>(false);\n\n`;
	output += `  // Observable to track database readiness\n`;
	output += `  public isReady$ = this._isReady.asObservable();\n\n`;

	return output;
}

/**
 * Generate React class definition.
 * 
 * @internal
 */
function generateReactClassDefinition(): string {
	let output = `class DatabaseService {\n`;
	output += `  private sqlite: SQLiteConnection | null = null;\n`;
	output += `  private db: SQLiteDBConnection | Dexie | null = null;\n`;
	output += `  private isNative = false;\n`;
	output += `  private dexieDb: any = null;\n`;
	output += `  private _isReady = false;\n`;
	output += `  private _readyCallbacks: Set<(ready: boolean) => void> = new Set();\n\n`;
	output += `  // Database readiness state management\n`;
	output += `  public readonly readyState: DatabaseReadyState = {\n`;
	output += `    get isReady() { return this._isReady; },\n`;
	output += `    subscribe: (callback: (ready: boolean) => void) => {\n`;
	output += `      this._readyCallbacks.add(callback);\n`;
	output += `      callback(this._isReady);\n`;
	output += `      return () => this._readyCallbacks.delete(callback);\n`;
	output += `    }\n`;
	output += `  };\n\n`;
	output += `  private notifyReadyState(ready: boolean) {\n`;
	output += `    this._isReady = ready;\n`;
	output += `    this._readyCallbacks.forEach(callback => callback(ready));\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate Angular constructor.
 * 
 * @internal
 */
function generateAngularConstructor(): string {
	return `  constructor(private platform: Platform) { }\n\n`;
}

/**
 * Generate React constructor.
 * 
 * @internal
 */
function generateReactConstructor(): string {
	return `  constructor() { }\n\n`;
}

/**
 * Generate Angular initialize method.
 * 
 * @param withDexie - Whether to include Dexie support
 * @internal
 */
function generateAngularInitializeMethod(withDexie: boolean): string {
	let output = `  /**\n`;
	output += `   * Initialize the database\n`;
	output += `   */\n`;
	output += `  async initializeDatabase(): Promise<void> {\n`;
	output += `    // In development, validate migrations before initialization\n`;
	output += `    if (isDevelopment) {\n`;
	output += `      const validation = validateMigrations();\n`;
	output += `      if (!validation.valid) {\n`;
	output += `        console.warn('⚠️ MIGRATION VALIDATION FAILED ⚠️');\n`;
	output += `        validation.errors.forEach(error => console.error(\`- \${error}\`));\n`;
	output += `        console.warn('Database initialization will continue, but migrations may fail');\n`;
	output += `      }\n`;
	output += `    }\n\n`;
	output += `    await this.platform.ready();\n`;
	output += `    this.isNative = this.platform.is('hybrid');\n\n`;
	output += `    if (this.isNative) {\n`;
	output += `      await this.initNativeDatabase();\n`;
	output += `      await this.runMigrations();\n`;
	output += `    } else {\n`;
	output += `      await this.initWebDatabase();\n`;
	output += `    }\n\n`;
	output += `    this._isReady.next(true);\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React initialize method.
 * 
 * @param withDexie - Whether to include Dexie support
 * @internal
 */
function generateReactInitializeMethod(withDexie: boolean): string {
	let output = `  /**\n`;
	output += `   * Initialize the database\n`;
	output += `   */\n`;
	output += `  async initializeDatabase(): Promise<void> {\n`;
	output += `    // In development, validate migrations before initialization\n`;
	output += `    if (isDevelopment) {\n`;
	output += `      const validation = validateMigrations();\n`;
	output += `      if (!validation.valid) {\n`;
	output += `        console.warn('⚠️ MIGRATION VALIDATION FAILED ⚠️');\n`;
	output += `        validation.errors.forEach(error => console.error(\`- \${error}\`));\n`;
	output += `        console.warn('Database initialization will continue, but migrations may fail');\n`;
	output += `      }\n`;
	output += `    }\n\n`;
	output += `    this.isNative = Capacitor.isNativePlatform();\n\n`;
	output += `    if (this.isNative) {\n`;
	output += `      await this.initNativeDatabase();\n`;
	output += `      await this.runMigrations();\n`;
	output += `    } else {\n`;
	output += `      await this.initWebDatabase();\n`;
	output += `    }\n\n`;
	output += `    this.notifyReadyState(true);\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate native database initialization method.
 * 
 * @internal
 */
function generateAngularInitNativeMethod(): string {
	let output = `  /**\n`;
	output += `   * Initialize SQLite database for native platforms\n`;
	output += `   */\n`;
	output += `  private async initNativeDatabase(): Promise<void> {\n`;
	output += `    try {\n`;
	output += `      console.log('Initializing native SQLite database...');\n`;
	output += `      this.sqlite = new SQLiteConnection(CapacitorSQLite);\n\n`;
	output += `      let retryCount = 0;\n`;
	output += `      const maxRetries = 3;\n\n`;
	output += `      while (retryCount < maxRetries) {\n`;
	output += `        try {\n`;
	output += `          console.log(\`Checking SQLite connection consistency (attempt \${retryCount + 1})...\`);\n`;
	output += `          const ret = await this.sqlite.checkConnectionsConsistency();\n`;
	output += `          const isConn = await this.sqlite.isConnection(DATABASE_CONFIG.name, false);\n\n`;
	output += `          if (ret.result && isConn.result) {\n`;
	output += `            console.log('Existing connection found, retrieving...');\n`;
	output += `            this.db = await this.sqlite.retrieveConnection(DATABASE_CONFIG.name, false);\n`;
	output += `            break;\n`;
	output += `          } else {\n`;
	output += `            console.log('No existing connection, creating new connection...');\n`;
	output += `            this.db = await this.sqlite.createConnection(\n`;
	output += `              DATABASE_CONFIG.name,\n`;
	output += `              false,\n`;
	output += `              DATABASE_CONFIG.mode,\n`;
	output += `              ALL_MIGRATIONS.length > 0 ? Math.max(...ALL_MIGRATIONS.map(m => m.version)) : 1,\n`;
	output += `              false\n`;
	output += `            );\n`;
	output += `            break;\n`;
	output += `          }\n`;
	output += `        } catch (error) {\n`;
	output += `          console.error(\`Connection attempt \${retryCount + 1} failed:\`, error);\n`;
	output += `          retryCount++;\n\n`;
	output += `          if (retryCount >= maxRetries) {\n`;
	output += `            throw new Error(\`Failed to connect to SQLite after \${maxRetries} attempts: \${error}\`);\n`;
	output += `          }\n\n`;
	output += `          await new Promise(resolve => setTimeout(resolve, 500));\n`;
	output += `        }\n`;
	output += `      }\n\n`;
	output += `      if (!this.db) {\n`;
	output += `        throw new Error('Failed to initialize database connection');\n`;
	output += `      }\n\n`;
	output += `      await this.db.delete();\n`;
	output += `      console.log('Opening database connection...');\n`;
	output += `      await this.db.open();\n\n`;
	output += `      const result = await (this.db as SQLiteDBConnection).execute('PRAGMA foreign_keys = ON;');\n`;
	output += `      console.log('Foreign keys enabled:', result);\n`;
	output += `      console.log('Database URL:', (this.db as SQLiteDBConnection).getUrl());\n\n`;
	output += `      await this.createMigrationsTable();\n`;
	output += `      console.log('SQLite database initialized successfully');\n`;
	output += `    } catch (error) {\n`;
	output += `      console.error('Error initializing native database:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React native database initialization method.
 * 
 * @internal
 */
function generateReactInitNativeMethod(): string {
	// React version is similar but without Angular's platform service
	return generateAngularInitNativeMethod().replace(/this\.platform\.is\('hybrid'\)/, 'Capacitor.isNativePlatform()');
}

/**
 * Generate web database initialization method.
 * 
 * @param withDexie - Whether to include Dexie support
 * @internal
 */
function generateAngularInitWebMethod(withDexie: boolean): string {
	if (!withDexie) {
		return `  /**\n   * Initialize web database (placeholder - Dexie not enabled)\n   */\n  private async initWebDatabase(): Promise<void> {\n    console.warn('Web database not configured - enable Dexie support in config');\n  }\n\n`;
	}

	let output = `  /**\n`;
	output += `   * Initialize Dexie database for web platforms\n`;
	output += `   */\n`;
	output += `  private async initWebDatabase(): Promise<void> {\n`;
	output += `    try {\n`;
	output += `      // Import the generated AppDatabase class\n`;
	output += `      const { AppDatabase } = await import('../dexie-schema');\n`;
	output += `      this.dexieDb = new AppDatabase(DATABASE_CONFIG.name);\n`;
	output += `      this.db = this.dexieDb;\n`;
	output += `      console.log('Dexie database initialized using generated schema');\n`;
	output += `    } catch (error) {\n`;
	output += `      console.error('Error initializing web database:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React web database initialization method.
 * 
 * @param withDexie - Whether to include Dexie support
 * @internal
 */
function generateReactInitWebMethod(withDexie: boolean): string {
	return generateAngularInitWebMethod(withDexie);
}

/**
 * Generate migration-related methods.
 * 
 * @internal
 */
function generateAngularMigrationMethods(): string {
	let output = `  /**\n`;
	output += `   * Create migrations table for tracking database changes\n`;
	output += `   */\n`;
	output += `  private async createMigrationsTable(): Promise<void> {\n`;
	output += `    if (!this.db || !this.isNative) return;\n\n`;
	output += `    try {\n`;
	output += `      await (this.db as SQLiteDBConnection).execute(\`\n`;
	output += `        CREATE TABLE IF NOT EXISTS migrations (\n`;
	output += `          id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
	output += `          version INTEGER UNIQUE NOT NULL,\n`;
	output += `          description TEXT,\n`;
	output += `          executed_at TEXT NOT NULL\n`;
	output += `        )\n`;
	output += `      \`);\n`;
	output += `    } catch (error) {\n`;
	output += `      console.error('Error creating migrations table:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Run database migrations for SQLite (including table creation)\n`;
	output += `   */\n`;
	output += `  private async runMigrations(): Promise<void> {\n`;
	output += `    if (!this.isNative || !this.db) return;\n`;
	output += `    try {\n`;
	output += `      const versionResult = await (this.db as SQLiteDBConnection).query(\n`;
	output += `        \`SELECT MAX(version) as version FROM migrations\`\n`;
	output += `      );\n`;
	output += `      const currentVersion = versionResult.values && versionResult.values.length > 0 && versionResult.values[0].version\n`;
	output += `        ? versionResult.values[0].version\n`;
	output += `        : 0;\n`;
	output += `      console.log(\`Current database version: \${currentVersion}\`);\n\n`;
	output += `      const pendingMigrations = ALL_MIGRATIONS\n`;
	output += `        .filter(migration => migration.version > currentVersion)\n`;
	output += `        .sort((a, b) => a.version - b.version);\n\n`;
	output += `      if (pendingMigrations.length === 0) {\n`;
	output += `        console.log('No pending migrations');\n`;
	output += `        return;\n`;
	output += `      }\n`;
	output += `      console.log(\`Running \${pendingMigrations.length} migrations...\`);\n\n`;
	output += `      const upgradeStatements = prepareMigrations();\n`;
	output += `      const pendingUpgrades = upgradeStatements.filter(\n`;
	output += `        upgrade => upgrade.toVersion > currentVersion\n`;
	output += `      );\n\n`;
	output += `      if (pendingUpgrades.length > 0) {\n`;
	output += `        console.log(\`Adding \${pendingUpgrades.length} upgrade statements...\`);\n`;
	output += `        await this.sqlite!.addUpgradeStatement(DATABASE_CONFIG.name, pendingUpgrades);\n`;
	output += `      }\n\n`;
	output += `      for (const migration of pendingMigrations) {\n`;
	output += `        console.log(\`Recording migration to version \${migration.version}: \${migration.description}\`);\n`;
	output += `        try {\n`;
	output += `          const recordStatement = {\n`;
	output += `            statement: \`INSERT INTO migrations (version, description, executed_at) VALUES (?, ?, ?)\`,\n`;
	output += `            values: [migration.version, migration.description, new Date().toISOString()]\n`;
	output += `          } as capTask;\n`;
	output += `          await (this.db as SQLiteDBConnection).run(recordStatement.statement, recordStatement.values);\n`;
	output += `          console.log(\`Migration to version \${migration.version} completed\`);\n`;
	output += `        } catch (error) {\n`;
	output += `          console.error(\`Recording migration to version \${migration.version} failed:\`, error);\n`;
	output += `          throw error;\n`;
	output += `        }\n`;
	output += `      }\n`;
	output += `      console.log(\`Database migrated to version \${Math.max(...pendingMigrations.map(m => m.version))}\`);\n`;
	output += `    } catch (error) {\n`;
	output += `      console.error('Error running migrations:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React migration methods.
 * 
 * @internal
 */
function generateReactMigrationMethods(): string {
	return generateAngularMigrationMethods();
}

/**
 * Generate query execution methods.
 * 
 * @internal
 */
function generateAngularQueryMethods(): string {
	let output = `  /**\n`;
	output += `   * Execute a raw query on SQLite (only for native platforms)\n`;
	output += `   */\n`;
	output += `  async executeQuery(query: string, params: any[] = []): Promise<any> {\n`;
	output += `    if (!this.isNative || !this.db) {\n`;
	output += `      throw new Error('SQLite not available on this platform or database not initialized');\n`;
	output += `    }\n\n`;
	output += `    try {\n`;
	output += `      return await (this.db as SQLiteDBConnection).query(query, params);\n`;
	output += `    } catch (error) {\n`;
	output += `      console.error('Error executing query:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Execute a raw non-query command (INSERT, UPDATE, DELETE) on SQLite\n`;
	output += `   * Returns changes count\n`;
	output += `   */\n`;
	output += `  async executeCommand(query: string, params: any[] = []): Promise<any> {\n`;
	output += `    if (!this.isNative || !this.db) {\n`;
	output += `      throw new Error('SQLite not available on this platform or database not initialized');\n`;
	output += `    }\n\n`;
	output += `    try {\n`;
	output += `      return await (this.db as SQLiteDBConnection).run(query, params);\n`;
	output += `    } catch (error) {\n`;
	output += `      console.error('Error executing command:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React query methods.
 * 
 * @internal
 */
function generateReactQueryMethods(): string {
	return generateAngularQueryMethods();
}

/**
 * Generate utility methods.
 * 
 * @internal
 */
function generateAngularUtilityMethods(): string {
	let output = `  /**\n`;
	output += `   * Close the database connection\n`;
	output += `   */\n`;
	output += `  async closeDatabase(): Promise<void> {\n`;
	output += `    if (this.isNative && this.sqlite && this.db) {\n`;
	output += `      await (this.db as SQLiteDBConnection).close();\n`;
	output += `      await this.sqlite.closeConnection(DATABASE_CONFIG.name, false);\n`;
	output += `    }\n`;
	output += `    this._isReady.next(false);\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Get the database instance\n`;
	output += `   */\n`;
	output += `  getDatabaseInstance(): SQLiteDBConnection | Dexie | null {\n`;
	output += `    return this.db;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Check if using native database\n`;
	output += `   */\n`;
	output += `  isNativeDatabase(): boolean {\n`;
	output += `    return this.isNative;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Get Dexie instance (web only)\n`;
	output += `   */\n`;
	output += `  getDexieInstance(): any {\n`;
	output += `    if (!this.isNative && this.dexieDb) {\n`;
	output += `      return this.dexieDb;\n`;
	output += `    }\n`;
	output += `    return null;\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React utility methods.
 * 
 * @internal
 */
function generateReactUtilityMethods(): string {
	let output = `  /**\n`;
	output += `   * Close the database connection\n`;
	output += `   */\n`;
	output += `  async closeDatabase(): Promise<void> {\n`;
	output += `    if (this.isNative && this.sqlite && this.db) {\n`;
	output += `      await (this.db as SQLiteDBConnection).close();\n`;
	output += `      await this.sqlite.closeConnection(DATABASE_CONFIG.name, false);\n`;
	output += `    }\n`;
	output += `    this.notifyReadyState(false);\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Get the database instance\n`;
	output += `   */\n`;
	output += `  getDatabaseInstance(): SQLiteDBConnection | Dexie | null {\n`;
	output += `    return this.db;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Check if using native database\n`;
	output += `   */\n`;
	output += `  isNativeDatabase(): boolean {\n`;
	output += `    return this.isNative;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Get Dexie instance (web only)\n`;
	output += `   */\n`;
	output += `  getDexieInstance(): any {\n`;
	output += `    if (!this.isNative && this.dexieDb) {\n`;
	output += `      return this.dexieDb;\n`;
	output += `    }\n`;
	output += `    return null;\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate development helper method.
 * 
 * @internal
 */
function generateAngularDevelopmentMethod(): string {
	let output = `  async development() {\n`;
	output += `    if (isDevelopment) {\n`;
	output += `      let dbDevExists = await Filesystem.readdir({ path: 'databases', directory: Directory.Documents });\n`;
	output += `      if (dbDevExists.files.length > 0) {\n`;
	output += `        const files = await Filesystem.readdir({ path: 'databases', directory: Directory.Documents });\n`;
	output += `        for (const file of files.files) {\n`;
	output += `          await Filesystem.deleteFile({ path: \`databases/\${file.name}\`, directory: Directory.Documents });\n`;
	output += `        }\n`;
	output += `      }\n\n`;
	output += `      let db = await Filesystem.readdir({ path: '../databases', directory: Directory.Data });\n`;
	output += `      for (let d of db.files) {\n`;
	output += `        await Filesystem.copy({\n`;
	output += `          from: \`../databases/\${d.name}\`,\n`;
	output += `          to: \`databases/\${d.name}\`,\n`;
	output += `          directory: Directory.Data,\n`;
	output += `          toDirectory: Directory.Documents\n`;
	output += `        });\n`;
	output += `      }\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React development method.
 * 
 * @internal
 */
function generateReactDevelopmentMethod(): string {
	return generateAngularDevelopmentMethod();
}

/**
 * Generate database.config.ts file if it doesn't exist.
 * 
 * @param outputDir - Directory where the config file should be created
 * @param databaseName - Name of the database (configurable)
 * @returns Promise<boolean> - True if file was created or already exists, false on error
 * 
 * @internal
 */
async function generateDatabaseConfigFile(outputDir: string, databaseName: string): Promise<boolean> {
	try {
		const configPath = join(outputDir, 'database.config.ts');

		// Check if the file already exists
		if (await utils.checkFileExists(configPath)) {
			console.log(`Database config already exists at ${configPath}, skipping generation.`);
			return true;
		}

		console.log(`Generating database config at ${configPath}...`);

		const configContent = `export const DATABASE_CONFIG = {
  name: '${databaseName}',
  encryption: false,
  mode: 'no-encryption' as const
};
`;

		// Write the config file
		const success = await utils.writeToFile(configPath, configContent);
		if (success) {
			console.log(`✓ Generated database config: ${configPath}`);
			return true;
		} else {
			console.error(`✗ Failed to write database config to ${configPath}`);
			return false;
		}
	} catch (error) {
		console.error('Error generating database config:', error);
		return false;
	}
}

/**
 * Generate migration-helper.ts file if it doesn't exist.
 * 
 * @param outputDir - Directory where the migration helper file should be created
 * @returns Promise<boolean> - True if file was created or already exists, false on error
 * 
 * @internal
 */
async function generateMigrationHelperFile(outputDir: string): Promise<boolean> {
	try {
		const helperPath = join(outputDir, 'migration-helper.ts');

		// Check if the file already exists
		if (await utils.checkFileExists(helperPath)) {
			console.log(`Migration helper already exists at ${helperPath}, skipping generation.`);
			return true;
		}

		console.log(`Generating migration helper at ${helperPath}...`);

		const helperContent = `/**
 * Helper functions for migrations
 */
import { ALL_MIGRATIONS } from './migrations';

/**
 * Validate migration versions to ensure they're sequential and have unique version numbers
 */
export function validateMigrations() {
  const versions = ALL_MIGRATIONS.map(m => m.version);
  const errors: string[] = [];

  // Check for unique versions
  const uniqueVersions = new Set(versions);
  if (uniqueVersions.size !== versions.length) {
    errors.push('Duplicate version numbers found in migrations');
  }

  // Check for sequential versions starting from 1
  for (let i = 1; i <= versions.length; i++) {
    if (!versions.includes(i)) {
      errors.push(\`Missing migration version \${i}\`);
    }
  }

  // Check for versions higher than expected
  const max = Math.max(...versions);
  if (max > versions.length) {
    errors.push(\`Highest version (\${max}) is greater than the number of migrations (\${versions.length})\`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
`;

		// Write the helper file
		const success = await utils.writeToFile(helperPath, helperContent);
		if (success) {
			console.log(`✓ Generated migration helper: ${helperPath}`);
			return true;
		} else {
			console.error(`✗ Failed to write migration helper to ${helperPath}`);
			return false;
		}
	} catch (error) {
		console.error('Error generating migration helper:', error);
		return false;
	}
}
