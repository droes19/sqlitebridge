/**
 * React Service Generator
 * 
 * Generates React-specific database service implementation with hooks and context
 */

import { generateCommonMigrationMethods, generateCommonMethods } from './common-generators';

/**
 * Generate React database service with hooks and context.
 * 
 * @param withDexie - Whether to include Dexie support
 * @returns Generated React service
 */
export function generateReactService(withDexie: boolean): string {
	let output = `// Development mode detection\n`;
	output += `const isDevelopment = process.env.NODE_ENV === 'development';\n\n`;

	// Database service class
	output += generateReactDatabaseClass(withDexie);

	// Create singleton instance
	output += `// Create a singleton instance for React\n`;
	output += `const databaseService = new DatabaseService();\n\n`;

	// React Context and Provider
	output += generateReactContext();

	// React Hooks
	output += generateReactHooks();

	return output;
}

/**
 * Generate React database service class.
 * 
 * @param withDexie - Whether to include Dexie support
 * @returns Generated service class
 */
function generateReactDatabaseClass(withDexie: boolean): string {
	let output = `/**\n`;
	output += ` * React Database Service\n`;
	output += ` * Handles SQLite (native) and Dexie.js (web) database operations\n`;
	output += ` */\n`;
	output += `class DatabaseService {\n`;
	output += `  private sqlite: SQLiteConnection | null = null;\n`;
	output += `  private db: SQLiteDBConnection | Dexie | null = null;\n`;
	output += `  private isNative = false;\n`;
	if (withDexie) {
		output += `  private dexieDb: AppDatabase | null = null;\n`;
	}
	output += `  private _isReady = false;\n`;
	output += `  private _error: string | null = null;\n\n`;

	// Initialize method
	output += generateReactInitializeMethod(withDexie);

	// Native database methods
	output += generateReactNativeMethods();

	if (withDexie) {
		// Web database methods
		output += generateReactWebMethods();
	}

	// Migration methods (adapted for React)
	output += generateCommonMigrationMethods('react');

	// Common methods (adapted for React)
	output += generateCommonMethods('react');

	// React-specific methods
	output += generateReactSpecificMethods();

	output += `}\n\n`;

	return output;
}

/**
 * Generate React initialize method.
 * 
 * @param withDexie - Whether to include Dexie support
 * @returns Generated initialize method
 */
function generateReactInitializeMethod(withDexie: boolean): string {
	let output = `  /**\n`;
	output += `   * Initialize the database\n`;
	output += `   */\n`;
	output += `  async initializeDatabase(): Promise<void> {\n`;
	output += `    try {\n`;
	output += `      // Development validation\n`;
	output += `      if (isDevelopment) {\n`;
	output += `        const validation = validateMigrations();\n`;
	output += `        if (!validation.valid) {\n`;
	output += `          console.warn('⚠️ MIGRATION VALIDATION FAILED ⚠️');\n`;
	output += `          validation.errors.forEach(error => console.error(\`- \${error}\`));\n`;
	output += `        }\n`;
	output += `      }\n\n`;

	output += `      // Detect platform\n`;
	output += `      this.isNative = Capacitor.isNativePlatform();\n\n`;

	output += `      if (this.isNative) {\n`;
	output += `        await this.initNativeDatabase();\n`;
	output += `        await this.runMigrations();\n`;
	output += `      }`;

	if (withDexie) {
		output += ` else {\n`;
		output += `        await this.initWebDatabase();\n`;
		output += `      }`;
	}

	output += `\n\n`;
	output += `      this._isReady = true;\n`;
	output += `    } catch (error) {\n`;
	output += `      this._error = error instanceof Error ? error.message : 'Unknown error';\n`;
	output += `      console.error('Database initialization failed:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React native database methods.
 * 
 * @returns Generated native methods
 */
function generateReactNativeMethods(): string {
	let output = `  /**\n`;
	output += `   * Initialize SQLite database for native platforms\n`;
	output += `   */\n`;
	output += `  private async initNativeDatabase(): Promise<void> {\n`;
	output += `    try {\n`;
	output += `      console.log('Initializing native SQLite database...');\n`;
	output += `      this.sqlite = new SQLiteConnection(CapacitorSQLite);\n\n`;

	output += `      // Connection with retry logic\n`;
	output += `      let retryCount = 0;\n`;
	output += `      const maxRetries = 3;\n\n`;

	output += `      while (retryCount < maxRetries) {\n`;
	output += `        try {\n`;
	output += `          const ret = await this.sqlite.checkConnectionsConsistency();\n`;
	output += `          const isConn = await this.sqlite.isConnection(DATABASE_CONFIG.name, false);\n\n`;

	output += `          if (ret.result && isConn.result) {\n`;
	output += `            this.db = await this.sqlite.retrieveConnection(DATABASE_CONFIG.name, false);\n`;
	output += `            break;\n`;
	output += `          } else {\n`;
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
	output += `          retryCount++;\n`;
	output += `          if (retryCount >= maxRetries) {\n`;
	output += `            throw new Error(\`Failed to connect after \${maxRetries} attempts: \${error}\`);\n`;
	output += `          }\n`;
	output += `          await new Promise(resolve => setTimeout(resolve, 500));\n`;
	output += `        }\n`;
	output += `      }\n\n`;

	output += `      if (!this.db) {\n`;
	output += `        throw new Error('Failed to initialize database connection');\n`;
	output += `      }\n\n`;

	output += `      await this.db.open();\n`;
	output += `      await (this.db as SQLiteDBConnection).execute('PRAGMA foreign_keys = ON;');\n`;
	output += `      await this.createMigrationsTable();\n\n`;

	output += `      console.log('SQLite database initialized successfully');\n`;
	output += `    } catch (error) {\n`;
	output += `      console.error('Error initializing native database:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React web database methods.
 * 
 * @returns Generated web methods
 */
function generateReactWebMethods(): string {
	let output = `  /**\n`;
	output += `   * Initialize Dexie database for web platforms\n`;
	output += `   */\n`;
	output += `  private async initWebDatabase(): Promise<void> {\n`;
	output += `    try {\n`;
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
 * Generate React-specific methods.
 * 
 * @returns Generated React methods
 */
function generateReactSpecificMethods(): string {
	let output = `  /**\n`;
	output += `   * Close the database connection\n`;
	output += `   */\n`;
	output += `  async closeDatabase(): Promise<void> {\n`;
	output += `    if (this.isNative && this.sqlite && this.db) {\n`;
	output += `      await (this.db as SQLiteDBConnection).close();\n`;
	output += `      await this.sqlite.closeConnection(DATABASE_CONFIG.name, false);\n`;
	output += `    }\n`;
	output += `    this._isReady = false;\n`;
	output += `    this._error = null;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Get database readiness status\n`;
	output += `   */\n`;
	output += `  get isReady(): boolean {\n`;
	output += `    return this._isReady;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Get error status\n`;
	output += `   */\n`;
	output += `  get error(): string | null {\n`;
	output += `    return this._error;\n`;
	output += `  }\n\n`;

	output += `  /**\n`;
	output += `   * Reset error state\n`;
	output += `   */\n`;
	output += `  resetError(): void {\n`;
	output += `    this._error = null;\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generate React context and provider.
 * 
 * @returns Generated React context
 */
function generateReactContext(): string {
	let output = `/**\n`;
	output += ` * React Context for Database\n`;
	output += ` */\n`;
	output += `const DatabaseContext = createContext<DatabaseContextType | null>(null);\n\n`;

	output += `/**\n`;
	output += ` * Database Provider Component for React\n`;
	output += ` */\n`;
	output += `export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ \n`;
	output += `  children, \n`;
	output += `  autoInitialize = true \n`;
	output += `}) => {\n`;
	output += `  const [state, setState] = useState<DatabaseState>({\n`;
	output += `    isReady: false,\n`;
	output += `    isNative: false,\n`;
	output += `    error: null,\n`;
	output += `    isInitializing: false\n`;
	output += `  });\n\n`;

	output += `  const initializeDatabase = useMemo(() => async () => {\n`;
	output += `    setState(prev => ({ ...prev, isInitializing: true, error: null }));\n`;
	output += `    \n`;
	output += `    try {\n`;
	output += `      await databaseService.initializeDatabase();\n`;
	output += `      setState({\n`;
	output += `        isReady: true,\n`;
	output += `        isNative: databaseService.isNativeDatabase(),\n`;
	output += `        error: null,\n`;
	output += `        isInitializing: false\n`;
	output += `      });\n`;
	output += `    } catch (error) {\n`;
	output += `      setState(prev => ({\n`;
	output += `        ...prev,\n`;
	output += `        error: error instanceof Error ? error.message : 'Unknown error',\n`;
	output += `        isInitializing: false\n`;
	output += `      }));\n`;
	output += `    }\n`;
	output += `  }, []);\n\n`;

	output += `  useEffect(() => {\n`;
	output += `    if (autoInitialize && !state.isReady && !state.isInitializing) {\n`;
	output += `      initializeDatabase();\n`;
	output += `    }\n`;
	output += `  }, [autoInitialize, state.isReady, state.isInitializing, initializeDatabase]);\n\n`;

	output += `  const contextValue: DatabaseContextType = useMemo(() => ({\n`;
	output += `    isReady: state.isReady,\n`;
	output += `    isNative: state.isNative,\n`;
	output += `    error: state.error,\n`;
	output += `    executeQuery: databaseService.executeQuery.bind(databaseService),\n`;
	output += `    executeCommand: databaseService.executeCommand.bind(databaseService),\n`;
	output += `    getDexieInstance: databaseService.getDexieInstance.bind(databaseService),\n`;
	output += `    isNativeDatabase: databaseService.isNativeDatabase.bind(databaseService),\n`;
	output += `    closeDatabase: databaseService.closeDatabase.bind(databaseService)\n`;
	output += `  }), [state.isReady, state.isNative, state.error]);\n\n`;

	output += `  return (\n`;
	output += `    <DatabaseContext.Provider value={contextValue}>\n`;
	output += `      {children}\n`;
	output += `    </DatabaseContext.Provider>\n`;
	output += `  );\n`;
	output += `};\n\n`;

	return output;
}

/**
 * Generate React hooks.
 * 
 * @returns Generated React hooks
 */
function generateReactHooks(): string {
	let output = `/**\n`;
	output += ` * React Hook to use Database\n`;
	output += ` */\n`;
	output += `export const useDatabase = (): DatabaseContextType => {\n`;
	output += `  const context = useContext(DatabaseContext);\n`;
	output += `  if (!context) {\n`;
	output += `    throw new Error('useDatabase must be used within a DatabaseProvider');\n`;
	output += `  }\n`;
	output += `  return context;\n`;
	output += `};\n\n`;

	output += `/**\n`;
	output += ` * React Hook for Database Status\n`;
	output += ` */\n`;
	output += `export const useDatabaseStatus = () => {\n`;
	output += `  const { isReady, isNative, error } = useDatabase();\n`;
	output += `  return { isReady, isNative, error };\n`;
	output += `};\n\n`;

	output += `/**\n`;
	output += ` * React Hook for Database Operations\n`;
	output += ` */\n`;
	output += `export const useDatabaseOperations = () => {\n`;
	output += `  const { executeQuery, executeCommand, getDexieInstance, isNativeDatabase } = useDatabase();\n`;
	output += `  return { executeQuery, executeCommand, getDexieInstance, isNativeDatabase };\n`;
	output += `};\n\n`;

	output += `/**\n`;
	output += ` * React Hook for Database Initialization\n`;
	output += ` */\n`;
	output += `export const useDatabaseInit = () => {\n`;
	output += `  const [isInitializing, setIsInitializing] = useState(false);\n`;
	output += `  const [error, setError] = useState<string | null>(null);\n\n`;

	output += `  const initialize = useCallback(async () => {\n`;
	output += `    setIsInitializing(true);\n`;
	output += `    setError(null);\n`;
	output += `    \n`;
	output += `    try {\n`;
	output += `      await databaseService.initializeDatabase();\n`;
	output += `    } catch (err) {\n`;
	output += `      setError(err instanceof Error ? err.message : 'Unknown error');\n`;
	output += `      throw err;\n`;
	output += `    } finally {\n`;
	output += `      setIsInitializing(false);\n`;
	output += `    }\n`;
	output += `  }, []);\n\n`;

	output += `  return {\n`;
	output += `    initialize,\n`;
	output += `    isInitializing,\n`;
	output += `    error,\n`;
	output += `    isReady: databaseService.isReady\n`;
	output += `  };\n`;
	output += `};\n\n`;

	output += `/**\n`;
	output += ` * React Hook for Database Error Handling\n`;
	output += ` */\n`;
	output += `export const useDatabaseError = () => {\n`;
	output += `  const { error } = useDatabaseStatus();\n\n`;

	output += `  const clearError = useCallback(() => {\n`;
	output += `    databaseService.resetError();\n`;
	output += `  }, []);\n\n`;

	output += `  return {\n`;
	output += `    error,\n`;
	output += `    hasError: !!error,\n`;
	output += `    clearError\n`;
	output += `  };\n`;
	output += `};\n`;

	return output;
}
