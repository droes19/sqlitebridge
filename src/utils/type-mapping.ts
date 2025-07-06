/**
 * Type mapping utilities for SQLite to TypeScript conversion
 * 
 * This module provides functions to map SQLite data types to appropriate
 * TypeScript types for model generation.
 * 
 * @packageDocumentation
 */

/**
 * Maps SQLite data types to TypeScript types
 * 
 * This function takes a SQLite data type and returns the corresponding
 * TypeScript type that should be used in generated models.
 *
 * | SQLite Type                                   | TypeScript Type |
 * |----------------------------------------------|-----------------|
 * | INTEGER, INT, NUMERIC, REAL, DECIMAL, etc.   | number          |
 * | VARCHAR, TEXT, CHAR, CLOB, etc.              | string          |
 * | BLOB                                         | Buffer          |
 * | BOOLEAN, BOOL                                | boolean         |
 * | DATE, DATETIME, TIME, TIMESTAMP              | string          |
 * | Unknown types                                | any             |
 * 
 * @param sqlType - The SQLite data type (case-insensitive)
 * @returns The corresponding TypeScript type
 * 
 * @example
 * ```typescript
 * const tsType = sqliteToTypeScriptType('INTEGER');
 * // Returns 'number'
 * 
 * const stringType = sqliteToTypeScriptType('VARCHAR(255)');
 * // Returns 'string'
 * ```
 */
export function sqliteToTypeScriptType(sqlType: string): string {
	// Normalize the type for case-insensitive matching
	const type = sqlType.toLowerCase().trim();

	// Handle numeric types
	if (
		type.includes('int') ||
		type.includes('numeric') ||
		type.includes('real') ||
		type.includes('decimal') ||
		type.includes('double') ||
		type.includes('float')
	) {
		return 'number';
	}
	// Handle string types
	else if (
		type.includes('char') ||
		type.includes('text') ||
		type.includes('clob') ||
		type.includes('varchar')
	) {
		return 'string';
	}
	// Handle binary data
	else if (type.includes('blob')) {
		return 'Buffer';
	}
	// Handle boolean types
	else if (type.includes('boolean') || type.includes('bool')) {
		return 'boolean';
	}
	// Handle date/time types - use string as SQLite stores these as strings
	else if (
		type.includes('date') ||
		type.includes('time') ||
		type.includes('timestamp')
	) {
		return 'string'; // Using string instead of Date for SQLite compatibility
	}
	// Fall back to any for unknown types
	else {
		return 'any';
	}
}

/**
 * Maps TypeScript types to SQLite types
 * 
 * This is the reverse mapping of sqliteToTypeScriptType, used when 
 * generating SQL from TypeScript models.
 * 
 * @param tsType - The TypeScript type
 * @returns The corresponding SQLite type
 * 
 * @example
 * ```typescript
 * const sqlType = typeScriptToSqliteType('number');
 * // Returns 'INTEGER'
 * 
 * const textType = typeScriptToSqliteType('string');
 * // Returns 'TEXT'
 * ```
 */
export function typeScriptToSqliteType(tsType: string): string {
	// Normalize the type for case-insensitive matching
	const type = tsType.toLowerCase().trim();

	switch (type) {
		case 'number':
		case 'bigint':
			return 'INTEGER';

		case 'string':
			return 'TEXT';

		case 'boolean':
			return 'INTEGER'; // SQLite doesn't have a native BOOLEAN type

		case 'buffer':
		case 'arraybuffer':
		case 'uint8array':
			return 'BLOB';

		case 'date':
			return 'TEXT'; // SQLite stores dates as TEXT in ISO format

		default:
			return 'TEXT'; // Default to TEXT for unknown types
	}
}

/**
 * Determines if a SQLite type should be represented as a specific JavaScript type
 * when handling data conversion between SQLite and JavaScript objects.
 * 
 * @param sqlType - The SQLite data type
 * @returns The appropriate JavaScript constructor (Number, String, etc.)
 * 
 * @internal
 */
export function sqliteTypeToJsConstructor(sqlType: string): typeof Number | typeof String | typeof Boolean | any {
	const tsType = sqliteToTypeScriptType(sqlType);

	switch (tsType) {
		case 'number':
			return Number;
		case 'string':
			return String;
		case 'boolean':
			return Boolean;
		default:
			return null; // No specific conversion needed
	}
}
