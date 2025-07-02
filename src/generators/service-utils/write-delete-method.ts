/**
 * Service Generator - Write Delete Method Module
 * 
 * This module generates TypeScript code for a database entity's delete method
 * in both Angular services and React hooks. It supports both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

import { FrameworkType } from "../../config";

/**
 * Generates the TypeScript code for a DELETE method in a service class or React hook.
 * 
 * This function creates a method that deletes an entity from the database table
 * based on its primary key. It supports both SQLite and Dexie.js implementations.
 * For React, it generates a mutation hook with state management. For Angular, it generates a service method.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object with name, camelCase, and type
 * @param withDexie - Whether to include Dexie.js implementation
 * @param framework - Target framework ('angular' | 'react')
 * @returns Updated output string with the DELETE method added
 * 
 * @example
 * ```typescript
 * // Angular service method
 * let output = '';
 * output = writeDeleteMethod(
 *   output,
 *   'User',
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true,
 *   'angular'
 * );
 * 
 * // React hook
 * output = writeDeleteMethod(
 *   output,
 *   'User',
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true,
 *   'react'
 * );
 * ```
 */
export function writeDeleteMethod(
	output: string,
	interfaceName: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean,
	framework: FrameworkType
): string {
	if (framework === 'react') {
		return writeReactDeleteHook(
			output,
			interfaceName,
			tableName,
			primaryKey,
			withDexie
		);
	} else {
		return writeAngularDeleteMethod(
			output,
			interfaceName,
			tableName,
			primaryKey,
			withDexie
		);
	}
}

/**
 * Generate React delete hook.
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
function writeReactDeleteHook(
	output: string,
	interfaceName: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	// React DELETE hook
	output += `  /**\n`;
	output += `   * React hook for deleting an existing ${interfaceName.toLowerCase()} entity from the database.\n`;
	output += `   * Returns mutation function, loading state, error state, and reset function.\n`;
	output += `   * \n`;
	output += `   * @returns Hook state with mutate function, loading, error, and reset\n`;
	output += `   */\n`;
	output += `  const useDelete = (): ${interfaceName}MutationState => {\n`;
	output += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
	output += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

	output += `    const mutate = React.useCallback(async (id: ${primaryKey.type}): Promise<boolean> => {\n`;
	output += `      try {\n`;
	output += `        setLoading(true);\n`;
	output += `        setError(null);\n\n`;

	output = withDexie ?
		writeReactDeleteWithDexie(output, tableName, primaryKey) :
		writeReactDelete(output, tableName, primaryKey, false);

	output += `      } catch (err) {\n`;
	output += `        console.error(\`Error deleting ${interfaceName.toLowerCase()} \${id}:\`, err);\n`;
	output += `        const errorMessage = err instanceof Error ? err.message : 'Unknown error';\n`;
	output += `        setError(errorMessage);\n`;
	output += `        throw err;\n`;
	output += `      } finally {\n`;
	output += `        setLoading(false);\n`;
	output += `      }\n`;
	output += `    }, []);\n\n`;

	output += `    const reset = React.useCallback(() => {\n`;
	output += `      setError(null);\n`;
	output += `    }, []);\n\n`;

	output += `    return {\n`;
	output += `      mutate,\n`;
	output += `      loading,\n`;
	output += `      error,\n`;
	output += `      reset\n`;
	output += `    };\n`;
	output += `  };\n\n`;

	return output;
}

/**
 * Generate Angular delete method.
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
function writeAngularDeleteMethod(
	output: string,
	interfaceName: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	// Angular DELETE method
	output += `  /**\n`;
	output += `   * Delete an existing ${interfaceName.toLowerCase()} entity from the database.\n`;
	output += `   * \n`;
	output += `   * @param id - The primary key (${primaryKey.name}) of the entity to delete\n`;
	output += `   * @returns Promise resolving to true if the delete was successful, false otherwise\n`;
	output += `   */\n`;
	output += `  async delete(id: ${primaryKey.type}): Promise<boolean> {\n`;
	output += `    try {\n`;

	output = withDexie ?
		writeDeleteWithDexie(output, tableName, primaryKey) :
		writeDelete(output, tableName, primaryKey, false);

	output += `    } catch (error) {\n`;
	output += `      console.error(\`Error deleting ${interfaceName.toLowerCase()} \${id}:\`, error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generates React delete implementation with both SQLite and Dexie.js support.
 * 
 * @param output - Current output string
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactDeleteWithDexie(
	output: string,
	tableName: string,
	primaryKey: any
): string {
	output += `        if (databaseService.isNativeDatabase()) {\n`;
	output = writeReactDelete(output, tableName, primaryKey, true);

	output += `        } else {\n`;
	output += `          // Dexie implementation\n`;
	output += `          const dexie = databaseService.getDexieInstance();\n`;
	output += `          if (!dexie) throw new Error('Dexie database not initialized');\n`;
	output += `          \n`;
	output += `          await dexie.${tableName}.delete(id);\n`;
	output += `          return true;\n`;
	output += `        }\n`;

	return output;
}

/**
 * Generates React delete implementation for SQLite.
 * 
 * @param output - Current output string
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @param withDexie - Whether this is embedded in a Dexie conditional block
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactDelete(
	output: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	const indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	output += `${indent}      // SQLite implementation\n`;
	output += `${indent}      const result = await databaseService.executeCommand(\n`;
	output += `${indent}        'DELETE FROM ${tableName} WHERE ${primaryKey.name} = ?',\n`;
	output += `${indent}        [id]\n`;
	output += `${indent}      );\n`;
	output += `${indent}      \n`;
	output += `${indent}      return result.changes?.changes > 0;\n`;

	return output;
}

/**
 * Generates Angular delete implementation with both SQLite and Dexie.js support.
 * 
 * @param output - Current output string
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @returns Updated output string
 * 
 * @internal
 */
function writeDeleteWithDexie(
	output: string,
	tableName: string,
	primaryKey: any
): string {
	output += `      if (this.databaseService.isNativeDatabase()) {\n`;
	output = writeDelete(output, tableName, primaryKey, true);
	output += `      } else {\n`;
	output += `        // Dexie implementation\n`;
	output += `        const dexie = this.databaseService.getDexieInstance();\n`;
	output += `        if (!dexie) throw new Error('Dexie database not initialized');\n`;
	output += `        \n`;
	output += `        await dexie.${tableName}.delete(id);\n`;
	output += `        return true;\n`;
	output += `      }\n`;

	return output;
}

/**
 * Generates Angular delete implementation for SQLite.
 * 
 * @param output - Current output string
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @param withDexie - Whether this is embedded in a Dexie conditional block
 * @returns Updated output string
 * 
 * @internal
 */
function writeDelete(
	output: string,
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	let withDexieSpace = withDexie ? " ".repeat(2) : "";
	output += `${withDexieSpace}      // SQLite implementation\n`;
	output += `${withDexieSpace}      const result = await this.databaseService.executeCommand(\n`;
	output += `${withDexieSpace}        'DELETE FROM ${tableName} WHERE ${primaryKey.name} = ?',\n`;
	output += `${withDexieSpace}        [id]\n`;
	output += `${withDexieSpace}      );\n`;
	output += `${withDexieSpace}      \n`;
	output += `${withDexieSpace}      return result.changes?.changes > 0;\n`;

	return output;
}
