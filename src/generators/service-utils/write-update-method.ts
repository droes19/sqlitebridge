/**
 * Service Generator - Write Update Method Module
 * 
 * This module generates TypeScript code for a database entity's update method
 * in Angular services. It supports dynamically building update queries based on
 * the fields being updated and works with both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

import * as utils from '../../utils';

/**
 * Generates the TypeScript code for an UPDATE method in a service class.
 * 
 * This function creates a method that updates an existing entity in the database
 * based on its primary key. It handles conversions between camelCase model properties 
 * and snake_case database columns, and supports both SQLite and Dexie.js implementations.
 * The method only updates the fields that are provided in the updates parameter.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableInterfaceName - Name of the table interface (PascalCase with "Table" suffix)
 * @param fields - Array of field objects with name, camelCase, and type properties
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object with name, camelCase, and type
 * @param withDexie - Whether to include Dexie.js implementation
 * @returns Updated output string with the UPDATE method added
 * 
 * @example
 * ```typescript
 * let output = '';
 * output = writeUpdateMethod(
 *   output,
 *   'User',
 *   'UserTable',
 *   fields,
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true
 * );
 * // Returns TypeScript code for update method with both SQLite and Dexie implementations
 * ```
 */
export function writeUpdateMethod(
    output: string,
    interfaceName: string,
    tableInterfaceName: string,
    fields: any[],
    tableName: string,
    primaryKey: any,
    withDexie: boolean
): string {
    // UPDATE method
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
 * Generates code for an UPDATE method that supports both SQLite and Dexie.js.
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
 * Generates code for an UPDATE method for SQLite.
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