/**
 * Service Generator - Write GetById Method Module
 * 
 * This module generates TypeScript code for a database entity's getById method
 * in both Angular services and React hooks. It retrieves a single entity by its 
 * primary key and supports both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

import { FrameworkType } from "../../config";

/**
 * Generates the TypeScript code for a getById method in a service class or React hook.
 * 
 * This function creates a method that retrieves a single entity from a database table
 * based on its primary key and maps it to its TypeScript model representation.
 * It supports both SQLite and Dexie.js implementations.
 * For React, it generates a hook with state management. For Angular, it generates a service method.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object with name, camelCase, and type
 * @param withDexie - Whether to include Dexie.js implementation
 * @param framework - Target framework ('angular' | 'react')
 * @returns Updated output string with the getById method added
 * 
 * @example
 * ```typescript
 * // Angular service method
 * let output = '';
 * output = writeGetByIdMethod(
 *   output,
 *   'User',
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true,
 *   'angular'
 * );
 * 
 * // React hook
 * output = writeGetByIdMethod(
 *   output,
 *   'User',
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true,
 *   'react'
 * );
 * ```
 */
export function writeGetByIdMethod(
	output: string,
	interfaceName: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean,
	framework: FrameworkType
): string {
	if (framework === 'react') {
		return writeReactGetByIdHook(
			output,
			interfaceName,
			tableName,
			primaryKey,
			withDexie
		);
	} else {
		return writeAngularGetByIdMethod(
			output,
			interfaceName,
			tableName,
			primaryKey,
			withDexie
		);
	}
}

/**
 * Generate React getById hook.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactGetByIdHook(
	output: string,
	interfaceName: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	// React GET BY ID hook
	output += `  /**\n`;
	output += `   * React hook for retrieving a single ${interfaceName.toLowerCase()} entity by its ID.\n`;
	output += `   * Returns data, loading state, error state, and refetch function.\n`;
	output += `   * \n`;
	output += `   * @param id - The primary key (${primaryKey.name}) of the entity to retrieve\n`;
	output += `   * @returns Hook state with data, loading, error, and refetch\n`;
	output += `   */\n`;
	output += `  const useGetById = (id: ${primaryKey.type}): ${interfaceName}QueryState => {\n`;
	output += `    const [data, setData] = React.useState<${interfaceName} | null>(null);\n`;
	output += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
	output += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

	output += `    const fetchData = React.useCallback(async () => {\n`;
	output += `      if (!id) {\n`;
	output += `        setData(null);\n`;
	output += `        return;\n`;
	output += `      }\n\n`;

	output += `      try {\n`;
	output += `        setLoading(true);\n`;
	output += `        setError(null);\n\n`;

	output = withDexie ?
		writeReactGetByIdWithDexie(output, tableName, primaryKey) :
		writeReactGetById(output, tableName, primaryKey, false);

	output += `      } catch (err) {\n`;
	output += `        console.error(\`Error getting ${interfaceName.toLowerCase()} by ID \${id}:\`, err);\n`;
	output += `        const errorMessage = err instanceof Error ? err.message : 'Unknown error';\n`;
	output += `        setError(errorMessage);\n`;
	output += `      } finally {\n`;
	output += `        setLoading(false);\n`;
	output += `      }\n`;
	output += `    }, [id]);\n\n`;

	output += `    React.useEffect(() => {\n`;
	output += `      fetchData();\n`;
	output += `    }, [fetchData]);\n\n`;

	output += `    return {\n`;
	output += `      data,\n`;
	output += `      loading,\n`;
	output += `      error,\n`;
	output += `      refetch: fetchData\n`;
	output += `    };\n`;
	output += `  };\n\n`;

	return output;
}

/**
 * Generate Angular getById method.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeAngularGetByIdMethod(
	output: string,
	interfaceName: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	// Angular GET BY ID method
	output += `  /**\n`;
	output += `   * Retrieves a single ${interfaceName.toLowerCase()} entity by its ID.\n`;
	output += `   * \n`;
	output += `   * @param id - The primary key (${primaryKey.name}) of the entity to retrieve\n`;
	output += `   * @returns Promise resolving to the entity if found, or null if not found\n`;
	output += `   */\n`;
	output += `  async getById(id: ${primaryKey.type}): Promise<${interfaceName} | null> {\n`;
	output += `    try {\n`;

	output = withDexie ?
		writeGetByIdWithDexie(output, tableName, primaryKey) :
		writeGetById(output, tableName, primaryKey, false);

	output += `    } catch (error) {\n`;
	output += `      console.error(\`Error getting ${interfaceName.toLowerCase()} by ID \${id}:\`, error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generates React getById implementation with both SQLite and Dexie.js support.
 * 
 * @param output - Current output string
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactGetByIdWithDexie(
	output: string,
	tableName: string,
	primaryKey: any
): string {
	output += `        if (databaseService.isNativeDatabase()) {\n`;
	output = writeReactGetById(output, tableName, primaryKey, true);

	output += `        } else {\n`;
	output += `          // Dexie implementation\n`;
	output += `          const dexie = databaseService.getDexieInstance();\n`;
	output += `          if (!dexie) throw new Error('Dexie database not initialized');\n`;
	output += `          \n`;
	output += `          const entity = await dexie.${tableName}.get(id);\n`;
	output += `          setData(entity ? mapTableToModel(entity) : null);\n`;
	output += `        }\n`;

	return output;
}

/**
 * Generates React getById implementation for SQLite.
 * 
 * @param output - Current output string
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @param withDexie - Whether this is embedded in a Dexie conditional block
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactGetById(
	output: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	const indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	output += `${indent}      // SQLite implementation\n`;
	output += `${indent}      const result = await databaseService.executeQuery(\n`;
	output += `${indent}        'SELECT * FROM ${tableName} WHERE ${primaryKey.name} = ?',\n`;
	output += `${indent}        [id]\n`;
	output += `${indent}      );\n`;
	output += `${indent}      \n`;
	output += `${indent}      if (result.values && result.values.length > 0) {\n`;
	output += `${indent}        setData(mapTableToModel(result.values[0]));\n`;
	output += `${indent}      } else {\n`;
	output += `${indent}        setData(null);\n`;
	output += `${indent}      }\n`;

	return output;
}

/**
 * Generates Angular getById implementation with both SQLite and Dexie.js support.
 * 
 * This function creates a method implementation that first checks if the device is using
 * a native database (SQLite) or a web database (Dexie.js), and then calls the appropriate
 * implementation.
 * 
 * @param output - Current output string to append to
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object
 * @returns Updated output string with the Dexie-aware implementation
 * 
 * @internal
 */
function writeGetByIdWithDexie(
	output: string,
	tableName: string,
	primaryKey: any
): string {
	output += `      if (this.databaseService.isNativeDatabase()) {\n`;
	output = writeGetById(output, tableName, primaryKey, true);
	output += `      } else {\n`;
	output += `        // Dexie implementation\n`;
	output += `        const dexie = this.databaseService.getDexieInstance();\n`;
	output += `        if (!dexie) throw new Error('Dexie database not initialized');\n`;
	output += `        \n`;
	output += `        const entity = await dexie.${tableName}.get(id);\n`;
	output += `        return entity ? this.mapTableToModel(entity) : null;\n`;
	output += `      }\n`;

	return output;
}

/**
 * Generates Angular getById implementation for SQLite.
 * 
 * This function creates a method implementation that retrieves a single row from a
 * SQLite database table based on its primary key and maps it to its TypeScript model
 * representation.
 * 
 * @param output - Current output string to append to
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object
 * @param withDexie - Whether this is embedded in a Dexie.js conditional block (affects indentation)
 * @returns Updated output string with the SQLite implementation
 * 
 * @internal
 */
function writeGetById(
	output: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	let withDexieSpace = withDexie ? " ".repeat(2) : "";
	output += withDexieSpace + `      // SQLite implementation\n`;
	output += withDexieSpace + `      const result = await this.databaseService.executeQuery(\n`;
	output += withDexieSpace + `        'SELECT * FROM ${tableName} WHERE ${primaryKey.name} = ?',\n`;
	output += withDexieSpace + `        [id]\n`;
	output += withDexieSpace + `      );\n`;
	output += withDexieSpace + `      \n`;
	output += withDexieSpace + `      if (result.values && result.values.length > 0) {\n`;
	output += withDexieSpace + `        return this.mapTableToModel(result.values[0]);\n`;
	output += withDexieSpace + `      }\n`;
	output += withDexieSpace + `      return null;\n`;

	return output;
}
