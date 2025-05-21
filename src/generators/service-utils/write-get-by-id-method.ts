/**
 * Service Generator - Write GetById Method Module
 * 
 * This module generates TypeScript code for a database entity's getById method
 * in Angular services. It retrieves a single entity by its primary key and
 * supports both SQLite and Dexie.js implementations.
 * 
 * @packageDocumentation
 */

/**
 * Generates the TypeScript code for a getById method in a service class.
 * 
 * This function creates a method that retrieves a single entity from a database table
 * based on its primary key and maps it to its TypeScript model representation.
 * It supports both SQLite and Dexie.js implementations.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableName - Name of the database table
 * @param primaryKey - Primary key field object with name, camelCase, and type
 * @param withDexie - Whether to include Dexie.js implementation
 * @returns Updated output string with the getById method added
 * 
 * @example
 * ```typescript
 * let output = '';
 * output = writeGetByIdMethod(
 *   output,
 *   'User',
 *   'users',
 *   { name: 'id', camelCase: 'id', type: 'number' },
 *   true
 * );
 * // Returns TypeScript code for getById method with both SQLite and Dexie implementations
 * ```
 */
export function writeGetByIdMethod(
    output: string,
    interfaceName: string,
    tableName: string,
    primaryKey: any,
    withDexie: boolean
): string {
    // GET BY ID method
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
 * Generates code for a getById method that supports both SQLite and Dexie.js.
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
 * Generates code for a getById method for SQLite.
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