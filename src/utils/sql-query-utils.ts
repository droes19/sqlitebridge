/**
 * SQL Query Utilities Module
 * 
 * This module provides utilities for extracting and analyzing SQL queries.
 * It can parse named queries from SQL files, analyze their structure,
 * and determine query characteristics such as type, parameters, and target tables.
 * 
 * @packageDocumentation
 */

import { QueryInfo } from '../types';

/**
 * Extract named queries from an SQL file.
 * 
 * This function parses a SQL file to extract named queries defined with a special
 * comment format. Each query starts with a comment that includes the query name,
 * and continues until the next named query or the end of the file.
 * 
 * The comment format is: `-- :queryName`
 * 
 * @param sqlContent - Content of the SQL file
 * @returns Object with query name as key and query content as value
 * 
 * @example
 * ```sql
 * -- :findUserById
 * SELECT * FROM users WHERE id = ?
 * 
 * -- :getAllActiveUsers
 * SELECT * FROM users WHERE active = 1
 * ```
 * 
 * ```typescript
 * const queryFile = readFile('queries.sql');
 * const namedQueries = extractNamedQueries(queryFile);
 * // Returns:
 * // {
 * //   findUserById: 'SELECT * FROM users WHERE id = ?',
 * //   getAllActiveUsers: 'SELECT * FROM users WHERE active = 1'
 * // }
 * ```
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
 * Analyze an SQL query to determine its characteristics.
 * 
 * This function examines an SQL query to determine:
 * - The query type (SELECT, INSERT, UPDATE, DELETE)
 * - The target table name
 * - Named parameters (e.g., `:paramName`)
 * - Positional parameters (question marks)
 * - Whether the query returns multiple rows
 * - Referenced column names
 * 
 * @param query - SQL query to analyze
 * @returns Object containing analysis of the query
 * 
 * @example
 * ```typescript
 * const queryInfo = analyzeQuery('SELECT * FROM users WHERE id = ?');
 * // Returns:
 * // {
 * //   type: 'select',
 * //   tableName: 'users',
 * //   namedParams: [],
 * //   positionalParams: 1,
 * //   returnsMultiple: true,
 * //   referencedColumns: []
 * // }
 * ```
 */
export function analyzeQuery(query: string): QueryInfo {
	// Determine query type
	const type = determineQueryType(query);

	// Extract parameter placeholders
	// Match both :name and ? parameter styles
	const namedParams = [...query.matchAll(/:(\w+)/g)].map(match => match[1]);
	const positionalParams = (query.match(/\?/g) || []).length;

	// Extract target table name and columns
	const { tableName, referencedColumns } = extractTableAndColumns(query, type);

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
 * Determine the type of an SQL query.
 * 
 * @param query - SQL query to analyze
 * @returns Query type ('select', 'insert', 'update', 'delete', or 'unknown')
 * 
 * @internal
 */
function determineQueryType(query: string): 'select' | 'insert' | 'update' | 'delete' | 'unknown' {
	const trimmedQuery = query.trim().toUpperCase();

	if (trimmedQuery.startsWith('SELECT')) {
		return 'select';
	} else if (trimmedQuery.startsWith('INSERT')) {
		return 'insert';
	} else if (trimmedQuery.startsWith('UPDATE')) {
		return 'update';
	} else if (trimmedQuery.startsWith('DELETE')) {
		return 'delete';
	}

	return 'unknown';
}

/**
 * Extract the table name and column names from an SQL query.
 * 
 * @param query - SQL query to analyze
 * @param type - Type of the query ('select', 'insert', 'update', 'delete', or 'unknown')
 * @returns Object containing table name and referenced columns
 * 
 * @internal
 */
function extractTableAndColumns(
	query: string,
	type: 'select' | 'insert' | 'update' | 'delete' | 'unknown'
): { tableName: string; referencedColumns: string[] } {
	let tableName = '';
	const referencedColumns: string[] = [];

	if (type === 'select') {
		// Extract table name from FROM clause
		extractSelectTableAndColumns(query, referencedColumns, tableName);
	} else if (type === 'insert') {
		// Extract table name from INTO clause
		extractInsertTableAndColumns(query, referencedColumns, tableName);
	} else if (type === 'update') {
		// Extract table name from UPDATE clause
		extractUpdateTableAndColumns(query, referencedColumns, tableName);
	} else if (type === 'delete') {
		// Extract table name from FROM clause
		extractDeleteTableName(query, tableName);
	}

	// Extract column names from WHERE clauses
	extractWhereColumns(query, referencedColumns);

	return { tableName, referencedColumns };
}

/**
 * Extract table name and columns from a SELECT query.
 * 
 * @param query - SQL query to analyze
 * @param referencedColumns - Array to store extracted columns (modified by reference)
 * @param tableName - Variable to store the table name (modified by reference)
 * 
 * @internal
 */
function extractSelectTableAndColumns(
	query: string,
	referencedColumns: string[],
	tableName: string
): void {
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
}

/**
 * Extract table name and columns from an INSERT query.
 * 
 * @param query - SQL query to analyze
 * @param referencedColumns - Array to store extracted columns (modified by reference)
 * @param tableName - Variable to store the table name (modified by reference)
 * 
 * @internal
 */
function extractInsertTableAndColumns(
	query: string,
	referencedColumns: string[],
	tableName: string
): void {
	const intoMatch = query.match(/INTO\s+["'`]?(\w+)["'`]?/i);
	if (intoMatch) tableName = intoMatch[1];

	// Extract column names from INSERT INTO table (col1, col2...) VALUES
	const columnsMatch = query.match(/INTO\s+["'`]?\w+["'`]?\s*\((.*?)\)/i);
	if (columnsMatch) {
		const columns = columnsMatch[1].split(',').map(col => col.trim());
		referencedColumns.push(...columns.filter(col => isValidFieldName(col)));
	}
}

/**
 * Extract table name and columns from an UPDATE query.
 * 
 * @param query - SQL query to analyze
 * @param referencedColumns - Array to store extracted columns (modified by reference)
 * @param tableName - Variable to store the table name (modified by reference)
 * 
 * @internal
 */
function extractUpdateTableAndColumns(
	query: string,
	referencedColumns: string[],
	tableName: string
): void {
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
}

/**
 * Extract table name from a DELETE query.
 * 
 * @param query - SQL query to analyze
 * @param tableName - Variable to store the table name (modified by reference)
 * 
 * @internal
 */
function extractDeleteTableName(query: string, tableName: string): void {
	const fromMatch = query.match(/FROM\s+["'`]?(\w+)["'`]?/i);
	if (fromMatch) tableName = fromMatch[1];
}

/**
 * Extract column names from WHERE clauses in an SQL query.
 * 
 * @param query - SQL query to analyze
 * @param referencedColumns - Array to store extracted columns (modified by reference)
 * 
 * @internal
 */
function extractWhereColumns(query: string, referencedColumns: string[]): void {
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
}

/**
 * Check if a name is a valid field name (not a SQL function or special character).
 * 
 * This function determines if a string can be used as a valid field name by checking:
 * - It's not empty
 * - It's not a wildcard (*)
 * - It doesn't contain parentheses (function calls)
 * - It doesn't contain spaces or special characters
 * - It's a valid JavaScript identifier
 * 
 * @param name - Field name to check
 * @returns True if the name is a valid field name, false otherwise
 * 
 * @example
 * ```typescript
 * isValidFieldName('username'); // Returns true
 * isValidFieldName('user_id'); // Returns true
 * isValidFieldName('COUNT(*)'); // Returns false
 * isValidFieldName('*'); // Returns false
 * isValidFieldName(''); // Returns false
 * ```
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
