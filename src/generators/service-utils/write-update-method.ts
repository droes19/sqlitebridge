import * as utils from '../../utils'

export function writeUpdateMethod(
    output: string,
    interfaceName: string,
    tableInterfaceName: string,
    fields: any[],
    tableName: string,
    primaryKey: any,
    withDexie: boolean
) {

    // UPDATE method
    output += `  /**\n`;
    output += `   * Update ${interfaceName.toLowerCase()}\n`;
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
        writeUpdate(output, fields, tableName, primaryKey, false)

    output += `    } catch (error) {\n`;
    output += `      console.error(\`Error updating ${interfaceName.toLowerCase()} \${id}:\`, error);\n`;
    output += `      throw error;\n`;
    output += `    }\n`;
    output += `  }\n\n`;
    return output;
}

function writeUpdateWithDexie(
    output: string,
    fields: any[],
    tableName: string,
    primaryKey: any,
) {
    output += `      if (this.databaseService.isNativeDatabase()) {\n`;
    output = writeUpdate(output, fields, tableName, primaryKey, true)
    output += `      } else {\n`;
    output += `        // Dexie implementation\n`;
    output += `        const dexie = this.databaseService.getDexieInstance();\n`;
    output += `        if (!dexie) throw new Error('Dexie database not initialized');\n\n`;

    output += `        // Map of camelCase property names to database snake_case column names\n`;
    output += `        const fieldMappings: Record<string, string> = {\n`;

    // Create field mappings - ONLY include valid fields
    fields.forEach(field => {
        if (utils.isValidFieldName(field.name)) { // Add this check
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

    return output
}

function writeUpdate(
    output: string,
    fields: any[],
    tableName: string,
    primaryKey: any,
    withDexie: boolean
) {
    let withDexieSpace = withDexie ? " ".repeat(2) : "";
    output += `${withDexieSpace}      // Dynamically build the update query based on the provided fields\n`;
    output += `${withDexieSpace}      const updateFields: string[] = [];\n`;
    output += `${withDexieSpace}      const updateValues: any[] = [];\n\n`;

    output += `${withDexieSpace}      // Map of camelCase property names to database snake_case column names\n`;
    output += `${withDexieSpace}      const fieldMappings: Record<string, string> = {\n`;

    // Create field mappings - ONLY include valid fields
    fields.forEach(field => {
        if (utils.isValidFieldName(field.name)) { // Add this check
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
    return output
}
