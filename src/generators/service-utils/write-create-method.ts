import * as utils from '../../utils'
import { TableDefinition } from "../../types";

export function writeCreateMethod(
    output: string,
    interfaceName: string,
    tableInterfaceName: string,
    fields: any[],
    tableName: string,
    tableInfo: TableDefinition,
    primaryKey: any,
    withDexie: boolean
) {
    // CREATE method
    output += `  /**\n`;
    output += `   * Create a new ${interfaceName.toLowerCase()}\n`;
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
        writeCreate(output, tableInterfaceName, fields, tableName, tableInfo, primaryKey, false)

    output += `    } catch (error) {\n`;
    output += `      console.error('Error creating ${interfaceName.toLowerCase()}:', error);\n`;
    output += `      throw error;\n`;
    output += `    }\n`;
    output += `  }\n\n`;

    return output;
}

function writeCreateWithDexie(
    output: string,
    tableInterfaceName: string,
    fields: any[],
    tableName: string,
    tableInfo: TableDefinition,
    primaryKey: any,
) {
    output += (`      if (this.databaseService.isNativeDatabase()) {\n`);
    output = writeCreate(output, tableInterfaceName, fields, tableName, tableInfo, primaryKey, true)

    output += (`      } else {\n`);
    output += (`        // Dexie implementation\n`);
    output += (`        const dexie = this.databaseService.getDexieInstance();\n`);
    output += (`        if (!dexie) throw new Error('Dexie database not initialized');\n\n`);

    output += (`        // Convert model to table format for storage\n`);
    output += (`        const tableRow: ${tableInterfaceName} = {\n`);

    // Generate table row mapping for Dexie - ONLY include valid fields
    fields.forEach(field => {
        if (utils.isValidFieldName(field.name)) { // Add this check
            if (field.name === field.camelCase) {
                output += (`          ${field.name}: entityToInsert.${field.camelCase}${(field.name === primaryKey.name && field.type === 'number') ? ' || 0' : ''},\n`);
            } else {
                output += (`          ${field.name}: entityToInsert.${field.camelCase},\n`);
            }
        }
    });

    output += (`        };\n\n`);
    output += (`        const id = await dexie.${tableName}.add(tableRow);\n`);
    output += (`        return id;\n`);
    output += (`      }\n`);

    return output
}
function writeCreate(
    output: string,
    tableInterfaceName: string,
    fields: any[],
    tableName: string,
    tableInfo: TableDefinition,
    primaryKey: any,
    withDexie: boolean
) {
    let withDexieSpace = withDexie ? " ".repeat(2) : "";
    output += `${withDexieSpace}      // Convert model to snake_case for SQL database\n`;
    output += `${withDexieSpace}      const tableRow: ${tableInterfaceName} = {\n`;

    // Generate table row mapping for SQLite - ONLY include valid fields
    fields.forEach(field => {
        if (utils.isValidFieldName(field.name)) { // Add this check
            if (field.name === field.camelCase) {
                output += `${withDexieSpace}        ${field.name}: entityToInsert.${field.camelCase}${(field.name === primaryKey.name && field.type === 'number') ? ' || 0' : ''},\n`;
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
        .filter(f => utils.isValidFieldName(f.name)) // Add this filter
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
