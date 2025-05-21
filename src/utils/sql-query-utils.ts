import { QueryInfo } from '../types';

/**
 * Extract named queries from SQL file
 * Format: -- :queryName
 *         SQL query here
 * @param sqlContent Content of the SQL file
 * @returns Object with query name as key and query content as value
 */
export function extractNamedQueries(sqlContent: string | null): Record<string, string> {
    const namedQueries: Record<string, string> = {};
    if (!sqlContent) {
        return namedQueries;
    }

    // Split content by lines
    const lines = sqlContent.split(/\r?\n/);
    let currentQueryName: string | null = null;
    let currentQueryContent: string[] = [];

    // Process line by line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if this is a query name line
        const queryNameMatch = line.match(/--\s*:(\w+)/);

        if (queryNameMatch) {
            // If we were processing a previous query, save it
            if (currentQueryName) {
                namedQueries[currentQueryName] = currentQueryContent.join('\n').trim();
                currentQueryContent = [];
            }

            // Start new query
            currentQueryName = queryNameMatch[1];
        }
        // If we're in a query and the line isn't another query marker, add to content
        else if (currentQueryName && line !== '') {
            currentQueryContent.push(line);
        }
    }

    // Save the last query if there is one
    if (currentQueryName && currentQueryContent.length > 0) {
        namedQueries[currentQueryName] = currentQueryContent.join('\n').trim();
    }

    return namedQueries;
}

/**
 * Parse a SQL query to determine its type (select, insert, update, delete)
 * and extract parameter placeholders and target table
 * @param query SQL query
 * @returns Information about the query
 */
export function analyzeQuery(query: string): QueryInfo {
    // Determine query type
    let type: 'select' | 'insert' | 'update' | 'delete' | 'unknown' = 'unknown';
    if (query.trim().toUpperCase().startsWith('SELECT')) {
        type = 'select';
    } else if (query.trim().toUpperCase().startsWith('INSERT')) {
        type = 'insert';
    } else if (query.trim().toUpperCase().startsWith('UPDATE')) {
        type = 'update';
    } else if (query.trim().toUpperCase().startsWith('DELETE')) {
        type = 'delete';
    }

    // Extract parameter placeholders
    // Match both :name and ? parameter styles
    const namedParams = [...query.matchAll(/:(\w+)/g)].map(match => match[1]);
    const positionalParams = (query.match(/\?/g) || []).length;

    // Extract columns referenced in the query, filtering out SQL functions
    let referencedColumns: string[] = [];

    // Try to extract the target table name
    let tableName = '';
    if (type === 'select') {
        // Extract the FROM clause to find the table
        const fromMatch = query.match(/FROM\s+["'`]?(\w+)["'`]?(?:\s+(?:AS\s+)?["'`]?(\w+)["'`]?)?/i);
        if (fromMatch) {
            tableName = fromMatch[1];

            // Extract columns mentioned in the query
            const selectClause = query.match(/SELECT\s+(.*?)\s+FROM/i);
            if (selectClause && selectClause[1] !== '*') {
                const selectParts = selectClause[1].split(',');

                // Process each select part to extract column names (ignoring functions)
                selectParts.forEach(part => {
                    const trimmedPart = part.trim();

                    // Skip COUNT(*) and other function calls
                    if (!trimmedPart.includes('(') && !trimmedPart.includes(')') && trimmedPart !== '*') {
                        // Handle cases with aliases: column AS alias
                        const columnParts = trimmedPart.split(/\s+AS\s+|\s+/i);

                        // Take the first part as the column name
                        let columnName = columnParts[0].trim();

                        // Handle table.column format
                        if (columnName.includes('.')) {
                            const parts = columnName.split('.');
                            if (parts.length === 2) {
                                columnName = parts[1];
                            }
                        }

                        // Add to referenced columns if it's a valid field name
                        if (isValidFieldName(columnName)) {
                            referencedColumns.push(columnName);
                        }
                    }
                });
            }
        }
    } else if (type === 'insert') {
        const intoMatch = query.match(/INTO\s+["'`]?(\w+)["'`]?/i);
        if (intoMatch) tableName = intoMatch[1];

        // Extract column names from INSERT INTO table (col1, col2...) VALUES
        const columnsMatch = query.match(/INTO\s+["'`]?\w+["'`]?\s*\((.*?)\)/i);
        if (columnsMatch) {
            const columns = columnsMatch[1].split(',').map(col => col.trim());
            referencedColumns = columns.filter(col => isValidFieldName(col));
        }
    } else if (type === 'update') {
        const updateMatch = query.match(/UPDATE\s+["'`]?(\w+)["'`]?/i);
        if (updateMatch) tableName = updateMatch[1];

        // Extract column names from SET clause
        const setClause = query.match(/SET\s+(.*?)(?:WHERE|$)/i);
        if (setClause) {
            const setParts = setClause[1].split(',');
            setParts.forEach(part => {
                const colMatch = part.match(/(\w+)\s*=/i);
                if (colMatch && isValidFieldName(colMatch[1])) {
                    referencedColumns.push(colMatch[1]);
                }
            });
        }
    } else if (type === 'delete') {
        const fromMatch = query.match(/FROM\s+["'`]?(\w+)["'`]?/i);
        if (fromMatch) tableName = fromMatch[1];
    }

    // Extract column names from WHERE clauses
    const whereClause = query.match(/WHERE\s+(.*?)(?:ORDER BY|GROUP BY|LIMIT|$)/is);
    if (whereClause) {
        const conditions = whereClause[1].split(/\s+AND\s+|\s+OR\s+/i);
        conditions.forEach(condition => {
            const colMatch = condition.match(/(\w+)(?:\.|:|\s)\s*(?:=|LIKE|>|<|>=|<=|<>|!=)/i);
            if (colMatch && isValidFieldName(colMatch[1])) {
                referencedColumns.push(colMatch[1]);
            }
        });
    }

    return {
        type,
        tableName,
        namedParams,
        positionalParams,
        returnsMultiple: type === 'select' && !query.toLowerCase().includes('limit 1'),
        referencedColumns: referencedColumns.filter(col => isValidFieldName(col))
    };
}

/**
 * Check if a name is a valid field name (not a SQL function or special character)
 * @param name Field name to check
 * @returns True if valid field name
 */
export function isValidFieldName(name: string): boolean {
    // Check if name contains SQL function calls or special characters
    if (!name ||
        name === '*' ||
        name.includes('(') ||
        name.includes(')') ||
        name.includes('*') ||
        name.includes(' ')) {
        return false;
    }
    // Check if name is a valid JavaScript identifier
    try {
        Function(`"use strict"; const ${name} = 1;`);
        return true;
    } catch (e) {
        return false;
    }
}
