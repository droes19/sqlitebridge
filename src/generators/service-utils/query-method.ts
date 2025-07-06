/**
 * Query Method Generator
 * 
 * This module generates TypeScript methods for SQL queries defined in query files.
 * It analyzes the query structure and creates appropriately typed methods with
 * parameters that match the query requirements.
 * Supports both Angular (service methods) and React (hook functions).
 * 
 * @packageDocumentation
 */

import { QueryInfo } from '../../types';
import { FrameworkType } from '../../config';

/**
 * Generate TypeScript method for a named query.
 * 
 * This function analyzes an SQL query and generates a TypeScript method with
 * appropriate parameter types and return types based on the query structure.
 * For Angular, it generates service methods. For React, it generates hook functions.
 * 
 * @param queryName - Name of the query from SQL comment
 * @param query - SQL query string
 * @param queryInfo - Analysis of the query
 * @param modelName - Name of the model
 * @param defaultTableName - Default table name to use if not specified
 * @param withDexie - Whether to include Dexie.js support
 * @param framework - Target framework ('angular' | 'react')
 * @returns Generated TypeScript method as a string
 * 
 * @example
 * ```typescript
 * // Angular service method
 * const methodCode = generateQueryMethod(
 *   'findByEmail',
 *   'SELECT * FROM users WHERE email = ? LIMIT 1',
 *   queryInfo,
 *   'User',
 *   'users',
 *   true,
 *   'angular'
 * );
 * 
 * // React hook function
 * const hookCode = generateQueryMethod(
 *   'findByEmail',
 *   'SELECT * FROM users WHERE email = ? LIMIT 1',
 *   queryInfo,
 *   'User',
 *   'users',
 *   true,
 *   'react'
 * );
 * ```
 */
export function generateQueryMethod(
	queryName: string,
	query: string,
	queryInfo: QueryInfo,
	modelName: string,
	defaultTableName: string = '',
	withDexie: boolean,
	framework: FrameworkType
): string {
	const interfaceName = modelName;
	const tableInterfaceName = `${modelName}Table`;

	let methodName = queryName;
	let methodParams = '';
	let methodBody = '';
	let paramNames: string[] = [];

	// Determine return type based on query type and framework
	const returnType = determineReturnType(queryInfo, interfaceName, query, framework);

	// Build method parameters with better names
	methodParams = generateMethodParameters(queryInfo, query, paramNames);

	// Build method documentation
	let documentation = generateMethodDocumentation(queryName, methodParams, queryInfo, framework);

	// Build method implementation based on framework
	if (framework === 'react') {
		methodBody = generateReactMethodBody(
			queryInfo,
			query,
			defaultTableName,
			paramNames,
			tableInterfaceName,
			withDexie,
			returnType
		);
	} else {
		methodBody = generateAngularMethodBody(
			queryInfo,
			query,
			defaultTableName,
			paramNames,
			tableInterfaceName,
			withDexie
		);
	}

	// Generate method signature based on framework
	if (framework === 'react') {
		return documentation + generateReactMethodSignature(methodName, methodParams, returnType, methodBody);
	} else {
		return documentation + generateAngularMethodSignature(methodName, methodParams, returnType, methodBody);
	}
}

/**
 * Determines the appropriate return type for a query method.
 * 
 * @param queryInfo - Analysis of the query
 * @param interfaceName - Name of the model interface
 * @param query - SQL query string
 * @param framework - Target framework
 * @returns Return type as a string
 * 
 * @internal
 */
function determineReturnType(
	queryInfo: QueryInfo,
	interfaceName: string,
	query: string,
	framework: FrameworkType
): string {
	let baseReturnType: string;

	if (queryInfo.type === 'select') {
		// Special case for COUNT or aggregates
		if (query.toUpperCase().includes('COUNT(')) {
			baseReturnType = 'any[]';
		} else if (queryInfo.returnsMultiple) {
			baseReturnType = `${interfaceName}[]`;
		} else {
			baseReturnType = `${interfaceName} | null`;
		}
	} else if (queryInfo.type === 'insert') {
		baseReturnType = 'number | undefined';
	} else {
		baseReturnType = 'boolean';
	}

	// Framework-specific return type wrapping
	if (framework === 'react') {
		// React hooks return state and actions
		if (queryInfo.type === 'select') {
			return `{
    data: ${baseReturnType};
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
  }`;
		} else {
			// For mutations (insert, update, delete)
			return `{
    mutate: (${generateMutationParams(queryInfo)}) => Promise<${baseReturnType}>;
    loading: boolean;
    error: string | null;
    reset: () => void;
  }`;
		}
	} else {
		// Angular services return Promises
		return `Promise<${baseReturnType}>`;
	}
}

/**
 * Generate mutation parameters for React hooks.
 * 
 * @param queryInfo - Analysis of the query
 * @returns Mutation parameters string
 * 
 * @internal
 */
function generateMutationParams(queryInfo: QueryInfo): string {
	if (queryInfo.namedParams.length > 0) {
		return queryInfo.namedParams.map(param => `${param}: any`).join(', ');
	} else if (queryInfo.positionalParams > 0) {
		const params = Array.from({ length: queryInfo.positionalParams }, (_, i) => `param${i + 1}: any`);
		return params.join(', ');
	}
	return '';
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
 * @param framework - Target framework
 * @returns Generated documentation as a string
 * 
 * @internal
 */
function generateMethodDocumentation(
	queryName: string,
	methodParams: string,
	queryInfo: QueryInfo,
	framework: FrameworkType
): string {
	let documentation = `  /**\n`;

	if (framework === 'react') {
		documentation += `   * React hook for ${queryName} - Custom query\n`;
		if (queryInfo.type === 'select') {
			documentation += `   * Returns data, loading state, error state, and refetch function\n`;
		} else {
			documentation += `   * Returns mutation function, loading state, error state, and reset function\n`;
		}
	} else {
		documentation += `   * ${queryName} - Custom query\n`;
		documentation += `   * Angular service method\n`;
	}

	documentation += `   *\n`;

	if (methodParams) {
		const cleanParams = methodParams.replace(/: any/g, '');
		if (framework === 'react' && queryInfo.type !== 'select') {
			documentation += `   * @param options Optional parameters for the mutation\n`;
		} else {
			documentation += `   * @param ${cleanParams} Parameters for the query\n`;
		}
	}

	let returnDescription = '';
	if (framework === 'react') {
		if (queryInfo.type === 'select') {
			returnDescription = 'Hook state with data, loading, error, and refetch';
		} else {
			returnDescription = 'Hook state with mutate function, loading, error, and reset';
		}
	} else {
		if (queryInfo.returnsMultiple) {
			returnDescription = 'Promise resolving to array of entities';
		} else if (queryInfo.type === 'select') {
			returnDescription = 'Promise resolving to entity or null';
		} else if (queryInfo.type === 'insert') {
			returnDescription = 'Promise resolving to ID of inserted record';
		} else {
			returnDescription = 'Promise resolving to success indicator';
		}
	}

	documentation += `   * @returns ${returnDescription}\n`;
	documentation += `   */\n`;

	return documentation;
}

/**
 * Generate React method signature.
 * 
 * @param methodName - Name of the method
 * @param methodParams - Method parameters
 * @param returnType - Return type
 * @param methodBody - Method body
 * @returns Generated React method signature
 * 
 * @internal
 */
function generateReactMethodSignature(
	methodName: string,
	methodParams: string,
	returnType: string,
	methodBody: string
): string {
	// For React, generate hook functions
	const hookName = `use${methodName.charAt(0).toUpperCase() + methodName.slice(1)}`;

	if (methodParams) {
		return `  const ${hookName} = (${methodParams}): ${returnType} => {\n${methodBody}  };\n\n`;
	} else {
		return `  const ${hookName} = (): ${returnType} => {\n${methodBody}  };\n\n`;
	}
}

/**
 * Generate Angular method signature.
 * 
 * @param methodName - Name of the method
 * @param methodParams - Method parameters
 * @param returnType - Return type
 * @param methodBody - Method body
 * @returns Generated Angular method signature
 * 
 * @internal
 */
function generateAngularMethodSignature(
	methodName: string,
	methodParams: string,
	returnType: string,
	methodBody: string
): string {
	return `  async ${methodName}(${methodParams}): ${returnType} {\n${methodBody}  }\n\n`;
}

/**
 * Generate React method body.
 * 
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param defaultTableName - Default table name
 * @param paramNames - Array of parameter names
 * @param tableInterfaceName - Name of the table interface
 * @param withDexie - Whether to include Dexie.js support
 * @param returnType - Return type of the method
 * @returns Generated React method body
 * 
 * @internal
 */
function generateReactMethodBody(
	queryInfo: QueryInfo,
	query: string,
	defaultTableName: string,
	paramNames: string[],
	tableInterfaceName: string,
	withDexie: boolean,
	returnType: string
): string {
	let methodBody = '';

	if (queryInfo.type === 'select') {
		// Generate React query hook (like react-query pattern)
		methodBody += `    const [data, setData] = React.useState<${getDataType(queryInfo, query)}>(${getInitialDataValue(queryInfo, query)});\n`;
		methodBody += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
		methodBody += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

		methodBody += `    const fetchData = React.useCallback(async () => {\n`;
		methodBody += `      try {\n`;
		methodBody += `        setLoading(true);\n`;
		methodBody += `        setError(null);\n\n`;

		methodBody = withDexie ?
			writeReactMethodWithDexie(methodBody, queryInfo, query, defaultTableName, paramNames, tableInterfaceName) :
			writeReactMethod(methodBody, queryInfo, query, paramNames, tableInterfaceName);

		methodBody += `      } catch (err) {\n`;
		methodBody += `        console.error('Error executing query:', err);\n`;
		methodBody += `        setError(err instanceof Error ? err.message : 'Unknown error');\n`;
		methodBody += `      } finally {\n`;
		methodBody += `        setLoading(false);\n`;
		methodBody += `      }\n`;
		methodBody += `    }, [${paramNames.join(', ')}]);\n\n`;

		methodBody += `    React.useEffect(() => {\n`;
		methodBody += `      fetchData();\n`;
		methodBody += `    }, [fetchData]);\n\n`;

		methodBody += `    return {\n`;
		methodBody += `      data,\n`;
		methodBody += `      loading,\n`;
		methodBody += `      error,\n`;
		methodBody += `      refetch: fetchData\n`;
		methodBody += `    };\n`;
	} else {
		// Generate React mutation hook
		methodBody += `    const [loading, setLoading] = React.useState<boolean>(false);\n`;
		methodBody += `    const [error, setError] = React.useState<string | null>(null);\n\n`;

		methodBody += `    const mutate = React.useCallback(async (${paramNames.map(name => `${name}: any`).join(', ')}) => {\n`;
		methodBody += `      try {\n`;
		methodBody += `        setLoading(true);\n`;
		methodBody += `        setError(null);\n\n`;

		methodBody = withDexie ?
			writeReactMutationWithDexie(methodBody, queryInfo, query, defaultTableName, paramNames, tableInterfaceName) :
			writeReactMutation(methodBody, queryInfo, query, paramNames, tableInterfaceName);

		methodBody += `      } catch (err) {\n`;
		methodBody += `        console.error('Error executing mutation:', err);\n`;
		methodBody += `        setError(err instanceof Error ? err.message : 'Unknown error');\n`;
		methodBody += `        throw err;\n`;
		methodBody += `      } finally {\n`;
		methodBody += `        setLoading(false);\n`;
		methodBody += `      }\n`;
		methodBody += `    }, []);\n\n`;

		methodBody += `    const reset = React.useCallback(() => {\n`;
		methodBody += `      setError(null);\n`;
		methodBody += `    }, []);\n\n`;

		methodBody += `    return {\n`;
		methodBody += `      mutate,\n`;
		methodBody += `      loading,\n`;
		methodBody += `      error,\n`;
		methodBody += `      reset\n`;
		methodBody += `    };\n`;
	}

	return methodBody;
}

/**
 * Generate Angular method body.
 * 
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param defaultTableName - Default table name
 * @param paramNames - Array of parameter names
 * @param tableInterfaceName - Name of the table interface
 * @param withDexie - Whether to include Dexie.js support
 * @returns Generated Angular method body
 * 
 * @internal
 */
function generateAngularMethodBody(
	queryInfo: QueryInfo,
	query: string,
	defaultTableName: string,
	paramNames: string[],
	tableInterfaceName: string,
	withDexie: boolean
): string {
	let methodBody = `    try {\n`;

	methodBody = withDexie ?
		writeMethodWithDexie(methodBody, queryInfo, query, defaultTableName, paramNames, tableInterfaceName) :
		writeMethod(methodBody, queryInfo, query, paramNames, tableInterfaceName, false);

	methodBody += `    } catch (error) {\n`;
	methodBody += `      console.error('Error executing query:', error);\n`;
	methodBody += `      throw error;\n`;
	methodBody += `    }\n`;

	return methodBody;
}

/**
 * Get the data type for React state initialization.
 * 
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @returns Data type string
 * 
 * @internal
 */
function getDataType(queryInfo: QueryInfo, query: string): string {
	if (query.toUpperCase().includes('COUNT(')) {
		return 'any[]';
	} else if (queryInfo.returnsMultiple) {
		return 'any[]';
	} else {
		return 'any | null';
	}
}

/**
 * Get the initial data value for React state.
 * 
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @returns Initial value string
 * 
 * @internal
 */
function getInitialDataValue(queryInfo: QueryInfo, query: string): string {
	if (query.toUpperCase().includes('COUNT(')) {
		return '[]';
	} else if (queryInfo.returnsMultiple) {
		return '[]';
	} else {
		return 'null';
	}
}

/**
 * Write React method implementation with Dexie support.
 * 
 * @param methodBody - Current method body
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param defaultTableName - Default table name
 * @param paramNames - Array of parameter names
 * @param tableInterfaceName - Name of the table interface
 * @returns Updated method body
 * 
 * @internal
 */
function writeReactMethodWithDexie(
	methodBody: string,
	queryInfo: QueryInfo,
	query: string,
	defaultTableName: string,
	paramNames: string[],
	tableInterfaceName: string
): string {
	methodBody += `        if (databaseService.isNativeDatabase()) {\n`;
	methodBody = writeReactMethod(methodBody, queryInfo, query, paramNames, tableInterfaceName, true);

	methodBody += `        } else {\n`;
	methodBody += `          // Dexie implementation\n`;
	methodBody += `          const dexie = databaseService.getDexieInstance();\n`;
	methodBody += `          if (!dexie) throw new Error('Dexie database not initialized');\n\n`;

	const dexieTableName = queryInfo.tableName || defaultTableName;

	if (query.toUpperCase().includes('COUNT(')) {
		methodBody += `          const count = await dexie.${dexieTableName}.count();\n`;
		methodBody += `          setData([{ total: count }]);\n`;
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
			methodBody += `          const entities = await ${dexieQuery};\n`;
			methodBody += `          setData(entities.map((entity: ${tableInterfaceName}) => mapTableToModel(entity)));\n`;
		} else {
			methodBody += `          const entity = await ${dexieQuery};\n`;
			methodBody += `          setData(entity ? mapTableToModel(entity) : null);\n`;
		}
	}

	methodBody += `        }\n`;
	return methodBody;
}

/**
 * Write React method implementation for SQLite.
 * 
 * @param methodBody - Current method body
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param paramNames - Array of parameter names
 * @param tableInterfaceName - Name of the table interface
 * @param withDexie - Whether this is part of a Dexie method
 * @returns Updated method body
 * 
 * @internal
 */
function writeReactMethod(
	methodBody: string,
	queryInfo: QueryInfo,
	query: string,
	paramNames: string[],
	tableInterfaceName: string,
	withDexie: boolean = false
): string {
	const indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	methodBody += `${indent}      // SQLite implementation\n`;
	methodBody += `${indent}      const result = await databaseService.executeQuery(\n`;
	methodBody += `${indent}        \`${query}\`,\n`;

	if (queryInfo.namedParams.length > 0) {
		methodBody += `${indent}        [${queryInfo.namedParams.join(', ')}]\n`;
	} else if (queryInfo.positionalParams > 0) {
		methodBody += `${indent}        [${paramNames.join(', ')}]\n`;
	} else {
		methodBody += `${indent}        []\n`;
	}

	methodBody += `${indent}      );\n\n`;

	if (query.toUpperCase().includes('COUNT(')) {
		methodBody += `${indent}      if (result.values && result.values.length > 0) {\n`;
		methodBody += `${indent}        setData(result.values);\n`;
		methodBody += `${indent}      } else {\n`;
		methodBody += `${indent}        setData([{ total: 0 }]);\n`;
		methodBody += `${indent}      }\n`;
	} else if (queryInfo.returnsMultiple) {
		methodBody += `${indent}      if (result.values && result.values.length > 0) {\n`;
		methodBody += `${indent}        setData(result.values.map((entity: ${tableInterfaceName}) => mapTableToModel(entity)));\n`;
		methodBody += `${indent}      } else {\n`;
		methodBody += `${indent}        setData([]);\n`;
		methodBody += `${indent}      }\n`;
	} else {
		methodBody += `${indent}      if (result.values && result.values.length > 0) {\n`;
		methodBody += `${indent}        setData(mapTableToModel(result.values[0]));\n`;
		methodBody += `${indent}      } else {\n`;
		methodBody += `${indent}        setData(null);\n`;
		methodBody += `${indent}      }\n`;
	}

	return methodBody;
}

/**
 * Write React mutation implementation with Dexie support.
 * 
 * @param methodBody - Current method body
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param defaultTableName - Default table name
 * @param paramNames - Array of parameter names
 * @param tableInterfaceName - Name of the table interface
 * @returns Updated method body
 * 
 * @internal
 */
function writeReactMutationWithDexie(
	methodBody: string,
	queryInfo: QueryInfo,
	query: string,
	defaultTableName: string,
	paramNames: string[],
	tableInterfaceName: string
): string {
	methodBody += `        if (databaseService.isNativeDatabase()) {\n`;
	methodBody = writeReactMutation(methodBody, queryInfo, query, paramNames, tableInterfaceName, true);

	methodBody += `        } else {\n`;
	methodBody += `          // Dexie implementation\n`;
	methodBody += `          const dexie = databaseService.getDexieInstance();\n`;
	methodBody += `          if (!dexie) throw new Error('Dexie database not initialized');\n\n`;
	methodBody += `          // TODO: Implement Dexie equivalent for this custom mutation\n`;
	methodBody += `          throw new Error('Custom ${queryInfo.type} operation not implemented for Dexie');\n`;
	methodBody += `        }\n`;

	return methodBody;
}

/**
 * Write React mutation implementation for SQLite.
 * 
 * @param methodBody - Current method body
 * @param queryInfo - Analysis of the query
 * @param query - SQL query string
 * @param paramNames - Array of parameter names
 * @param tableInterfaceName - Name of the table interface
 * @param withDexie - Whether this is part of a Dexie method
 * @returns Updated method body
 * 
 * @internal
 */
function writeReactMutation(
	methodBody: string,
	queryInfo: QueryInfo,
	query: string,
	paramNames: string[],
	tableInterfaceName: string,
	withDexie: boolean = false
): string {
	const indent = withDexie ? "  ".repeat(3) : "  ".repeat(2);

	methodBody += `${indent}      // SQLite implementation\n`;
	methodBody += `${indent}      const result = await databaseService.executeCommand(\n`;
	methodBody += `${indent}        \`${query}\`,\n`;

	if (queryInfo.namedParams.length > 0) {
		methodBody += `${indent}        [${queryInfo.namedParams.join(', ')}]\n`;
	} else if (queryInfo.positionalParams > 0) {
		methodBody += `${indent}        [${paramNames.join(', ')}]\n`;
	} else {
		methodBody += `${indent}        []\n`;
	}

	methodBody += `${indent}      );\n\n`;

	if (queryInfo.type === 'insert') {
		methodBody += `${indent}      return result.changes?.lastId;\n`;
	} else {
		methodBody += `${indent}      return result.changes?.changes > 0;\n`;
	}

	return methodBody;
}

// Legacy Angular method implementations (unchanged for backward compatibility)
function writeMethodWithDexie(
	methodBody: string,
	queryInfo: QueryInfo,
	query: string,
	defaultTableName: string,
	paramNames: string[],
	tableInterfaceName: string
): string {
	methodBody += `      if (this.databaseService.isNativeDatabase()) {\n`;
	methodBody = writeMethod(methodBody, queryInfo, query, paramNames, tableInterfaceName, true);

	methodBody += `      } else {\n`;
	methodBody += `        // Dexie implementation\n`;
	methodBody += `        const dexie = this.databaseService.getDexieInstance();\n`;
	methodBody += `        if (!dexie) throw new Error('Dexie database not initialized');\n\n`;

	const dexieTableName = queryInfo.tableName || defaultTableName;

	if (queryInfo.type === 'select') {
		if (query.toUpperCase().includes('COUNT(')) {
			methodBody += `        const count = await dexie.${dexieTableName}.count();\n`;
			methodBody += `        return [{ total: count }];\n`;
		} else {
			let dexieQuery = '';
			const whereClause = query.match(/WHERE\s+(.*?)(?:ORDER BY|GROUP BY|LIMIT|$)/is);

			if (whereClause) {
				dexieQuery = `dexie.${dexieTableName}`;

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
				methodBody += `        const entities = await ${dexieQuery};\n`;
				methodBody += `        return entities.map((entity: ${tableInterfaceName}) => this.mapTableToModel(entity));\n`;
			} else {
				methodBody += `        const entity = await ${dexieQuery};\n`;
				methodBody += `        return entity ? this.mapTableToModel(entity) : null;\n`;
			}
		}
	} else {
		methodBody += `        // TODO: Implement Dexie equivalent for this custom query\n`;
		methodBody += `        throw new Error('Custom ${queryInfo.type} operation not implemented for Dexie');\n`;
	}

	methodBody += `      }\n`;
	return methodBody;
}

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
