/**
 * Query Method Generator
 * 
 * This module generates TypeScript methods for SQL queries defined in query files.
 * It analyzes the query structure and creates appropriately typed methods with
 * parameters that match the query requirements.
 * 
 * @packageDocumentation
 */

import { QueryInfo } from '../../types';

/**
 * Generate TypeScript method for a named query.
 * 
 * This function analyzes an SQL query and generates a TypeScript method with
 * appropriate parameter types and return types based on the query structure.
 * 
 * @param queryName - Name of the query from SQL comment
 * @param query - SQL query string
 * @param queryInfo - Analysis of the query
 * @param modelName - Name of the model
 * @param defaultTableName - Default table name to use if not specified
 * @param withDexie - Whether to include Dexie.js support
 * @returns Generated TypeScript method as a string
 * 
 * @example
 * ```typescript
 * const methodCode = generateQueryMethod(
 *   'findByEmail',
 *   'SELECT * FROM users WHERE email = ? LIMIT 1',
 *   queryInfo,
 *   'User',
 *   'users',
 *   true
 * );
 * ```
 */
export function generateQueryMethod(
    queryName: string,
    query: string,
    queryInfo: QueryInfo,
    modelName: string,
    defaultTableName: string = '',
    withDexie: boolean
): string {
    const interfaceName = modelName;
    const tableInterfaceName = `${modelName}Table`;

    let methodName = queryName;
    let methodParams = '';
    let methodBody = '';
    let paramNames: string[] = [];

    // Determine return type based on query type
    const returnType = determineReturnType(queryInfo, interfaceName, query);

    // Build method parameters with better names
    methodParams = generateMethodParameters(queryInfo, query, paramNames);

    // Build method documentation
    let documentation = generateMethodDocumentation(queryName, methodParams, queryInfo);

    // Build method implementation
    methodBody = `    try {\n`;
    methodBody = withDexie ?
        writeMethodWithDexie(methodBody, queryInfo, query, defaultTableName, paramNames, tableInterfaceName) :
        writeMethod(methodBody, queryInfo, query, paramNames, tableInterfaceName, false);

    methodBody += `    } catch (error) {\n`;
    methodBody += `      console.error('Error executing ${queryName}:', error);\n`;
    methodBody += `      throw error;\n`;
    methodBody += `    }\n`;

    return documentation + `  async ${methodName}(${methodParams}): ${returnType} {\n${methodBody}  }\n`;
}

/**
 * Determines the appropriate return type for a query method.
 * 
 * @param queryInfo - Analysis of the query
 * @param interfaceName - Name of the model interface
 * @param query - SQL query string
 * @returns Return type as a string
 * 
 * @internal
 */
function determineReturnType(queryInfo: QueryInfo, interfaceName: string, query: string): string {
    if (queryInfo.type === 'select') {
        // Special case for COUNT or aggregates
        if (query.toUpperCase().includes('COUNT(')) {
            return 'Promise<any[]>';
        } else if (queryInfo.returnsMultiple) {
            return `Promise<${interfaceName}[]>`;
        } else {
            return `Promise<${interfaceName} | null>`;
        }
    } else if (queryInfo.type === 'insert') {
        return 'Promise<number | undefined>';
    } else {
        return 'Promise<boolean>';
    }
}

/**
 * Generates method parameters based on query structure.
 * 
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param paramNames - Array to store parameter names (modified by reference)
 * @returns Method parameters as a string
 * 
 * @internal
 */
function generateMethodParameters(
    queryInfo: QueryInfo,
    query: string,
    paramNames: string[]
): string {
    if (queryInfo.namedParams.length > 0) {
        // Use named parameters
        return queryInfo.namedParams.map(param => `${param}: any`).join(', ');
    } else if (queryInfo.positionalParams > 0) {
        // Check if WHERE clause contains columns we can use for naming
        const whereClause = query.match(/WHERE\s+(.*?)(?:ORDER BY|GROUP BY|LIMIT|$)/is);
        if (whereClause) {
            const conditions = whereClause[1].split(/\s+AND\s+/i);
            conditions.forEach(condition => {
                // Try to extract column names from conditions
                const colMatch = condition.match(/(\w+)\s*(?:=|LIKE|>|<|>=|<=|<>|!=)\s*(?:\?|:\w+)/i);
                if (colMatch) {
                    paramNames.push(colMatch[1]);
                }
            });
        }

        // Check SET clause for UPDATE queries
        if (queryInfo.type === 'update') {
            const setClause = query.match(/SET\s+(.*?)(?:WHERE|$)/is);
            if (setClause) {
                const setParts = setClause[1].split(',');
                setParts.forEach(part => {
                    const colMatch = part.match(/(\w+)\s*=\s*(?:\?|:\w+)/i);
                    if (colMatch) {
                        paramNames.push(colMatch[1]);
                    }
                });
            }
        }

        // If we couldn't determine names from the query, use generic but typed names
        if (paramNames.length < queryInfo.positionalParams) {
            // Fill in remaining parameters with generic names
            for (let i = paramNames.length; i < queryInfo.positionalParams; i++) {
                paramNames.push(`param${i + 1}`);
            }
        }

        return paramNames.map((name, i) => `${name}: any`).join(', ');
    } else {
        return '';
    }
}

/**
 * Generates method documentation with JSDoc.
 * 
 * @param queryName - Name of the query
 * @param methodParams - Method parameters string
 * @param queryInfo - Analysis of the query
 * @returns Generated documentation as a string
 * 
 * @internal
 */
function generateMethodDocumentation(
    queryName: string,
    methodParams: string,
    queryInfo: QueryInfo
): string {
    let documentation = `  /**\n`;
    documentation += `   * ${queryName} - Custom query\n`;
    documentation += `   *\n`;
    if (methodParams) {
        documentation += `   * @param ${methodParams.replace(/: any/g, '')} Parameters for the query\n`;
    }
    
    let returnDescription = '';
    if (queryInfo.returnsMultiple) {
        returnDescription = 'Array of entities';
    } else if (queryInfo.type === 'select') {
        returnDescription = 'Entity or null';
    } else if (queryInfo.type === 'insert') {
        returnDescription = 'ID of inserted record';
    } else {
        returnDescription = 'Success indicator';
    }
    
    documentation += `   * @returns ${returnDescription}\n`;
    documentation += `   */\n`;
    
    return documentation;
}

/**
 * Writes method implementation with Dexie.js support.
 * 
 * @param methodBody - Current method body
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param defaultTableName - Default table name
 * @param paramNames - Array of parameter names
 * @param tableInterfaceName - Name of the table interface
 * @returns Updated method body as a string
 * 
 * @internal
 */
function writeMethodWithDexie(
    methodBody: string,
    queryInfo: QueryInfo,
    query: string,
    defaultTableName: string = '',
    paramNames: string[],
    tableInterfaceName: string,
): string {
    methodBody += `      if (this.databaseService.isNativeDatabase()) {\n`;
    methodBody = writeMethod(methodBody, queryInfo, query, paramNames, tableInterfaceName, true);

    methodBody += `      } else {\n`;
    methodBody += `        // Dexie implementation\n`;
    methodBody += `        const dexie = this.databaseService.getDexieInstance();\n`;
    methodBody += `        if (!dexie) throw new Error('Dexie database not initialized');\n\n`;

    // Get the correct table name for Dexie - use the mapped table name or default to the actual schema table
    const dexieTableName = queryInfo.tableName || defaultTableName;

    // Dexie implementation based on query type
    if (queryInfo.type === 'select') {
        // Special case for COUNT or aggregates
        if (query.toUpperCase().includes('COUNT(')) {
            methodBody += `        const count = await dexie.${dexieTableName}.count();\n`;
            methodBody += `        return [{ total: count }];\n`;
        } else {
            // For Dexie, we need to use collection API based on what's in the query
            // This is a simplified approach - in real world, you'd need more sophisticated parsing
            let dexieQuery = '';
            let whereClause = query.match(/WHERE\s+(.*?)(?:ORDER BY|GROUP BY|LIMIT|$)/is);

            if (whereClause) {
                dexieQuery = `dexie.${dexieTableName}`;

                // Try to extract conditions - this is simplified and doesn't handle complex WHERE clauses
                const conditions = whereClause[1].split(/\s+AND\s+/i);
                conditions.forEach((condition, index) => {
                    // Try to handle basic equality conditions
                    const eqMatch = condition.match(/(\w+)\s*=\s*(?::(\w+)|\?)/i);
                    if (eqMatch) {
                        const column = eqMatch[1];
                        const param = eqMatch[2] || paramNames[index];
                        dexieQuery += `.where('${column}').equals(${param})`;
                    }
                });

                if (queryInfo.returnsMultiple) {
                    dexieQuery += `.toArray()`;
                } else {
                    dexieQuery += `.first()`;
                }
            } else {
                // Fallback if we can't parse WHERE clause
                dexieQuery = `dexie.${dexieTableName}.toArray()`;
            }

            if (queryInfo.returnsMultiple) {
                methodBody += `        const entities = await ${dexieQuery};\n`;
                methodBody += `        return entities.map((entity: ${tableInterfaceName}) => this.mapTableToModel(entity));\n`;
            } else {
                methodBody += `        const entity = await ${dexieQuery};\n`;
                methodBody += `        return entity ? this.mapTableToModel(entity) : null;\n`;
            }
        }
    } else {
        // For other operations, warn that translation to Dexie isn't automatic
        methodBody += `        // TODO: Implement Dexie equivalent for this custom query\n`;
        methodBody += `        throw new Error('Custom ${queryInfo.type} operation not implemented for Dexie');\n`;
    }

    methodBody += `      }\n`;
    return methodBody;
}

/**
 * Writes method implementation for SQLite.
 * 
 * @param methodBody - Current method body
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param paramNames - Array of parameter names
 * @param tableInterfaceName - Name of the table interface
 * @param withDexie - Whether this is part of a Dexie method
 * @returns Updated method body as a string
 * 
 * @internal
 */
function writeMethod(
    methodBody: string,
    queryInfo: QueryInfo,
    query: string,
    paramNames: string[],
    tableInterfaceName: string,
    withDexie: boolean
): string {
    let withDexieSpace = withDexie ? " ".repeat(2) : "";
    methodBody += `${withDexieSpace}      // SQLite implementation\n`;
    methodBody += `${withDexieSpace}      const result = await this.databaseService.${queryInfo.type === 'select' ? 'executeQuery' : 'executeCommand'}(\n`;
    methodBody += `${withDexieSpace}        \`${query}\`,\n`;

    // Parameters for the query
    if (queryInfo.namedParams.length > 0) {
        methodBody += `${withDexieSpace}        [${queryInfo.namedParams.join(', ')}]\n`;
    } else if (queryInfo.positionalParams > 0) {
        methodBody += `${withDexieSpace}        [${paramNames.join(', ')}]\n`;
    } else {
        methodBody += `${withDexieSpace}        []\n`;
    }

    methodBody += `${withDexieSpace}      );\n\n`;

    // Return based on query type
    if (queryInfo.type === 'select') {
        // Special case for COUNT or aggregates
        if (query.toUpperCase().includes('COUNT(')) {
            methodBody += `${withDexieSpace}      if (result.values && result.values.length > 0) {\n`;
            methodBody += `${withDexieSpace}        return result.values;\n`;
            methodBody += `${withDexieSpace}      }\n`;
            methodBody += `${withDexieSpace}      return [{ total: 0 }];\n`;
        } else if (queryInfo.returnsMultiple) {
            methodBody += `${withDexieSpace}      if (result.values && result.values.length > 0) {\n`;
            methodBody += `${withDexieSpace}        return result.values.map((entity: ${tableInterfaceName}) => this.mapTableToModel(entity));\n`;
            methodBody += `${withDexieSpace}      }\n`;
            methodBody += `${withDexieSpace}      return [];\n`;
        } else {
            methodBody += `${withDexieSpace}      if (result.values && result.values.length > 0) {\n`;
            methodBody += `${withDexieSpace}        return this.mapTableToModel(result.values[0]);\n`;
            methodBody += `${withDexieSpace}      }\n`;
            methodBody += `${withDexieSpace}      return null;\n`;
        }
    } else if (queryInfo.type === 'insert') {
        methodBody += `${withDexieSpace}      return result.changes?.lastId;\n`;
    } else {
        methodBody += `${withDexieSpace}      return result.changes?.changes > 0;\n`;
    }
    return methodBody;
}