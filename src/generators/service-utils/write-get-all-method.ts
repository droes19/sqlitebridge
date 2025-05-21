/**
 * Service Generator - Write GetAll Method Module
 * 
 * This module generates TypeScript code for a database entity's getAll method
 * in Angular services. It retrieves all entities of a particular type from the
 * database and supports both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

/**
 * Generates the TypeScript code for a getAll method in a service class.
 * 
 * This function creates a method that retrieves all entities from a database table
 * and maps them to their TypeScript model representations. It supports both
 * SQLite and Dexie.js implementations.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableInterfaceName - Name of the table interface (PascalCase with "Table" suffix)
 * @param tableName - Name of the database table
 * @param withDexie - Whether to include Dexie.js implementation
 * @returns Updated output string with the getAll method added
 * 
 * @example
 * ```typescript
 * let output = '';
 * output = writeGetAllMethod(
 *   output,
 *   'User',
 *   'UserTable',
 *   'users',
 *   true
 * );
 * // Returns TypeScript code for getAll method with both SQLite and Dexie implementations
 * ```
 */
export function writeGetAllMethod(
    output: string,
    interfaceName: string,
    tableInterfaceName: string,
    tableName: string,
    withDexie: boolean
): string {
    // GET ALL method
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
 * Generates code for a getAll method that supports both SQLite and Dexie.js.
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
 * Generates code for a getAll method for SQLite.
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