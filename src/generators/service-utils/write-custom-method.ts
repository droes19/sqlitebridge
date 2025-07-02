/**
 * Service Generator - Write Custom Methods Module
 * 
 * This module generates TypeScript code for custom query methods in both Angular services
 * and React hooks. It processes named SQL queries and creates corresponding methods with 
 * appropriate parameter and return types for each framework.
 * 
 * @packageDocumentation
 */

import { QueryInfo } from '../../types';
import { FrameworkType } from '../../config';
import * as utils from '../../utils';
import { generateQueryMethod } from './query-method';

/**
 * Generates custom query methods based on named SQL queries.
 * 
 * This function takes a collection of named SQL queries and generates TypeScript
 * method implementations for each one. It handles table name mapping, infers return
 * types based on query structure and naming conventions, and supports both SQLite
 * and Dexie.js implementations.
 * For React, it generates hooks with state management. For Angular, it generates service methods.
 * 
 * @param output - Current output string to append to
 * @param interfaceName - Name of the model interface (PascalCase)
 * @param tableName - Name of the database table
 * @param namedQueries - Record of query names to SQL query strings
 * @param tableNameMap - Mapping of query table names to schema table names
 * @param withDexie - Whether to include Dexie.js implementation
 * @param framework - Target framework ('angular' | 'react')
 * @returns Updated output string with custom query methods added
 * 
 * @example
 * ```typescript
 * // Angular service methods
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
 *   true,
 *   'angular'
 * );
 * 
 * // React hooks
 * output = writeCustomMethod(
 *   output,
 *   'User',
 *   'users',
 *   {
 *     findByEmail: 'SELECT * FROM users WHERE email = ? LIMIT 1',
 *     getAllActive: 'SELECT * FROM users WHERE active = 1'
 *   },
 *   { user: 'users' },
 *   true,
 *   'react'
 * );
 * ```
 */
export function writeCustomMethod(
	output: string,
	interfaceName: string,
	tableName: string,
	namedQueries: Record<string, string>,
	tableNameMap: Record<string, string>,
	withDexie: boolean,
	framework: FrameworkType
): string {
	// Only add custom queries section if there are any queries
	if (Object.keys(namedQueries).length === 0) {
		return output;
	}

	if (framework === 'react') {
		return writeReactCustomHooks(
			output,
			interfaceName,
			tableName,
			namedQueries,
			tableNameMap,
			withDexie
		);
	} else {
		return writeAngularCustomMethods(
			output,
			interfaceName,
			tableName,
			namedQueries,
			tableNameMap,
			withDexie
		);
	}
}

/**
 * Generate React custom hooks.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableName - Table name
 * @param namedQueries - Custom queries
 * @param tableNameMap - Table name mapping
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeReactCustomHooks(
	output: string,
	interfaceName: string,
	tableName: string,
	namedQueries: Record<string, string>,
	tableNameMap: Record<string, string>,
	withDexie: boolean
): string {
	output += `  // Custom query hooks from SQL file\n\n`;

	// Sort queries alphabetically for consistency
	const sortedQueries = Object.entries(namedQueries).sort((a, b) => a[0].localeCompare(b[0]));

	// Process each query
	for (const [queryName, query] of sortedQueries) {
		const queryInfo = analyzeAndAdjustQuery(query, queryName, tableName, tableNameMap);

		// Generate React hook implementation for this query
		output += generateReactCustomHook(queryName, query, queryInfo, interfaceName, tableName, withDexie);
	}

	return output;
}

/**
 * Generate Angular custom methods.
 * 
 * @param output - Current output string
 * @param interfaceName - Interface name
 * @param tableName - Table name
 * @param namedQueries - Custom queries
 * @param tableNameMap - Table name mapping
 * @param withDexie - Include Dexie support
 * @returns Updated output string
 * 
 * @internal
 */
function writeAngularCustomMethods(
	output: string,
	interfaceName: string,
	tableName: string,
	namedQueries: Record<string, string>,
	tableNameMap: Record<string, string>,
	withDexie: boolean
): string {
	output += `  // Custom queries from SQL file\n\n`;

	// Sort queries alphabetically for consistency
	const sortedQueries = Object.entries(namedQueries).sort((a, b) => a[0].localeCompare(b[0]));

	// Process each query
	for (const [queryName, query] of sortedQueries) {
		const queryInfo = analyzeAndAdjustQuery(query, queryName, tableName, tableNameMap);

		// Generate Angular method implementation for this query
		output += generateQueryMethod(queryName, query, queryInfo, interfaceName, tableName, withDexie, 'angular');
	}

	return output;
}

/**
 * Generate React custom hook for a specific query.
 * 
 * @param queryName - Name of the query
 * @param query - SQL query string
 * @param queryInfo - Query analysis
 * @param interfaceName - Interface name
 * @param tableName - Table name
 * @param withDexie - Include Dexie support
 * @returns Generated React hook
 * 
 * @internal
 */
function generateReactCustomHook(
	queryName: string,
	query: string,
	queryInfo: QueryInfo,
	interfaceName: string,
	tableName: string,
	withDexie: boolean
): string {
	const tableInterfaceName = `${interfaceName}Table`;
	let hookName = `use${queryName.charAt(0).toUpperCase() + queryName.slice(1)}`;
	let paramNames: string[] = [];

	// Build method parameters
	let methodParams = generateMethodParameters(queryInfo, query, paramNames);

	// Determine return type
	let returnType = determineReactReturnType(queryInfo, interfaceName, query);

	// Generate hook documentation
	let output = generateReactHookDocumentation(hookName, queryName, methodParams, queryInfo);

	if (queryInfo.type === 'select') {
		// Query hook (SELECT operations)
		output += generateReactQueryHook(hookName, methodParams, returnType, queryName, queryInfo, query, tableName, paramNames, tableInterfaceName, withDexie);
	} else {
		// Mutation hook (INSERT, UPDATE, DELETE operations)
		output += generateReactMutationHook(hookName, methodParams, returnType, queryInfo, query, tableName, paramNames, tableInterfaceName, withDexie);
	}

	return output;
}

/**
 * Generate React query hook (for SELECT operations).
 * 
 * @param hookName - Name of the hook
 * @param methodParams - Method parameters
 * @param returnType - Return type
 * @param queryName - Query name
 * @param queryInfo - Query analysis
 * @param query - SQL query
 * @param tableName - Table name
 * @param paramNames - Parameter names
 * @param tableInterfaceName - Table interface name
 * @param withDexie - Include Dexie support
 * @returns Generated query hook
 * 
 * @internal
 */
function generateReactQueryHook(
	hookName: string,
	methodParams: string,
	returnType: string,
	queryName: string,
	queryInfo: QueryInfo,
	query: string,
	tableName: string,
	paramNames: string[],
	tableInterfaceName: string,
	withDexie: boolean
): string {
	let output = '';

	if (methodParams) {
		output += `  const ${hookName} = (${methodParams}): ${returnType} => {\n`;
	} else {
		output += `  const ${hookName} = (): ${returnType} => {\n`;
	}

	// State declarations
	const dataType = getReactDataType(queryInfo, query);
	const initialValue = getReactInitialValue(queryInfo, query);

	output += `    const [data, setData] = React.useState<${dataType}>(${initialValue});\n`;
	output += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
	output += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

	// Fetch function
	output += `    const fetchData = React.useCallback(async () => {\n`;
	output += `      try {\n`;
	output += `        setLoading(true);\n`;
	output += `        setError(null);\n\n`;

	// Implementation
	output = withDexie ?
		writeReactQueryWithDexie(output, queryInfo, query, tableName, paramNames, tableInterfaceName) :
		writeReactQuery(output, queryInfo, query, paramNames, tableInterfaceName);

	output += `      } catch (err) {\n`;
	output += `        console.error('Error executing ${queryName}:', err);\n`;
	output += `        setError(err instanceof Error ? err.message : 'Unknown error');\n`;
	output += `      } finally {\n`;
	output += `        setLoading(false);\n`;
	output += `      }\n`;
	output += `    }, [${paramNames.join(', ')}]);\n\n`;

	// useEffect for automatic fetching
	output += `    React.useEffect(() => {\n`;
	output += `      fetchData();\n`;
	output += `    }, [fetchData]);\n\n`;

	// Return statement
	output += `    return {\n`;
	output += `      data,\n`;
	output += `      loading,\n`;
	output += `      error,\n`;
	output += `      refetch: fetchData\n`;
	output += `    };\n`;
	output += `  };\n\n`;

	return output;
}

/**
 * Generate React mutation hook (for INSERT, UPDATE, DELETE operations).
 * 
 * @param hookName - Name of the hook
 * @param methodParams - Method parameters
 * @param returnType - Return type
 * @param queryInfo - Query analysis
 * @param query - SQL query
 * @param tableName - Table name
 * @param paramNames - Parameter names
 * @param tableInterfaceName - Table interface name
 * @param withDexie - Include Dexie support
 * @returns Generated mutation hook
 * 
 * @internal
 */
function generateReactMutationHook(
	hookName: string,
	methodParams: string,
	returnType: string,
	queryInfo: QueryInfo,
	query: string,
	tableName: string,
	paramNames: string[],
	tableInterfaceName: string,
	withDexie: boolean
): string {
	let output = '';

	output += `  const ${hookName} = (): ${returnType} => {\n`;

	// State declarations
	output += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
	output += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

	// Mutate function
	const mutateParams = paramNames.map(name => `${name}: any`).join(', ');
	const baseReturnType = determineBaseReturnType(queryInfo, query);

	output += `    const mutate = React.useCallback(async (${mutateParams}): Promise<${baseReturnType}> => {\n`;
	output += `      try {\n`;
	output += `        setLoading(true);\n`;
	output += `        setError(null);\n\n`;

	// Implementation
	output = withDexie ?
		writeReactMutationWithDexie(output, queryInfo, query, tableName, paramNames, tableInterfaceName) :
		writeReactMutation(output, queryInfo, query, paramNames, tableInterfaceName);

	output += `      } catch (err) {\n`;
	output += `        console.error('Error executing mutation:', err);\n`;
	output += `        setError(err instanceof Error ? err.message : 'Unknown error');\n`;
	output += `        throw err;\n`;
	output += `      } finally {\n`;
	output += `        setLoading(false);\n`;
	output += `      }\n`;
	output += `    }, []);\n\n`;

	// Reset function
	output += `    const reset = React.useCallback(() => {\n`;
	output += `      setError(null);\n`;
	output += `    }, []);\n\n`;

	// Return statement
	output += `    return {\n`;
	output += `      mutate,\n`;
	output += `      loading,\n`;
	output += `      error,\n`;
	output += `      reset\n`;
	output += `    };\n`;
	output += `  };\n\n`;

	return output;
}

/**
 * Analyzes a query and adjusts its metadata based on naming conventions and table mappings.
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

/**
 * Generate method parameters based on query structure.
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
 * Determine React return type for hooks.
 * 
 * @param queryInfo - Query analysis
 * @param interfaceName - Interface name
 * @param query - SQL query
 * @returns React return type
 * 
 * @internal
 */
function determineReactReturnType(queryInfo: QueryInfo, interfaceName: string, query: string): string {
	if (queryInfo.type === 'select') {
		// Query hook return type
		const dataType = getReactDataType(queryInfo, query);
		return `{
    data: ${dataType};
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
  }`;
	} else {
		// Mutation hook return type
		const baseReturnType = determineBaseReturnType(queryInfo, query);
		return `{
    mutate: (...args: any[]) => Promise<${baseReturnType}>;
    loading: boolean;
    error: string | null;
    reset: () => void;
  }`;
	}
}

/**
 * Get React data type for state.
 * 
 * @param queryInfo - Query analysis
 * @param query - SQL query
 * @returns Data type string
 * 
 * @internal
 */
function getReactDataType(queryInfo: QueryInfo, query: string): string {
	if (query.toUpperCase().includes('COUNT(')) {
		return 'any[]';
	} else if (queryInfo.returnsMultiple) {
		return 'any[]';
	} else {
		return 'any | null';
	}
}

/**
 * Get React initial value for state.
 * 
 * @param queryInfo - Query analysis
 * @param query - SQL query
 * @returns Initial value string
 * 
 * @internal
 */
function getReactInitialValue(queryInfo: QueryInfo, query: string): string {
	if (query.toUpperCase().includes('COUNT(')) {
		return '[]';
	} else if (queryInfo.returnsMultiple) {
		return '[]';
	} else {
		return 'null';
	}
}

/**
 * Determine base return type for mutations.
 * 
 * @param queryInfo - Query analysis
 * @param query - SQL query
 * @returns Base return type
 * 
 * @internal
 */
function determineBaseReturnType(queryInfo: QueryInfo, query: string): string {
	if (queryInfo.type === 'insert') {
		return 'number | undefined';
	} else {
		return 'boolean';
	}
}

/**
 * Generate React hook documentation.
 * 
 * @param hookName - Hook name
 * @param queryName - Query name
 * @param methodParams - Method parameters
 * @param queryInfo - Query analysis
 * @returns Generated documentation
 * 
 * @internal
 */
function generateReactHookDocumentation(
	hookName: string,
	queryName: string,
	methodParams: string,
	queryInfo: QueryInfo
): string {
	let documentation = `  /**\n`;
	documentation += `   * React hook for ${queryName} - Custom query\n`;

	if (queryInfo.type === 'select') {
		documentation += `   * Returns data, loading state, error state, and refetch function\n`;
	} else {
		documentation += `   * Returns mutation function, loading state, error state, and reset function\n`;
	}

	documentation += `   *\n`;

	if (methodParams) {
		const cleanParams = methodParams.replace(/: any/g, '');
		if (queryInfo.type !== 'select') {
			documentation += `   * @param options Optional parameters for the mutation\n`;
		} else {
			documentation += `   * @param ${cleanParams} Parameters for the query\n`;
		}
	}

	let returnDescription = '';
	if (queryInfo.type === 'select') {
		returnDescription = 'Hook state with data, loading, error, and refetch';
	} else {
		returnDescription = 'Hook state with mutate function, loading, error, and reset';
	}

	documentation += `   * @returns ${returnDescription}\n`;
	documentation += `   */\n`;

	return documentation;
}

// Implementation functions for React query execution
function writeReactQueryWithDexie(
	output: string,
	queryInfo: QueryInfo,
	query: string,
	tableName: string,
	paramNames: string[],
	tableInterfaceName: string
): string {
	output += `        if (databaseService.isNativeDatabase()) {\n`;
	output = writeReactQuery(output, queryInfo, query, paramNames, tableInterfaceName, true);

	output += `        } else {\n`;
	output += `          // Dexie implementation\n`;
	output += `          const dexie = databaseService.getDexieInstance();\n`;
	output += `          if (!dexie) throw new Error('Dexie database not initialized');\n\n`;

	const dexieTableName = queryInfo.tableName || tableName;

	if (query.toUpperCase().includes('COUNT(')) {
		output += `          const count = await dexie.${dexieTableName}.count();\n`;
		output += `          setData([{ total: count }]);\n`;
	} else {
		let dexieQuery = `dexie.${dexieTableName}`;
		const whereClause = query.match(/WHERE\s+(.*?)(?:ORDER BY|GROUP BY|LIMIT|$)/is);

		if (whereClause) {
			const conditions = whereClause[1].split(/\s+AND\s+/i);
			conditions.forEach((condition, index) => {
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
			dexieQuery = `dexie.${dexieTableName}.toArray()`;
		}

		if (queryInfo.returnsMultiple) {
			output += `          const entities = await ${dexieQuery};\n`;
			output += `          setData(entities.map((entity: ${tableInterfaceName}) => mapTableToModel(entity)));\n`;
		} else {
			output += `          const entity = await ${dexieQuery};\n`;
			output += `          setData(entity ? mapTableToModel(entity) : null);\n`;
		}
	}

	output += `        }\n`;
	return output;
}

function writeReactQuery(
	output: string,
	queryInfo: QueryInfo,
	query: string,
	paramNames: string[],
	tableInterfaceName: string,
	withDexie: boolean = false
): string {
	const indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	output += `${indent}      // SQLite implementation\n`;
	output += `${indent}      const result = await databaseService.executeQuery(\n`;
	output += `${indent}        \`${query}\`,\n`;

	if (queryInfo.namedParams.length > 0) {
		output += `${indent}        [${queryInfo.namedParams.join(', ')}]\n`;
	} else if (queryInfo.positionalParams > 0) {
		output += `${indent}        [${paramNames.join(', ')}]\n`;
	} else {
		output += `${indent}        []\n`;
	}

	output += `${indent}      );\n\n`;

	if (query.toUpperCase().includes('COUNT(')) {
		output += `${indent}      if (result.values && result.values.length > 0) {\n`;
		output += `${indent}        setData(result.values);\n`;
		output += `${indent}      } else {\n`;
		output += `${indent}        setData([{ total: 0 }]);\n`;
		output += `${indent}      }\n`;
	} else if (queryInfo.returnsMultiple) {
		output += `${indent}      if (result.values && result.values.length > 0) {\n`;
		output += `${indent}        setData(result.values.map((entity: ${tableInterfaceName}) => mapTableToModel(entity)));\n`;
		output += `${indent}      } else {\n`;
		output += `${indent}        setData([]);\n`;
		output += `${indent}      }\n`;
	} else {
		output += `${indent}      if (result.values && result.values.length > 0) {\n`;
		output += `${indent}        setData(mapTableToModel(result.values[0]));\n`;
		output += `${indent}      } else {\n`;
		output += `${indent}        setData(null);\n`;
		output += `${indent}      }\n`;
	}

	return output;
}

function writeReactMutationWithDexie(
	output: string,
	queryInfo: QueryInfo,
	query: string,
	tableName: string,
	paramNames: string[],
	tableInterfaceName: string
): string {
	output += `        if (databaseService.isNativeDatabase()) {\n`;
	output = writeReactMutation(output, queryInfo, query, paramNames, tableInterfaceName, true);

	output += `        } else {\n`;
	output += `          // Dexie implementation\n`;
	output += `          const dexie = databaseService.getDexieInstance();\n`;
	output += `          if (!dexie) throw new Error('Dexie database not initialized');\n\n`;
	output += `          // TODO: Implement Dexie equivalent for this custom mutation\n`;
	output += `          throw new Error('Custom ${queryInfo.type} operation not implemented for Dexie');\n`;
	output += `        }\n`;

	return output;
}

function writeReactMutation(
	output: string,
	queryInfo: QueryInfo,
	query: string,
	paramNames: string[],
	tableInterfaceName: string,
	withDexie: boolean = false
): string {
	const indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	output += `${indent}      // SQLite implementation\n`;
	output += `${indent}      const result = await databaseService.executeCommand(\n`;
	output += `${indent}        \`${query}\`,\n`;

	if (queryInfo.namedParams.length > 0) {
		output += `${indent}        [${queryInfo.namedParams.join(', ')}]\n`;
	} else if (queryInfo.positionalParams > 0) {
		output += `${indent}        [${paramNames.join(', ')}]\n`;
	} else {
		output += `${indent}        []\n`;
	}

	output += `${indent}      );\n\n`;

	if (queryInfo.type === 'insert') {
		output += `${indent}      return result.changes?.lastId as number;\n`;
	} else {
		output += `${indent}      return result.changes?.changes > 0;\n`;
	}

	return output;
}
