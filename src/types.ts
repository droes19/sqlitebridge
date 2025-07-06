/**
 * Core types for SQLite Migration Tools
 */

/**
 * SQL column definition
 */
export interface ColumnDefinition {
	name: string;
	sqlType: string;
	tsType: string;
	isPrimaryKey: boolean;
	isNullable: boolean;
	isUnique: boolean;
	isAutoIncrement: boolean;
	defaultValue?: string;
}

/**
 * Foreign key definition
 */
export interface ForeignKey {
	column: string;
	referenceTable: string;
	referenceColumn: string;
}

/**
 * Table definition
 */
export interface TableDefinition {
	name: string;
	columns: ColumnDefinition[];
	foreignKeys: ForeignKey[];
	indexedColumns: string[];
	originalFile?: string;
}

/**
 * Enum definition
 */
export interface EnumDefinition {
	name: string;
}

/**
 * Schema info containing tables and enums
 */
export interface SchemaInfo {
	tables: Record<string, TableDefinition>;
	enums: EnumDefinition[];
}

/**
 * Alteration definition for ALTER TABLE statements
 */
export interface Alteration {
	tableName: string;
	columnName: string;
	columnInfo: ColumnDefinition;
}

/**
 * SQLite migration definition
 */
export interface Migration {
	/** Version number of this migration */
	version: number;
	/** Human-readable description of what this migration does */
	description: string;
	/** Array of SQL queries to execute for this migration */
	queries: string[];
}

/**
 * Version info from filename
 */
export interface VersionInfo {
	version: number;
	description: string;
}

/**
 * Query type information
 */
export interface QueryInfo {
	type: 'select' | 'insert' | 'update' | 'delete' | 'unknown';
	tableName: string;
	namedParams: string[];
	positionalParams: number;
	returnsMultiple: boolean;
	referencedColumns: string[];
}

/**
 * Version information with tables
 */
export interface Version {
	version: number;
	tables: TableDefinition[];
}

/**
 * File information with parsed schema
 */
export interface FileInfo {
	version: number;
	tables: TableDefinition[];
	alterations?: Alteration[];
}
