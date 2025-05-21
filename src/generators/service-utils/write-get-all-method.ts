export function writeGetAllMethod(
    output: string,
    interfaceName: string,
    tableInterfaceName: string,
    tableName: string,
    withDexie: boolean
) {

    // GET ALL method
    output += `  /**\n`;
    output += `   * Get all ${tableName}\n`;
    output += `   */\n`;
    output += `  async getAll(): Promise<${interfaceName}[]> {\n`;
    output += `    try {\n`;
    output = withDexie ?
        writeGetAllWithDexie(output, tableInterfaceName, tableName) :
        writeGetAll(output, tableInterfaceName, tableName, false)
    output += `    } catch (error) {\n`;
    output += `      console.error('Error getting all ${tableName}:', error);\n`;
    output += `      throw error;\n`;
    output += `    }\n`;
    output += `  }\n\n`;
    return output;
}

function writeGetAllWithDexie(
    output: string,
    tableInterfaceName: string,
    tableName: string,
) {
    output += `      if (this.databaseService.isNativeDatabase()) {\n`;
    output = writeGetAll(output, tableInterfaceName, tableName, true)
    output += `      } else {\n`;
    output += `        // Dexie implementation\n`;
    output += `        const dexie = this.databaseService.getDexieInstance();\n`;
    output += `        if (!dexie) throw new Error('Dexie database not initialized');\n`;
    output += `        \n`;
    output += `        const entities = await dexie.${tableName}.toArray();\n`;
    output += `        return entities.map((entity: ${tableInterfaceName}) => this.mapTableToModel(entity));\n`;
    output += `      }\n`;
    return output
}

function writeGetAll(
    output: string,
    tableInterfaceName: string,
    tableName: string,
    withDexie: boolean
) {
    let withDexieSpace = withDexie ? " ".repeat(2) : "";
    output += `${withDexieSpace}      // SQLite implementation\n`;
    output += `${withDexieSpace}      const result = await this.databaseService.executeQuery('SELECT * FROM ${tableName}');\n`;
    output += `${withDexieSpace}      \n`;
    output += `${withDexieSpace}      if (result.values && result.values.length > 0) {\n`;
    output += `${withDexieSpace}        return result.values.map((entity: ${tableInterfaceName}) => this.mapTableToModel(entity));\n`;
    output += `${withDexieSpace}      }\n`;
    output += `${withDexieSpace}      return [];\n`;
    return output
}
