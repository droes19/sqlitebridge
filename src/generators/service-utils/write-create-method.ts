/**
 * Service Generator - Write Create Method Module
 * 
 * This module generates the TypeScript code for a database entity's create method
 * in both Angular services and React hooks. It supports both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

import * as utils from '../../utils';
import { TableDefinition } from "../../types";
import { FrameworkType } from "../../config";

/**
 * Generates the TypeScript code for a CREATE method in a service class or React hook.
 * 
 * This function creates a method that inserts a new entity into the database
 * table. It handles conversions between camelCase model properties and snake_case
 * database columns, and supports both SQLite and Dexie.js implementations.
 * For React, it generates a hook with state management. For Angular, it generates a service method.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableInterfaceName - Name of the table interface (PascalCase with "Table" suffix)
 * @param fields - Array of field objects with name, camelCase, and type properties
 * @param tableName - Name of the database table
 * @param tableInfo - Table definition with columns and constraints
 * @param primaryKey - Primary key field object with name, camelCase, and type
 * @param withDexie - Whether to include Dexie.js implementation
 * @param framework - Target framework ('angular' | 'react')
 * @returns Updated output string with the CREATE method added
 * 
 * @example
 * ```typescript
 * // Angular service method
 * let output = '';
 * output = writeCreateMethod(
 *   output,
 *   'User',
 *   'UserTable',
 *   fields,
 *   'users',
 *   tableInfo,
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true,
 *   'angular'
 * );
 * 
 * // React hook
 * output = writeCreateMethod(
 *   output,
 *   'User',
 *   'UserTable',
 *   fields,
 *   'users',
 *   tableInfo,
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true,
 *   'react'
 * );
 * ```
 */
export function writeCreateMethod(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	tableInfo: TableDefinition,
	primaryKey: any,
	withDexie: boolean,
	framework: FrameworkType
): string {
	if (framework === 'react') {
		return writeReactCreateHook(
			output,
			interfaceName,
			tableInterfaceName,
			fields,
			tableName,
			tableInfo,
			primaryKey,
			withDexie
		);
	} else {
		return writeAngularCreateMethod(
			output,
			interfaceName,
			tableInterfaceName,
			fields,
			tableName,
			tableInfo,
			primaryKey,
			withDexie
		);
	}
}

/**
 * Generate React create hook.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableInterfaceName - Table interface name
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param tableInfo - Table definition
 * @param primaryKey - Primary key field
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactCreateHook(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	tableInfo: TableDefinition,
	primaryKey: any,
	withDexie: boolean
): string {
	// React CREATE hook
	output += `  /**\n`;
	output += `   * React hook for creating a new ${interfaceName.toLowerCase()} entity in the database.\n`;
	output += `   * Returns mutation function, loading state, error state, and reset function.\n`;
	output += `   * \n`;
	output += `   * @returns Hook state with mutate function, loading, error, and reset\n`;
	output += `   */\n`;
	output += `  const useCreate = (): ${interfaceName}MutationState => {\n`;
	output += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
	output += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

	output += `    const mutate = React.useCallback(async (${interfaceName.toLowerCase()}: ${interfaceName}): Promise<${primaryKey.type} | undefined> => {\n`;
	output += `      const now = new Date().toISOString();\n`;
	output += `      const entityToInsert = {\n`;
	output += `        ...${interfaceName.toLowerCase()},\n`;
	output += `        createdAt: now,\n`;
	output += `        updatedAt: now\n`;
	output += `      };\n\n`;

	output += `      try {\n`;
	output += `        setLoading(true);\n`;
	output += `        setError(null);\n\n`;

	output = withDexie ?
		writeReactCreateWithDexie(output, tableInterfaceName, fields, tableName, tableInfo, primaryKey) :
		writeReactCreate(output, tableInterfaceName, fields, tableName, tableInfo, primaryKey, false);

	output += `      } catch (err) {\n`;
	output += `        console.error('Error creating ${interfaceName.toLowerCase()}:', err);\n`;
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
 * Generate Angular create method.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableInterfaceName - Table interface name
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param tableInfo - Table definition
 * @param primaryKey - Primary key field
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeAngularCreateMethod(
	output: string,
	interfaceName: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	tableInfo: TableDefinition,
	primaryKey: any,
	withDexie: boolean
): string {
	// Angular CREATE method
	output += `  /**\n`;
	output += `   * Create a new ${interfaceName.toLowerCase()} entity in the database.\n`;
	output += `   * \n`;
	output += `   * @param ${interfaceName.toLowerCase()} - The entity to create\n`;
	output += `   * @returns Promise resolving to the ID of the created entity or undefined on failure\n`;
	output += `   */\n`;
	output += `  async create(${interfaceName.toLowerCase()}: ${interfaceName}): Promise<${primaryKey.type} | undefined> {\n`;
	output += `    const now = new Date().toISOString();\n`;
	output += `    const entityToInsert = {\n`;
	output += `      ...${interfaceName.toLowerCase()},\n`;
	output += `      createdAt: now,\n`;
	output += `      updatedAt: now\n`;
	output += `    };\n\n`;

	output += `    try {\n`;

	output = withDexie ?
		writeCreateWithDexie(output, tableInterfaceName, fields, tableName, tableInfo, primaryKey) :
		writeCreate(output, tableInterfaceName, fields, tableName, tableInfo, primaryKey, false);

	output += `    } catch (error) {\n`;
	output += `      console.error('Error creating ${interfaceName.toLowerCase()}:', error);\n`;
	output += `      throw error;\n`;
	output += `    }\n`;
	output += `  }\n\n`;

	return output;
}

/**
 * Generates React create implementation with both SQLite and Dexie.js support.
 * 
 * @param output - Current output string
 * @param tableInterfaceName - Table interface name
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param tableInfo - Table definition
 * @param primaryKey - Primary key field
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactCreateWithDexie(
	output: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	tableInfo: TableDefinition,
	primaryKey: any,
): string {
	output += `        if (databaseService.isNativeDatabase()) {\n`;
	output = writeReactCreate(output, tableInterfaceName, fields, tableName, tableInfo, primaryKey, true);

	output += `        } else {\n`;
	output += `          // Dexie implementation\n`;
	output += `          const dexie = databaseService.getDexieInstance();\n`;
	output += `          if (!dexie) throw new Error('Dexie database not initialized');\n\n`;

	output += `          // Convert model to table format for storage\n`;
	output += `          const tableRow: ${tableInterfaceName} = {\n`;

	// Generate table row mapping for Dexie - ONLY include valid fields
	fields.forEach(field => {
		if (utils.isValidFieldName(field.name)) {
			if (field.name === field.camelCase) {
				output += `            ${field.name}: ${field.name === primaryKey.name ? 'undefined' : `entityToInsert.${field.camelCase}`},\n`;
			} else {
				output += `            ${field.name}: entityToInsert.${field.camelCase},\n`;
			}
		}
	});

	output += `          };\n\n`;
	output += `          const id = await dexie.${tableName}.add(tableRow);\n`;
	output += `          return id as ${primaryKey.type};\n`;
	output += `        }\n`;

	return output;
}

/**
 * Generates React create implementation for SQLite.
 * 
 * @param output - Current output string
 * @param tableInterfaceName - Table interface name
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param tableInfo - Table definition
 * @param primaryKey - Primary key field
 * @param withDexie - Whether this is embedded in a Dexie conditional block
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactCreate(
	output: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	tableInfo: TableDefinition,
	primaryKey: any,
	withDexie: boolean
): string {
	let indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	output += `${indent}      // Convert model to snake_case for SQL database\n`;
	output += `${indent}      const tableRow: ${tableInterfaceName} = {\n`;

	// Generate table row mapping for SQLite - ONLY include valid fields
	fields.forEach(field => {
		if (utils.isValidFieldName(field.name)) {
			if (field.name === field.camelCase) {
				output += `${indent}        ${field.name}: ${field.name === primaryKey.name ? 'undefined' : `entityToInsert.${field.camelCase}`},\n`;
			} else {
				output += `${indent}        ${field.name}: entityToInsert.${field.camelCase},\n`;
			}
		}
	});

	output += `${indent}      };\n\n`;
	output += `${indent}      // SQLite implementation\n`;
	output += `${indent}      const result = await databaseService.executeCommand(\n`;
	output += `${indent}        \`INSERT INTO ${tableName} (\n`;

	// Generate insert fields (skipping primary key if auto-increment and invalid fields)
	const insertFields = fields
		.filter(f => utils.isValidFieldName(f.name))
		.filter(f => !f.isPrimaryKey || !tableInfo.columns.find(col => col.name === f.name)?.isAutoIncrement);

	output += insertFields.map(f => `${indent}          ${f.name}`).join(',\n');
	output += `\n${indent}        ) VALUES (${insertFields.map(() => '?').join(', ')})\`,\n`;
	output += `${indent}        [\n`;

	// Generate values array
	insertFields.forEach((field, index) => {
		const isLast = index === insertFields.length - 1;
		const nullCheck = field.isNullable ? ` || null` : '';
		output += `${indent}          tableRow.${field.name}${nullCheck}${isLast ? '' : ','}\n`;
	});

	output += `${indent}        ]\n`;
	output += `${indent}      );\n\n`;
	output += `${indent}      return result.changes?.lastId as ${primaryKey.type};\n`;

	return output;
}

/**
 * Generates Angular create implementation with both SQLite and Dexie.js support.
 * 
 * @param output - Current output string
 * @param tableInterfaceName - Table interface name
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param tableInfo - Table definition
 * @param primaryKey - Primary key field
 * @returns Updated output string
 * 
 * @internal
 */
function writeCreateWithDexie(
	output: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	tableInfo: TableDefinition,
	primaryKey: any,
): string {
	output += (`      if (this.databaseService.isNativeDatabase()) {\n`);
	output = writeCreate(output, tableInterfaceName, fields, tableName, tableInfo, primaryKey, true);

	output += (`      } else {\n`);
	output += (`        // Dexie implementation\n`);
	output += (`        const dexie = this.databaseService.getDexieInstance();\n`);
	output += (`        if (!dexie) throw new Error('Dexie database not initialized');\n\n`);

	output += (`        // Convert model to table format for storage\n`);
	output += (`        const tableRow: ${tableInterfaceName} = {\n`);

	// Generate table row mapping for Dexie - ONLY include valid fields
	fields.forEach(field => {
		if (utils.isValidFieldName(field.name)) {
			if (field.name === field.camelCase) {
				output += (`          ${field.name}: ${field.name === primaryKey.name ? 'undefined' : `entityToInsert.${field.camelCase}`},\n`);
			} else {
				output += (`          ${field.name}: entityToInsert.${field.camelCase},\n`);
			}
		}
	});

	output += (`        };\n\n`);
	output += (`        const id = await dexie.${tableName}.add(tableRow);\n`);
	output += (`        return id;\n`);
	output += (`      }\n`);

	return output;
}

/**
 * Generates Angular create implementation for SQLite.
 * 
 * @param output - Current output string
 * @param tableInterfaceName - Table interface name
 * @param fields - Field definitions
 * @param tableName - Table name
 * @param tableInfo - Table definition
 * @param primaryKey - Primary key field
 * @param withDexie - Whether this is embedded in a Dexie conditional block
 * @returns Updated output string
 * 
 * @internal
 */
function writeCreate(
	output: string,
	tableInterfaceName: string,
	fields: any[],
	tableName: string,
	tableInfo: TableDefinition,
	primaryKey: any,
	withDexie: boolean
): string {
	let withDexieSpace = withDexie ? " ".repeat(2) : "";
	output += `${withDexieSpace}      // Convert model to snake_case for SQL database\n`;
	output += `${withDexieSpace}      const tableRow: ${tableInterfaceName} = {\n`;

	// Generate table row mapping for SQLite - ONLY include valid fields
	fields.forEach(field => {
		if (utils.isValidFieldName(field.name)) {
			if (field.name === field.camelCase) {
				output += `${withDexieSpace}        ${field.name}: ${field.name === primaryKey.name ? 'undefined' : `entityToInsert.${field.camelCase}`},\n`;
			} else {
				output += `${withDexieSpace}        ${field.name}: entityToInsert.${field.camelCase},\n`;
			}
		}
	});

	output += `${withDexieSpace}      };\n\n`;
	output += `${withDexieSpace}      // SQLite implementation\n`;
	output += `${withDexieSpace}      const result = await this.databaseService.executeCommand(\n`;
	output += `${withDexieSpace}        \`INSERT INTO ${tableName} (\n`;

	// Generate insert fields (skipping primary key if auto-increment and invalid fields)
	const insertFields = fields
		.filter(f => utils.isValidFieldName(f.name))
		.filter(f => !f.isPrimaryKey || !tableInfo.columns.find(col => col.name === f.name)?.isAutoIncrement);

	output += insertFields.map(f => `${withDexieSpace}          ${f.name}`).join(',\n');
	output += `\n${withDexieSpace}        ) VALUES (${insertFields.map(() => '?').join(', ')})\`,\n`;
	output += `${withDexieSpace}        [\n`;

	// Generate values array
	insertFields.forEach((field, index) => {
		const isLast = index === insertFields.length - 1;
		const nullCheck = field.isNullable ? ` || null` : '';
		output += `${withDexieSpace}          tableRow.${field.name}${nullCheck}${isLast ? '' : ','}\n`;
	});

	output += `${withDexieSpace}        ]\n`;
	output += `${withDexieSpace}      );\n\n`;
	output += `${withDexieSpace}      return result.changes?.lastId;\n`;

	return output;
}
