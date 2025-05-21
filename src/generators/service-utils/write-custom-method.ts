import * as utils from '../../utils'
import { generateQueryMethod } from './query-method';

export function writeCustomMethod(
    output: string,
    interfaceName: string,
    tableName: string,
    namedQueries: Record<string, string>,
    tableNameMap: Record<string, string>,
    withDexie: boolean
) {
    // CREATE method
    if (Object.keys(namedQueries).length > 0) {
        output += `  // Custom queries from SQL file\n`;

        // Sort queries alphabetically for consistency
        const sortedQueries = Object.entries(namedQueries).sort((a, b) => a[0].localeCompare(b[0]));

        for (const [queryName, query] of sortedQueries) {
            const queryInfo = utils.analyzeQuery(query);

            // Map table name if needed
            if (queryInfo.tableName && tableNameMap[queryInfo.tableName]) {
                queryInfo.tableName = tableNameMap[queryInfo.tableName];
            } else {
                // If not in the mapping, use the schema table name as default for Dexie
                queryInfo.tableName = tableName;
            }

            // For select queries that don't explicitly have LIMIT 1 but appear to return a single result,
            // adjust the returnsMultiple flag
            if (queryInfo.type === 'select' && queryInfo.returnsMultiple) {
                // These common prefixes usually indicate single-item queries
                if (queryName.startsWith('findBy') || queryName.startsWith('getBy')) {
                    queryInfo.returnsMultiple = false;
                    console.log(`Adjusted query '${queryName}' to return a single item based on naming convention`);
                }
            }

            output += generateQueryMethod(queryName, query, queryInfo, interfaceName, tableName, withDexie) + '\n';
        }
    }
    return output;
}
