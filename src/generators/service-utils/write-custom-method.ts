/**
 * Service Generator - Write Custom Methods Module
 * 
 * This module generates TypeScript code for custom query methods in Angular services.
 * It processes named SQL queries and creates corresponding methods with appropriate
 * parameter and return types.
 * 
 * @packageDocumentation
 */

import { QueryInfo } from '../../types';
import * as utils from '../../utils';
import { generateQueryMethod } from './query-method';

/**
 * Generates custom query methods based on named SQL queries.
 * 
 * This function takes a collection of named SQL queries and generates TypeScript
 * method implementations for each one. It handles table name mapping, infers return
 * types based on query structure and naming conventions, and supports both SQLite
 * and Dexie.js implementations.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableName - Name of the database table
 * @param namedQueries - Record of query names to SQL query strings
 * @param tableNameMap - Mapping of query table names to schema table names
 * @param withDexie - Whether to include Dexie.js implementation
 * @returns Updated output string with custom query methods added
 * 
 * @example
 * ```typescript
 * let output = '';
 * output = writeCustomMethod(
 *   output,
 *   'User',
 *   'users',
 *   {
 *     findByEmail: 'SELECT * FROM users WHERE email = ? LIMIT 1',
 *     getAllActive: 'SELECT * FROM users WHERE active = 1'
 *   },
 *   { user: 'users' },
 *   true
 * );
 * // Returns TypeScript code for findByEmail and getAllActive methods
 * ```
 */
export function writeCustomMethod(
    output: string,
    interfaceName: string,
    tableName: string,
    namedQueries: Record<string, string>,
    tableNameMap: Record<string, string>,
    withDexie: boolean
): string {
    // Only add custom queries section if there are any queries
    if (Object.keys(namedQueries).length > 0) {
        output += `  // Custom queries from SQL file\n`;

        // Sort queries alphabetically for consistency
        const sortedQueries = Object.entries(namedQueries).sort((a, b) => a[0].localeCompare(b[0]));

        // Process each query
        for (const [queryName, query] of sortedQueries) {
            const queryInfo = analyzeAndAdjustQuery(query, queryName, tableName, tableNameMap);
            
            // Generate method implementation for this query
            output += generateQueryMethod(queryName, query, queryInfo, interfaceName, tableName, withDexie) + '\n';
        }
    }
    
    return output;
}

/**
 * Analyzes a query and adjusts its metadata based on naming conventions and table mappings.
 * 
 * This function examines a query to determine its characteristics, maps table names,
 * and adjusts the returnsMultiple flag based on query naming conventions.
 * 
 * @param query - SQL query string
 * @param queryName - Name of the query
 * @param tableName - Name of the table
 * @param tableNameMap - Mapping of query table names to schema table names
 * @returns Query info object with analyzed and adjusted metadata
 * 
 * @internal
 */
function analyzeAndAdjustQuery(
    query: string,
    queryName: string,
    tableName: string,
    tableNameMap: Record<string, string>
): QueryInfo {
    // Analyze the query to determine its characteristics
    const queryInfo = utils.analyzeQuery(query);

    // Map table name if needed
    if (queryInfo.tableName && tableNameMap[queryInfo.tableName]) {
        queryInfo.tableName = tableNameMap[queryInfo.tableName];
    } else {
        // If not in the mapping, use the schema table name as default for Dexie
        queryInfo.tableName = tableName;
    }

    // For SELECT queries that don't explicitly have LIMIT 1 but appear to return a single result,
    // adjust the returnsMultiple flag based on naming conventions
    if (queryInfo.type === 'select' && queryInfo.returnsMultiple) {
        // These common prefixes usually indicate single-item queries
        if (queryName.startsWith('findBy') || queryName.startsWith('getBy')) {
            queryInfo.returnsMultiple = false;
            console.log(`Adjusted query '${queryName}' to return a single item based on naming convention`);
        }
    }

    return queryInfo;
}