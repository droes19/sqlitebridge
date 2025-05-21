/**
 * Service Generator - Write Delete Method Module
 * 
 * This module generates TypeScript code for a database entity's delete method
 * in Angular services. It supports both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

/**
 * Generates the TypeScript code for a DELETE method in a service class.
 * 
 * This function creates a method that deletes an entity from the database table
 * based on its primary key. It supports both SQLite and Dexie.js implementations.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object with name, camelCase, and type
 * @param withDexie - Whether to include Dexie.js implementation
 * @returns Updated output string with the DELETE method added
 * 
 * @example
 * ```typescript
 * let output = '';
 * output = writeDeleteMethod(
 *   output,
 *   'User',
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true
 * );
 * // Returns TypeScript code for delete method with both SQLite and Dexie implementations
 * ```
 */
export function writeDeleteMethod(
    output: string,
    interfaceName: string,
    tableName: string,
    primaryKey: any,
    withDexie: boolean
): string {
    // DELETE method
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
 * Generates code for a DELETE method that supports both SQLite and Dexie.js.
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
 * Generates code for a DELETE method for SQLite.
 * 
 * This function creates a method implementation that deletes a row from the 
 * SQLite database based on its primary key.
 * 
 * @param output - Current output string to append to
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object
 * @param withDexie - Whether this is embedded in a Dexie.js conditional block (affects indentation)
 * @returns Updated output string with the SQLite implementation
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
