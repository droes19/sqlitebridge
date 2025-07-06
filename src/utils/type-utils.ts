/**
 * Type Utilities Module
 * 
 * This module provides helper functions for working with TypeScript types
 * and conversions between different naming conventions (camelCase, snake_case, etc.)
 * 
 * @packageDocumentation
 */

/**
 * Converts a string from snake_case to camelCase.
 * 
 * @param str - String in snake_case format
 * @returns String in camelCase format
 * 
 * @example
 * ```typescript
 * // Returns 'userName'
 * const camelCase = snakeToCamelCase('user_name');
 * ```
 */
export function snakeToCamelCase(str: string): string {
	return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts a string from camelCase to snake_case.
 * 
 * @param str - String in camelCase format
 * @returns String in snake_case format
 * 
 * @example
 * ```typescript
 * // Returns 'user_name'
 * const snakeCase = camelToSnakeCase('userName');
 * ```
 */
export function camelToSnakeCase(str: string): string {
	return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Converts a string to PascalCase.
 * 
 * @param str - String to convert
 * @returns String in PascalCase format
 * 
 * @example
 * ```typescript
 * // Returns 'UserName'
 * const pascalCase = toPascalCase('user_name');
 * 
 * // Returns 'UserName'
 * const pascalCase = toPascalCase('userName');
 * ```
 */
export function toPascalCase(str: string): string {
	// First convert to camelCase if it's snake_case
	const camelCase = snakeToCamelCase(str);

	// Then capitalize the first letter
	return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Converts a string to kebab-case.
 * 
 * @param str - String to convert
 * @returns String in kebab-case format
 * 
 * @example
 * ```typescript
 * // Returns 'user-name'
 * const kebabCase = toKebabCase('user_name');
 * 
 * // Returns 'user-name'
 * const kebabCase = toKebabCase('userName');
 * ```
 */
export function toKebabCase(str: string): string {
	// First convert to snake_case if it's camelCase
	const snakeCase = camelToSnakeCase(str);

	// Then replace underscores with hyphens
	return snakeCase.replace(/_/g, '-');
}

/**
 * Converts a string to a valid TypeScript identifier.
 * 
 * @param str - String to convert
 * @returns Valid TypeScript identifier
 * 
 * @example
 * ```typescript
 * // Returns 'user_name'
 * const identifier = toValidIdentifier('user-name');
 * 
 * // Returns '_123'
 * const identifier = toValidIdentifier('123');
 * ```
 */
export function toValidIdentifier(str: string): string {
	// Replace invalid characters with underscores
	let identifier = str.replace(/[^a-zA-Z0-9_$]/g, '_');

	// Ensure it doesn't start with a number
	if (/^[0-9]/.test(identifier)) {
		identifier = '_' + identifier;
	}

	return identifier;
}

/**
 * Checks if a string is a valid TypeScript identifier.
 * 
 * @param str - String to check
 * @returns True if the string is a valid identifier, false otherwise
 * 
 * @example
 * ```typescript
 * // Returns true
 * const isValid = isValidIdentifier('userName');
 * 
 * // Returns false
 * const isValid = isValidIdentifier('user-name');
 * ```
 */
export function isValidIdentifier(str: string): boolean {
	// Valid identifier pattern: starts with letter, underscore, or dollar sign,
	// followed by letters, numbers, underscores, or dollar signs
	return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * Converts a string to a valid TypeScript interface name.
 * 
 * @param str - String to convert
 * @returns Valid TypeScript interface name
 * 
 * @example
 * ```typescript
 * // Returns 'UserName'
 * const interfaceName = toInterfaceName('user_name');
 * ```
 */
export function toInterfaceName(str: string): string {
	// Convert to PascalCase
	return toPascalCase(str);
}

/**
 * Converts a string to a valid TypeScript type.
 * 
 * @param str - String to convert
 * @returns Valid TypeScript type
 * 
 * @example
 * ```typescript
 * // Returns 'string | null'
 * const type = toTypeScriptType('VARCHAR', true);
 * 
 * // Returns 'number'
 * const type = toTypeScriptType('INTEGER', false);
 * ```
 */
export function toTypeScriptType(sqlType: string, isNullable: boolean = false): string {
	let tsType: string;

	// Convert SQL type to TypeScript type
	const lowerType = sqlType.toLowerCase();

	if (lowerType.includes('int') ||
		lowerType.includes('double') ||
		lowerType.includes('float') ||
		lowerType.includes('decimal') ||
		lowerType.includes('numeric')) {
		tsType = 'number';
	} else if (lowerType.includes('char') ||
		lowerType.includes('text') ||
		lowerType.includes('clob') ||
		lowerType.includes('varchar')) {
		tsType = 'string';
	} else if (lowerType.includes('bool')) {
		tsType = 'boolean';
	} else if (lowerType.includes('date') ||
		lowerType.includes('time')) {
		tsType = 'string'; // Using string for dates to match SQLite storage
	} else if (lowerType.includes('blob')) {
		tsType = 'Uint8Array';
	} else {
		tsType = 'any';
	}

	// Add nullable modifier if needed
	if (isNullable) {
		tsType += ' | null';
	}

	return tsType;
}

/**
 * Gets the appropriate TypeScript type for a database column.
 * 
 * @param sqlType - SQL type of the column
 * @param isNullable - Whether the column allows NULL values
 * @param defaultValue - Default value of the column (if any)
 * @returns TypeScript type string
 * 
 * @example
 * ```typescript
 * // Returns 'string'
 * const type = getColumnType('VARCHAR(255)', false);
 * 
 * // Returns 'number | null'
 * const type = getColumnType('INTEGER', true);
 * ```
 */
export function getColumnType(
	sqlType: string,
	isNullable: boolean = false,
	defaultValue?: string
): string {
	// If a default value is provided and the column is not explicitly nullable,
	// we can use the non-nullable type
	if (defaultValue !== undefined && !isNullable) {
		return toTypeScriptType(sqlType, false);
	}

	return toTypeScriptType(sqlType, isNullable);
}

/**
 * Converts a JavaScript value to a SQL literal string.
 * 
 * @param value - JavaScript value to convert
 * @returns SQL literal string
 * 
 * @example
 * ```typescript
 * // Returns "'John'"
 * const sqlValue = toSqlLiteral('John');
 * 
 * // Returns "42"
 * const sqlValue = toSqlLiteral(42);
 * 
 * // Returns "NULL"
 * const sqlValue = toSqlLiteral(null);
 * ```
 */
export function toSqlLiteral(value: any): string {
	if (value === null || value === undefined) {
		return 'NULL';
	} else if (typeof value === 'string') {
		// Escape single quotes
		return `'${value.replace(/'/g, "''")}'`;
	} else if (typeof value === 'boolean') {
		return value ? '1' : '0';
	} else if (value instanceof Date) {
		return `'${value.toISOString()}'`;
	} else {
		return String(value);
	}
}
