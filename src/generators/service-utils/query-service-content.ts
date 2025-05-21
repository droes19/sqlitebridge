/**
 * Query Service Content Generator
 * 
 * This module generates the TypeScript service class content for database tables,
 * including CRUD operations and custom queries from SQL files.
 * 
 * @packageDocumentation
 */

import * as utils from '../../utils';
import { TableDefinition } from '../../types';
import { writeCreateMethod } from './write-create-method';
import { writeGetAllMethod } from './write-get-all-method';
import { writeGetByIdMethod } from './write-get-by-id-method';
import { writeUpdateMethod } from './write-update-method';
import { writeDeleteMethod } from './write-delete-method';
import { writeCustomMethod } from './write-custom-method';

/**
 * Generate a TypeScript service file for database access with custom queries.
 * 
 * This function creates a complete Angular service class for a database table,
 * including standard CRUD operations and any custom queries provided.
 * 
 * @param modelName - The model name (pascal case)
 * @param tableInfo - Table information from the SQL parser
 * @param namedQueries - Named queries extracted from SQL file
 * @param tableNameMap - Mapping between query table names and schema table names
 * @param withDexie - Whether to include Dexie.js support in the service
 * @returns Generated service content as a string
 * 
 * @example
 * ```typescript
 * const serviceContent = generateServiceContent(
 *   'User',
 *   userTableInfo,
 *   { findByEmail: 'SELECT * FROM users WHERE email = ? LIMIT 1' },
 *   { user: 'users' },
 *   true
 * );
 * ```
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

    // Extract the fields from the table columns
    const fields = extractFields(tableInfo);

    // Track columns referenced in queries but missing from schema
    const { missingColumns, fields: updatedFields } = findMissingColumns(namedQueries, fields);

    // Log warning about missing columns
    if (missingColumns.size > 0) {
        console.warn(`Warning: The following columns are referenced in queries but missing from the table schema: ${Array.from(missingColumns).join(', ')}`);
        console.warn(`Consider adding these columns to your schema to ensure proper type safety.`);
    }

    // Determine the primary key field
    const primaryKey = updatedFields.find(f => f.isPrimaryKey) || { name: 'id', camelCase: 'id', type: 'number' };

    // Create the content
    let output = generateHeader(tableName, tableInfo, namedQueries);
    output += generateImports(interfaceName, fileName);
    output += generateClassHeader(serviceClassName);

    // CREATE method
    output = writeCreateMethod(output, interfaceName, tableInterfaceName, updatedFields, tableName, tableInfo, primaryKey, withDexie);

    // GET ALL method
    output = writeGetAllMethod(output, interfaceName, tableInterfaceName, tableName, withDexie);

    // GET BY ID method
    output = writeGetByIdMethod(output, interfaceName, tableName, primaryKey, withDexie);

    // UPDATE method
    output = writeUpdateMethod(output, interfaceName, tableInterfaceName, updatedFields, tableName, primaryKey, withDexie);

    // DELETE method
    output = writeDeleteMethod(output, interfaceName, tableName, primaryKey, withDexie);

    // Add custom query methods from SQL file
    output = writeCustomMethod(output, interfaceName, tableName, namedQueries, tableNameMap, withDexie);

    // Map method
    output += generateMapMethod(interfaceName, tableInterfaceName, updatedFields);

    output += `}\n`;

    return output;
}

/**
 * Extracts fields from table columns.
 * 
 * @param tableInfo - Table definition with columns
 * @returns Array of field objects with name, camelCase name, and type
 * 
 * @internal
 */
function extractFields(tableInfo: TableDefinition): any[] {
    return tableInfo.columns
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
}

/**
 * Finds columns referenced in queries but missing from the schema.
 * 
 * @param namedQueries - Map of query names to query strings
 * @param fields - Array of field objects
 * @returns Object with missing columns and updated fields
 * 
 * @internal
 */
function findMissingColumns(
    namedQueries: Record<string, string>,
    fields: any[],
): { missingColumns: Set<string>; fields: any[] } {
    // Prepare a copy of fields that we'll update
    const updatedFields = [...fields];

    // Track columns referenced in queries but missing from schema
    const missingColumns = new Set<string>();
    const missingColumnToCamelCase: Record<string, string> = {};

    // Analyze all queries to find missing columns
    Object.entries(namedQueries).forEach(([_queryName, query]) => {
        // Extract column names from the query
        const columnMatches = extractColumnsFromQuery(query);

        // Check which columns exist in the schema and which don't
        columnMatches.forEach(colName => {
            const exists = fields.some(field => field.name === colName);
            if (!exists && !missingColumns.has(colName) && utils.isValidFieldName(colName)) {
                missingColumns.add(colName);
                // Store camelCase version for use in generated code
                missingColumnToCamelCase[colName] = colName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            }
        });
    });

    // Add missing columns to our fields list with unknown type - but only if they're valid field names
    Array.from(missingColumns).forEach(colName => {
        if (utils.isValidFieldName(colName)) {
            updatedFields.push({
                name: colName,
                camelCase: missingColumnToCamelCase[colName],
                type: 'any', // Use any as we don't know the type
                isPrimaryKey: false,
                isNullable: true
            });
        }
    });

    return { missingColumns, fields: updatedFields };
}

/**
 * Extracts column names from a SQL query.
 * 
 * @param query - SQL query string
 * @returns Array of column names
 * 
 * @internal
 */
function extractColumnsFromQuery(query: string): string[] {
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
    return columnMatches.filter(colName => utils.isValidFieldName(colName));
}

/**
 * Generates the header comment for the service file.
 * 
 * @param tableName - Name of the table
 * @param tableInfo - Table definition with columns
 * @param namedQueries - Map of query names to query strings
 * @returns Generated header as a string
 * 
 * @internal
 */
function generateHeader(
    tableName: string,
    tableInfo: TableDefinition,
    namedQueries: Record<string, string>
): string {
    let output = `// Auto-generated TypeScript service for the ${tableName} table\n`;
    output += `// Generated on ${new Date().toISOString()}\n`;

    if (tableInfo.originalFile) {
        output += `// Originally defined in: ${tableInfo.originalFile}\n`;
    }

    if (Object.keys(namedQueries).length > 0) {
        output += `// Custom queries from SQL files\n`;
    }

    output += `\n`;

    return output;
}

/**
 * Generates import statements for the service file.
 * 
 * @param interfaceName - Name of the interface
 * @param fileName - Name of the model file
 * @returns Generated imports as a string
 * 
 * @internal
 */
function generateImports(interfaceName: string, fileName: string): string {
    let output = `import { Injectable } from '@angular/core';\n`;
    output += `import { DatabaseService } from './database.service';\n`;
    output += `import { ${interfaceName}, ${interfaceName}Table } from '../models/${fileName}';\n\n`;

    return output;
}

/**
 * Generates the class header and constructor.
 * 
 * @param serviceClassName - Name of the service class
 * @returns Generated class header as a string
 * 
 * @internal
 */
function generateClassHeader(serviceClassName: string): string {
    let output = `@Injectable({\n`;
    output += `  providedIn: 'root'\n`;
    output += `})\n`;
    output += `export class ${serviceClassName} {\n`;
    output += `  constructor(private databaseService: DatabaseService) {}\n\n`;

    return output;
}

/**
 * Generates the method for mapping between database and model objects.
 * 
 * @param interfaceName - Name of the interface
 * @param tableInterfaceName - Name of the table interface
 * @param fields - Array of field objects
 * @returns Generated map method as a string
 * 
 * @internal
 */
function generateMapMethod(
    interfaceName: string,
    tableInterfaceName: string,
    fields: any[]
): string {
    let output = `  /**\n`;
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

    return output;
}
