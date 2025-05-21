import * as utils from '../../utils'

export function writeDeleteMethod(
    output: string,
    interfaceName: string,
    tableName: string,
    primaryKey: any,
    withDexie: boolean
) {

    // DELETE method
    output += `  /**\n`;
    output += `   * Delete ${interfaceName.toLowerCase()}\n`;
    output += `   */\n`;
    output += `  async delete(id: ${primaryKey.type}): Promise<boolean> {\n`;
    output += `    try {\n`;
    output = withDexie ?
        writeDeleteWithDexie(output, tableName, primaryKey) :
        writeDelete(output, tableName, primaryKey, false)
    output += `    } catch (error) {\n`;
    output += `      console.error(\`Error deleting ${interfaceName.toLowerCase()} \${id}:\`, error);\n`;
    output += `      throw error;\n`;
    output += `    }\n`;
    output += `  }\n\n`;
    return output;
}

function writeDeleteWithDexie(
    output: string,
    tableName: string,
    primaryKey: any,
) {
    output += `      if (this.databaseService.isNativeDatabase()) {\n`;
    output = writeDelete(output, tableName, primaryKey, true)
    output += `      } else {\n`;
    output += `        // Dexie implementation\n`;
    output += `        const dexie = this.databaseService.getDexieInstance();\n`;
    output += `        if (!dexie) throw new Error('Dexie database not initialized');\n`;
    output += `        \n`;
    output += `        await dexie.${tableName}.delete(id);\n`;
    output += `        return true;\n`;
    output += `      }\n`;

    return output
}

function writeDelete(
    output: string,
    tableName: string,
    primaryKey: any,
    withDexie: boolean
) {
    let withDexieSpace = withDexie ? " ".repeat(2) : "";
    output += `${withDexieSpace}      // SQLite implementation\n`;
    output += `${withDexieSpace}      const result = await this.databaseService.executeCommand(\n`;
    output += `${withDexieSpace}        'DELETE FROM ${tableName} WHERE ${primaryKey.name} = ?',\n`;
    output += `${withDexieSpace}        [id]\n`;
    output += `${withDexieSpace}      );\n`;
    output += `${withDexieSpace}      \n`;
    output += `${withDexieSpace}      return result.changes?.changes > 0;\n`;
    return output
}
