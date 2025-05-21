export function writeGetByIdMethod(
    output: string,
    interfaceName: string,
    tableName: string,
    primaryKey: any,
    withDexie: boolean
) {

    // GET BY ID method
    output += `  /**\n`;
    output += `   * Get ${interfaceName.toLowerCase()} by ID\n`;
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

function writeGetByIdWithDexie(
    output: string,
    tableName: string,
    primaryKey: any,
) {
    output += `      if (this.databaseService.isNativeDatabase()) {\n`;
    output = writeGetById(output, tableName, primaryKey, true)
    output += `      } else {\n`;
    output += `        // Dexie implementation\n`;
    output += `        const dexie = this.databaseService.getDexieInstance();\n`;
    output += `        if (!dexie) throw new Error('Dexie database not initialized');\n`;
    output += `        \n`;
    output += `        const entity = await dexie.${tableName}.get(id);\n`;
    output += `        return entity ? this.mapTableToModel(entity) : null;\n`;
    output += `      }\n`;
    return output
}
function writeGetById(
    output: string,
    tableName: string,
    primaryKey: any,
    withDexie: boolean
) {
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
    return output
}
