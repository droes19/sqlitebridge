import * as utils from '../../utils';
import { TableDefinition } from '../../types';
import { writeCreateMethod } from './write-create-method';
import { writeGetAllMethod } from './write-get-all-method';
import { writeGetByIdMethod } from './write-get-by-id-method';
import { writeUpdateMethod } from './write-update-method';
import { writeDeleteMethod } from './write-delete-method';
import { writeCustomMethod } from './write-custom-method';

/**
 * Generate a TypeScript service file for database access with custom queries
 * @param modelName The model name (pascal case)
 * @param tableInfo Table information from the SQL parser
 * @param namedQueries Named queries extracted from SQL file
 * @param outputPath Path where the service file will be written
 * @param tableNameMap Mapping between query table names and schema table names
 * @returns Generated service content
 */
export function generateServiceContent(
    modelName: string,
    tableInfo: TableDefinition,
    namedQueries: Record<string, string>,
    tableNameMap: Record<string, string> = {},
    withDexie: boolean,
): string {
    const tableName = tableInfo.name;
    const interfaceName = modelName;
    const tableInterfaceName = `${modelName}Table`;
    const serviceClassName = `${modelName}Service`;
    const fileName = utils.interfaceNameToFileName(interfaceName);

    // Get list of fields for mapping between model and table
    const fields = tableInfo.columns
        .map(col => {
            // Convert snake_case to camelCase for JS properties
            const camelCaseName = col.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

            return {
                name: col.name,
                camelCase: camelCaseName,
                type: col.tsType,
                isPrimaryKey: col.isPrimaryKey,
                isNullable: col.isNullable
            };
        })
        .filter(field => utils.isValidFieldName(field.name));

    // Track columns referenced in queries but missing from schema
    const missingColumns = new Set<string>();
    const missingColumnToCamelCase: Record<string, string> = {};

    // Analyze all queries to find missing columns
    Object.entries(namedQueries).forEach(([_queryName, query]) => {
        // Basic column extraction from various parts of the query
        let columnMatches: string[] = [];

        // Handle SELECT statements
        if (query.toUpperCase().startsWith('SELECT')) {
            // Extract column names from SELECT clause
            const selectClause = query.match(/SELECT\s+(.*?)\s+FROM/i);
            if (selectClause && selectClause[1] !== '*') {
                const selectColumns = selectClause[1].split(',')
                    .map(col => col.trim().split(/\s+AS\s+|\s+/i)[0].trim())
                    .filter(col => col !== '*');

                // Handle table aliases in columns (e.g., u.name)
                selectColumns.forEach(col => {
                    const parts = col.split('.');
                    if (parts.length === 2) {
                        columnMatches.push(parts[1]); // Add just the column name without alias
                    } else if (parts.length === 1 && col !== '*') {
                        columnMatches.push(col);
                    }
                });
            }
        }

        // Extract column names from WHERE clauses
        const whereClause = query.match(/WHERE\s+(.*?)(?:ORDER BY|GROUP BY|LIMIT|$)/is);
        if (whereClause) {
            const conditions = whereClause[1].split(/\s+AND\s+|\s+OR\s+/i);
            conditions.forEach(condition => {
                const colMatch = condition.match(/(\w+)(?:\.|:|\s)\s*(?:=|LIKE|>|<|>=|<=|<>|!=)/i);
                if (colMatch) {
                    columnMatches.push(colMatch[1]);
                }
            });
        }

        // Extract column names from UPDATE and SET clauses
        if (query.toUpperCase().startsWith('UPDATE')) {
            const setClause = query.match(/SET\s+(.*?)(?:WHERE|$)/is);
            if (setClause) {
                const setParts = setClause[1].split(',');
                setParts.forEach(part => {
                    const colMatch = part.match(/(\w+)\s*=/i);
                    if (colMatch) {
                        columnMatches.push(colMatch[1]);
                    }
                });
            }
        }

        // Extract column names from ORDER BY clauses
        const orderByClause = query.match(/ORDER\s+BY\s+(.*?)(?:LIMIT|$)/is);
        if (orderByClause) {
            const orderParts = orderByClause[1].split(',');
            orderParts.forEach(part => {
                const colMatch = part.match(/(\w+)(?:\s+ASC|\s+DESC|\s*$)/i);
                if (colMatch) {
                    columnMatches.push(colMatch[1]);
                }
            });
        }

        // Filter out SQL functions and special characters from detected columns
        columnMatches = columnMatches.filter(colName => utils.isValidFieldName(colName));

        // Check which columns exist in the schema and which don't
        columnMatches.forEach(colName => {
            const exists = tableInfo.columns.some(col => col.name === colName);
            if (!exists && !missingColumns.has(colName) && utils.isValidFieldName(colName)) {
                missingColumns.add(colName);
                // Store camelCase version for use in generated code
                missingColumnToCamelCase[colName] = colName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            }
        });
    });

    // Log warning about missing columns
    if (missingColumns.size > 0) {
        console.warn(`Warning: The following columns are referenced in queries but missing from the table schema: ${Array.from(missingColumns).join(', ')}`);
        console.warn(`Consider adding these columns to your schema to ensure proper type safety.`);

        // Add missing columns to our fields list with unknown type - but only if they're valid field names
        Array.from(missingColumns).forEach(colName => {
            if (utils.isValidFieldName(colName)) {
                fields.push({
                    name: colName,
                    camelCase: missingColumnToCamelCase[colName],
                    type: 'any', // Use any as we don't know the type
                    isPrimaryKey: false,
                    isNullable: true
                });
            }
        });
    }

    // Determine the primary key field
    const primaryKey = fields.find(f => f.isPrimaryKey) || { name: 'id', camelCase: 'id', type: 'number' };

    // Create the content
    let output = `// Auto-generated TypeScript service for the ${tableName} table\n`;
    output += `// Generated on ${new Date().toISOString()}\n`;
    if (tableInfo.originalFile) {
        output += `// Originally defined in: ${tableInfo.originalFile}\n`;
    }
    if (Object.keys(namedQueries).length > 0) {
        output += `// Custom queries from SQL files\n`;
    }
    output += `\n`;

    output += `import { Injectable } from '@angular/core';\n`;
    output += `import { DatabaseService } from './database.service';\n`;
    output += `import { ${interfaceName}, ${tableInterfaceName} } from '../models/${fileName}';\n\n`;

    output += `@Injectable({\n`;
    output += `  providedIn: 'root'\n`;
    output += `})\n`;
    output += `export class ${serviceClassName} {\n`;
    output += `  constructor(private databaseService: DatabaseService) {}\n\n`;

    // CREATE method
    output = writeCreateMethod(output, interfaceName, tableInterfaceName, fields, tableName, tableInfo, primaryKey, withDexie)

    // GET ALL method
    output = writeGetAllMethod(output, interfaceName, tableInterfaceName, tableName, withDexie)

    // GET BY ID method
    output = writeGetByIdMethod(output, interfaceName, tableName, primaryKey, withDexie)

    // UPDATE method
    output = writeUpdateMethod(output, interfaceName, tableInterfaceName, fields, tableName, primaryKey, withDexie)

    // DELETE method
    output = writeDeleteMethod(output, interfaceName, tableName, primaryKey, withDexie)

    // Add custom query methods from SQL file
    output = writeCustomMethod(output, interfaceName, tableName, namedQueries, tableNameMap, withDexie);

    // Map method
    output += `  /**\n`;
    output += `   * Map database entity object to model\n`;
    output += `   */\n`;
    output += `  private mapTableToModel(tableRow: ${tableInterfaceName}): ${interfaceName} {\n`;
    output += `    // Filter out any undefined fields or SQL functions\n`;
    output += `    const model: any = {};\n\n`;

    // Create mapping from table (snake_case) to model (camelCase)
    // Make sure we're not duplicating fields and handling only valid fields
    const processedFields = new Set<string>();
    fields.forEach(field => {
        // Skip if already processed or not a valid field name
        if (processedFields.has(field.camelCase) || !utils.isValidFieldName(field.name)) {
            return;
        }

        processedFields.add(field.camelCase);

        output += `    if (tableRow.${field.name} !== undefined) {\n`;
        if (field.name === field.camelCase) {
            output += `      model.${field.camelCase} = tableRow.${field.name};\n`;
        } else {
            output += `      model.${field.camelCase} = tableRow.${field.name};\n`;
        }
        output += `    }\n`;
    });

    output += `    return model as ${interfaceName};\n`;
    output += `  }\n`;
    output += `}\n`;

    return output;
}
