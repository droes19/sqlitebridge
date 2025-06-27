/**
 * Service Generator - Write Create Method Module
 * 
 * This module generates the TypeScript code for a database entity's create method
 * in Angular services. It supports both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

import * as utils from '../../utils';
import { TableDefinition } from "../../types";

/**
 * Generates the TypeScript code for a CREATE method in a service class.
 * 
 * This function creates a method that inserts a new entity into the database
 * table. It handles conversions between camelCase model properties and snake_case
 * database columns, and supports both SQLite and Dexie.js implementations.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableInterfaceName - Name of the table interface (PascalCase with "Table" suffix)
 * @param fields - Array of field objects with name, camelCase, and type properties
 * @param tableName - Name of the database table
 * @param tableInfo - Table definition with columns and constraints
 * @param primaryKey - Primary key field object with name, camelCase, and type
 * @param withDexie - Whether to include Dexie.js implementation
 * @returns Updated output string with the CREATE method added
 * 
 * @example
 * ```typescript
 * let output = '';
 * output = writeCreateMethod(
 *   output,
 *   'User',
 *   'UserTable',
 *   fields,
 *   'users',
 *   tableInfo,
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true
 * );
 * // Returns TypeScript code for create method with both SQLite and Dexie implementations
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
	withDexie: boolean
): string {
	// CREATE method
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
 * Generates code for a CREATE method that supports both SQLite and Dexie.js.
 * 
 * This function creates a method implementation that first checks if the device is using
 * a native database (SQLite) or a web database (Dexie.js), and then calls the appropriate
 * implementation.
 * 
 * @param output - Current output string to append to
 * @param tableInterfaceName - Name of the table interface
 * @param fields - Array of field objects
 * @param tableName - Name of the database table
 * @param tableInfo - Table definition
 * @param primaryKey - Primary key field object
 * @returns Updated output string with the Dexie-aware implementation
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
 * Generates code for a CREATE method for SQLite.
 * 
 * This function creates a method implementation that converts a TypeScript model
 * object to a database row and inserts it into the SQLite database.
 * 
 * @param output - Current output string to append to
 * @param tableInterfaceName - Name of the table interface
 * @param fields - Array of field objects
 * @param tableName - Name of the database table
 * @param tableInfo - Table definition
 * @param primaryKey - Primary key field object
 * @param withDexie - Whether this is embedded in a Dexie.js conditional block (affects indentation)
 * @returns Updated output string with the SQLite implementation
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
