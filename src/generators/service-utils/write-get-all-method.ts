/**
 * Service Generator - Write GetAll Method Module
 * 
 * This module generates TypeScript code for a database entity's getAll method
 * in both Angular services and React hooks. It retrieves all entities of a 
 * particular type from the database and supports both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

import { FrameworkType } from "../../config";

/**
 * Generates the TypeScript code for a getAll method in a service class or React hook.
 * 
 * This function creates a method that retrieves all entities from a database table
 * and maps them to their TypeScript model representations. It supports both
 * SQLite and Dexie.js implementations.
 * For React, it generates a hook with state management. For Angular, it generates a service method.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableInterfaceName - Name of the table interface (PascalCase with "Table" suffix)
 * @param tableName - Name of the database table
 * @param withDexie - Whether to include Dexie.js implementation
 * @param framework - Target framework ('angular' | 'react')
 * @returns Updated output string with the getAll method added
 * 
 * @example
 * ```typescript
 * // Angular service method
 * let output = '';
 * output = writeGetAllMethod(
 *   output,
 *   'User',
 *   'UserTable',
 *   'users',
 *   true,
 *   'angular'
 * );
 * 
 * // React hook
 * output = writeGetAllMethod(
 *   output,
 *   'User',
 *   'UserTable', 
 *   'users',
 *   true,
 *   'react'
 * );
 * ```
 */
export function writeGetAllMethod(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	tableName: string,
	withDexie: boolean,
	framework: FrameworkType
): string {
	if (framework === 'react') {
		return writeReactGetAllHook(
			output,
			interfaceName,
			tableInterfaceName,
			tableName,
			withDexie
		);
	} else {
		return writeAngularGetAllMethod(
			output,
			interfaceName,
			tableInterfaceName,
			tableName,
			withDexie
		);
	}
}

/**
 * Generate React getAll hook.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableInterfaceName - Table interface name
 * @param tableName - Table name
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactGetAllHook(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	tableName: string,
	withDexie: boolean
): string {
	// React GET ALL hook
	output += `  /**\n`;
	output += `   * React hook for retrieving all ${tableName} entities from the database.\n`;
	output += `   * Returns data array, loading state, error state, and refetch function.\n`;
	output += `   * \n`;
	output += `   * @returns Hook state with data, loading, error, and refetch\n`;
	output += `   */\n`;
	output += `  const useGetAll = (): ${interfaceName}QueryState => {\n`;
	output += `    const [data, setData] = React.useState<${interfaceName}[]>([]);\n`;
	output += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
	output += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

	output += `    const fetchData = React.useCallback(async () => {\n`;
	output += `      try {\n`;
	output += `        setLoading(true);\n`;
	output += `        setError(null);\n\n`;

	output = withDexie ?
		writeReactGetAllWithDexie(output, tableInterfaceName, tableName) :
		writeReactGetAll(output, tableInterfaceName, tableName, false);

	output += `      } catch (err) {\n`;
	output += `        console.error('Error getting all ${tableName}:', err);\n`;
	output += `        const errorMessage = err instanceof Error ? err.message : 'Unknown error';\n`;
	output += `        setError(errorMessage);\n`;
	output += `      } finally {\n`;
	output += `        setLoading(false);\n`;
	output += `      }\n`;
	output += `    }, []);\n\n`;

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
 * Generate Angular getAll method.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableInterfaceName - Table interface name
 * @param tableName - Table name
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeAngularGetAllMethod(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	tableName: string,
	withDexie: boolean
): string {
	// Angular GET ALL method
	output += `  /**\n`;
	output += `   * Retrieves all ${tableName} entities from the database.\n`;
	output += `   * \n`;
	output += `   * @returns Promise resolving to an array of ${interfaceName} entities\n`;
	output += `   */\n`;
	output += `  async getAll(): Promise<${interfaceName}[]> {\n`;
	output += `    try {\n`;

	output = withDexie ?
		writeGetAllWithDexie(output, tableInterfaceName, tableName) :
		writeGetAll(output, tableInterfaceName, tableName, false);

	output += `    } catch (error) {\n`;
	output += `      console.error('Error getting all ${tableName}:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generates React getAll implementation with both SQLite and Dexie.js support.
 * 
 * @param output - Current output string
 * @param tableInterfaceName - Table interface name
 * @param tableName - Table name
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactGetAllWithDexie(
	output: string,
	tableInterfaceName: string,
	tableName: string
): string {
	output += `        if (databaseService.isNativeDatabase()) {\n`;
	output = writeReactGetAll(output, tableInterfaceName, tableName, true);

	output += `        } else {\n`;
	output += `          // Dexie implementation\n`;
	output += `          const dexie = databaseService.getDexieInstance();\n`;
	output += `          if (!dexie) throw new Error('Dexie database not initialized');\n`;
	output += `          \n`;
	output += `          const entities = await dexie.${tableName}.toArray();\n`;
	output += `          setData(entities.map((entity: ${tableInterfaceName}) => mapTableToModel(entity)));\n`;
	output += `        }\n`;

	return output;
}

/**
 * Generates React getAll implementation for SQLite.
 * 
 * @param output - Current output string
 * @param tableInterfaceName - Table interface name
 * @param tableName - Table name
 * @param withDexie - Whether this is embedded in a Dexie conditional block
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactGetAll(
	output: string,
	tableInterfaceName: string,
	tableName: string,
	withDexie: boolean
): string {
	const indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	output += `${indent}      // SQLite implementation\n`;
	output += `${indent}      const result = await databaseService.executeQuery('SELECT * FROM ${tableName}');\n`;
	output += `${indent}      \n`;
	output += `${indent}      if (result.values && result.values.length > 0) {\n`;
	output += `${indent}        setData(result.values.map((entity: ${tableInterfaceName}) => mapTableToModel(entity)));\n`;
	output += `${indent}      } else {\n`;
	output += `${indent}        setData([]);\n`;
	output += `${indent}      }\n`;

	return output;
}

/**
 * Generates Angular getAll implementation with both SQLite and Dexie.js support.
 * 
 * This function creates a method implementation that first checks if the device is using
 * a native database (SQLite) or a web database (Dexie.js), and then calls the appropriate
 * implementation.
 * 
 * @param output - Current output string to append to
 * @param tableInterfaceName - Name of the table interface
 * @param tableName - Name of the database table
 * @returns Updated output string with the Dexie-aware implementation
 * 
 * @internal
 */
function writeGetAllWithDexie(
	output: string,
	tableInterfaceName: string,
	tableName: string
): string {
	output += `      if (this.databaseService.isNativeDatabase()) {\n`;
	output = writeGetAll(output, tableInterfaceName, tableName, true);
	output += `      } else {\n`;
	output += `        // Dexie implementation\n`;
	output += `        const dexie = this.databaseService.getDexieInstance();\n`;
	output += `        if (!dexie) throw new Error('Dexie database not initialized');\n`;
	output += `        \n`;
	output += `        const entities = await dexie.${tableName}.toArray();\n`;
	output += `        return entities.map((entity: ${tableInterfaceName}) => this.mapTableToModel(entity));\n`;
	output += `      }\n`;

	return output;
}

/**
 * Generates Angular getAll implementation for SQLite.
 * 
 * This function creates a method implementation that retrieves all rows from a
 * SQLite database table and maps them to their TypeScript model representations.
 * 
 * @param output - Current output string to append to
 * @param tableInterfaceName - Name of the table interface
 * @param tableName - Name of the database table
 * @param withDexie - Whether this is embedded in a Dexie.js conditional block (affects indentation)
 * @returns Updated output string with the SQLite implementation
 * 
 * @internal
 */
function writeGetAll(
	output: string,
	tableInterfaceName: string,
	tableName: string,
	withDexie: boolean
): string {
	let withDexieSpace = withDexie ? " ".repeat(2) : "";
	output += `${withDexieSpace}      // SQLite implementation\n`;
	output += `${withDexieSpace}      const result = await this.databaseService.executeQuery('SELECT * FROM ${tableName}');\n`;
	output += `${withDexieSpace}      \n`;
	output += `${withDexieSpace}      if (result.values && result.values.length > 0) {\n`;
	output += `${withDexieSpace}        return result.values.map((entity: ${tableInterfaceName}) => this.mapTableToModel(entity));\n`;
	output += `${withDexieSpace}      }\n`;
	output += `${withDexieSpace}      return [];\n`;

	return output;
}
