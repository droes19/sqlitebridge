/**
 * Service Generator - Write Update Method Module
 * 
 * This module generates TypeScript code for a database entity's update method
 * in both Angular services and React hooks. It supports dynamically building update queries 
 * based on the fields being updated and works with both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

import * as utils from '../../utils';
import { TableDefinition } from "../../types";
import { FrameworkType } from "../../config";

/**
 * Generates the TypeScript code for an UPDATE method in a service class or React hook.
 * 
 * This function creates a method that updates an existing entity in the database
 * based on its primary key. It handles conversions between camelCase model properties 
 * and snake_case database columns, and supports both SQLite and Dexie.js implementations.
 * The method only updates the fields that are provided in the updates parameter.
 * For React, it generates a mutation hook with state management. For Angular, it generates a service method.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableInterfaceName - Name of the table interface (PascalCase with "Table" suffix)
 * @param fields - Array of field objects with name, camelCase, and type properties
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object with name, camelCase, and type
 * @param withDexie - Whether to include Dexie.js implementation
 * @param framework - Target framework ('angular' | 'react')
 * @returns Updated output string with the UPDATE method added
 * 
 * @example
 * ```typescript
 * // Angular service method
 * let output = '';
 * output = writeUpdateMethod(
 *   output,
 *   'User',
 *   'UserTable',
 *   fields,
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true,
 *   'angular'
 * );
 * 
 * // React hook
 * output = writeUpdateMethod(
 *   output,
 *   'User',
 *   'UserTable',
 *   fields,
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true,
 *   'react'
 * );
 * ```
 */
export function writeUpdateMethod(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	primaryKey: any,
	withDexie: boolean,
	framework: FrameworkType
): string {
	if (framework === 'react') {
		return writeReactUpdateHook(
			output,
			interfaceName,
			tableInterfaceName,
			fields,
			tableName,
			primaryKey,
			withDexie
		);
	} else {
		return writeAngularUpdateMethod(
			output,
			interfaceName,
			tableInterfaceName,
			fields,
			tableName,
			primaryKey,
			withDexie
		);
	}
}

/**
 * Generate React update hook.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableInterfaceName - Table interface name
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactUpdateHook(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	// React UPDATE hook
	output += `  /**\n`;
	output += `   * React hook for updating an existing ${interfaceName.toLowerCase()} entity in the database.\n`;
	output += `   * Only the fields provided in the updates parameter will be modified.\n`;
	output += `   * The updatedAt field is automatically set to the current timestamp.\n`;
	output += `   * Returns mutation function, loading state, error state, and reset function.\n`;
	output += `   * \n`;
	output += `   * @returns Hook state with mutate function, loading, error, and reset\n`;
	output += `   */\n`;
	output += `  const useUpdate = (): ${interfaceName}MutationState => {\n`;
	output += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
	output += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

	output += `    const mutate = React.useCallback(async (id: ${primaryKey.type}, updates: Partial<${interfaceName}>): Promise<boolean> => {\n`;
	output += `      const now = new Date().toISOString();\n`;
	output += `      const updatedEntity = {\n`;
	output += `        ...updates,\n`;
	output += `        updatedAt: now\n`;
	output += `      };\n\n`;

	output += `      try {\n`;
	output += `        setLoading(true);\n`;
	output += `        setError(null);\n\n`;

	output = withDexie ?
		writeReactUpdateWithDexie(output, fields, tableName, primaryKey) :
		writeReactUpdate(output, fields, tableName, primaryKey, false);

	output += `      } catch (err) {\n`;
	output += `        console.error(\`Error updating ${interfaceName.toLowerCase()} \${id}:\`, err);\n`;
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
 * Generate Angular update method.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableInterfaceName - Table interface name
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeAngularUpdateMethod(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	// Angular UPDATE method
	output += `  /**\n`;
	output += `   * Updates an existing ${interfaceName.toLowerCase()} entity in the database.\n`;
	output += `   * Only the fields provided in the updates parameter will be modified.\n`;
	output += `   * The updatedAt field is automatically set to the current timestamp.\n`;
	output += `   * \n`;
	output += `   * @param id - The primary key (${primaryKey.name}) of the entity to update\n`;
	output += `   * @param updates - Partial object containing only the fields to update\n`;
	output += `   * @returns Promise resolving to true if the update was successful, false otherwise\n`;
	output += `   */\n`;
	output += `  async update(id: ${primaryKey.type}, updates: Partial<${interfaceName}>): Promise<boolean> {\n`;
	output += `    try {\n`;
	output += `      const now = new Date().toISOString();\n`;
	output += `      const updatedEntity = {\n`;
	output += `        ...updates,\n`;
	output += `        updatedAt: now\n`;
	output += `      };\n\n`;

	output = withDexie ?
		writeUpdateWithDexie(output, fields, tableName, primaryKey) :
		writeUpdate(output, fields, tableName, primaryKey, false);

	output += `    } catch (error) {\n`;
	output += `      console.error(\`Error updating ${interfaceName.toLowerCase()} \${id}:\`, error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generates React update implementation with both SQLite and Dexie.js support.
 * 
 * @param output - Current output string
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactUpdateWithDexie(
	output: string,
	fields: any[],
	tableName: string,
	primaryKey: any
): string {
	output += `        if (databaseService.isNativeDatabase()) {\n`;
	output = writeReactUpdate(output, fields, tableName, primaryKey, true);

	output += `        } else {\n`;
	output += `          // Dexie implementation\n`;
	output += `          const dexie = databaseService.getDexieInstance();\n`;
	output += `          if (!dexie) throw new Error('Dexie database not initialized');\n\n`;

	output += `          // Map of camelCase property names to database snake_case column names\n`;
	output += `          const fieldMappings: Record<string, string> = {\n`;

	// Create field mappings - ONLY include valid fields
	fields.forEach(field => {
		if (utils.isValidFieldName(field.name)) {
			output += `            ${field.camelCase}: '${field.name}',\n`;
		}
	});

	output += `          };\n\n`;

	output += `          // Transform to snake_case for consistent field names\n`;
	output += `          const dexieUpdates: any = {};\n`;
	output += `          for (const [key, value] of Object.entries(updatedEntity)) {\n`;
	output += `            if (key === '${primaryKey.camelCase}') continue; // Skip the ID\n\n`;
	output += `            // Get the snake_case column name or convert camelCase to snake_case\n`;
	output += `            const dbKey = fieldMappings[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();\n`;
	output += `            dexieUpdates[dbKey] = value;\n`;
	output += `          }\n\n`;

	output += `          // Update the record\n`;
	output += `          await dexie.${tableName}.update(id, dexieUpdates);\n`;
	output += `          return true;\n`;
	output += `        }\n`;

	return output;
}

/**
 * Generates React update implementation for SQLite.
 * 
 * @param output - Current output string
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param primaryKey - Primary key field
 * @param withDexie - Whether this is embedded in a Dexie conditional block
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactUpdate(
	output: string,
	fields: any[],
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	const indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	output += `${indent}      // Dynamically build the update query based on the provided fields\n`;
	output += `${indent}      const updateFields: string[] = [];\n`;
	output += `${indent}      const updateValues: any[] = [];\n\n`;

	output += `${indent}      // Map of camelCase property names to database snake_case column names\n`;
	output += `${indent}      const fieldMappings: Record<string, string> = {\n`;

	// Create field mappings - ONLY include valid fields
	fields.forEach(field => {
		if (utils.isValidFieldName(field.name)) {
			output += `${indent}        ${field.camelCase}: '${field.name}',\n`;
		}
	});

	output += `${indent}      };\n\n`;

	output += `${indent}      for (const [key, value] of Object.entries(updatedEntity)) {\n`;
	output += `${indent}        if (key === '${primaryKey.camelCase}') continue; // Skip the ID field\n\n`;
	output += `${indent}        // Get the snake_case column name or convert camelCase to snake_case\n`;
	output += `${indent}        const sqlKey = fieldMappings[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();\n`;
	output += `${indent}        updateFields.push(\`\${sqlKey} = ?\`);\n`;
	output += `${indent}        updateValues.push(value);\n`;
	output += `${indent}      }\n\n`;

	output += `${indent}      if (updateFields.length === 0) {\n`;
	output += `${indent}        throw new Error('No fields to update');\n`;
	output += `${indent}      }\n\n`;

	output += `${indent}      // Add the WHERE clause parameter\n`;
	output += `${indent}      updateValues.push(id);\n\n`;

	output += `${indent}      // Execute the update query\n`;
	output += `${indent}      const result = await databaseService.executeCommand(\n`;
	output += `${indent}        \`UPDATE ${tableName} SET \${updateFields.join(', ')} WHERE ${primaryKey.name} = ?\`,\n`;
	output += `${indent}        updateValues\n`;
	output += `${indent}      );\n\n`;

	output += `${indent}      return result.changes?.changes > 0;\n`;

	return output;
}

/**
 * Generates Angular update implementation with both SQLite and Dexie.js support.
 * 
 * This function creates a method implementation that first checks if the device is using
 * a native database (SQLite) or a web database (Dexie.js), and then calls the appropriate
 * implementation.
 * 
 * @param output - Current output string to append to
 * @param fields - Array of field objects
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object
 * @returns Updated output string with the Dexie-aware implementation
 * 
 * @internal
 */
function writeUpdateWithDexie(
	output: string,
	fields: any[],
	tableName: string,
	primaryKey: any
): string {
	output += `      if (this.databaseService.isNativeDatabase()) {\n`;
	output = writeUpdate(output, fields, tableName, primaryKey, true);
	output += `      } else {\n`;
	output += `        // Dexie implementation\n`;
	output += `        const dexie = this.databaseService.getDexieInstance();\n`;
	output += `        if (!dexie) throw new Error('Dexie database not initialized');\n\n`;

	output += `        // Map of camelCase property names to database snake_case column names\n`;
	output += `        const fieldMappings: Record<string, string> = {\n`;

	// Create field mappings - ONLY include valid fields
	fields.forEach(field => {
		if (utils.isValidFieldName(field.name)) {
			output += `          ${field.camelCase}: '${field.name}',\n`;
		}
	});

	output += `        };\n\n`;

	output += `        // Transform to snake_case for consistent field names\n`;
	output += `        const dexieUpdates: any = {};\n`;
	output += `        for (const [key, value] of Object.entries(updatedEntity)) {\n`;
	output += `          if (key === '${primaryKey.camelCase}') continue; // Skip the ID\n\n`;
	output += `          // Get the snake_case column name or convert camelCase to snake_case\n`;
	output += `          const dbKey = fieldMappings[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();\n`;
	output += `          dexieUpdates[dbKey] = value;\n`;
	output += `        }\n\n`;

	output += `        // Update the record\n`;
	output += `        await dexie.${tableName}.update(id, dexieUpdates);\n`;
	output += `        return true;\n`;
	output += `      }\n`;

	return output;
}

/**
 * Generates Angular update implementation for SQLite.
 * 
 * This function creates a method implementation that dynamically builds an SQL UPDATE
 * statement based on the fields provided in the updates parameter. It converts camelCase
 * property names to snake_case column names and handles the parameter binding.
 * 
 * @param output - Current output string to append to
 * @param fields - Array of field objects
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object
 * @param withDexie - Whether this is embedded in a Dexie.js conditional block (affects indentation)
 * @returns Updated output string with the SQLite implementation
 * 
 * @internal
 */
function writeUpdate(
	output: string,
	fields: any[],
	tableName: string,
	primaryKey: any,
	withDexie: boolean
): string {
	let withDexieSpace = withDexie ? " ".repeat(2) : "";
	output += `${withDexieSpace}      // Dynamically build the update query based on the provided fields\n`;
	output += `${withDexieSpace}      const updateFields: string[] = [];\n`;
	output += `${withDexieSpace}      const updateValues: any[] = [];\n\n`;

	output += `${withDexieSpace}      // Map of camelCase property names to database snake_case column names\n`;
	output += `${withDexieSpace}      const fieldMappings: Record<string, string> = {\n`;

	// Create field mappings - ONLY include valid fields
	fields.forEach(field => {
		if (utils.isValidFieldName(field.name)) {
			output += `${withDexieSpace}        ${field.camelCase}: '${field.name}',\n`;
		}
	});

	output += `${withDexieSpace}      };\n\n`;

	output += `${withDexieSpace}      for (const [key, value] of Object.entries(updatedEntity)) {\n`;
	output += `${withDexieSpace}        if (key === '${primaryKey.camelCase}') continue; // Skip the ID field\n\n`;
	output += `${withDexieSpace}        // Get the snake_case column name or convert camelCase to snake_case\n`;
	output += `${withDexieSpace}        const sqlKey = fieldMappings[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase();\n`;
	output += `${withDexieSpace}        updateFields.push(\`\${sqlKey} = ?\`);\n`;
	output += `${withDexieSpace}        updateValues.push(value);\n`;
	output += `${withDexieSpace}      }\n\n`;

	output += `${withDexieSpace}      if (updateFields.length === 0) {\n`;
	output += `${withDexieSpace}        throw new Error('No fields to update');\n`;
	output += `${withDexieSpace}      }\n\n`;

	output += `${withDexieSpace}      // Add the WHERE clause parameter\n`;
	output += `${withDexieSpace}      updateValues.push(id);\n\n`;

	output += `${withDexieSpace}      // Execute the update query\n`;
	output += `${withDexieSpace}      const result = await this.databaseService.executeCommand(\n`;
	output += `${withDexieSpace}        \`UPDATE ${tableName} SET \${updateFields.join(', ')} WHERE ${primaryKey.name} = ?\`,\n`;
	output += `${withDexieSpace}        updateValues\n`;
	output += `${withDexieSpace}      );\n\n`;

	output += `${withDexieSpace}      return result.changes?.changes > 0;\n`;

	return output;
}
