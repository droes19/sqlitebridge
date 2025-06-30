/**
 * Model Generator Module
 * 
 * This module generates TypeScript model interfaces from SQLite migration files.
 * It parses SQL CREATE TABLE statements and generates corresponding TypeScript interfaces
 * with proper typing, documentation, and relationships between models.
 * 
 * @packageDocumentation
 */

import { basename, join } from "node:path";
import { ColumnDefinition, EnumDefinition, SchemaInfo, TableDefinition } from "../types";
import * as utils from "../utils";

/**
 * Process a directory of migration files and generate separate model files.
 * 
 * This function scans a directory for SQL migration files, parses them to extract
 * table definitions, and generates TypeScript model files for each table.
 * It can also detect common fields to create a base model class.
 * 
 * @param directoryPath - Path to the directory containing migration files
 * @param outputDir - Path to the output directory for generated files
 * @param pattern - Regular expression pattern to match migration files (default: /^V\d+__.+\.sql$/)
 * 
 * @example
 * ```typescript
 * // Generate models from migrations in the 'migrations' directory
 * processModelDirectory('./migrations', './src/app/models');
 * ```
 */
export async function processModelDirectory(
	directoryPath: string,
	outputDir: string,
	pattern: RegExp = /^V\d+__.+\.sql$/
): Promise<void> {
	try {
		// Validate input and create output directory
		if (!validateDirectories(directoryPath, outputDir)) {
			return;
		}

		console.log(`Processing migration files in ${directoryPath}...`);

		// Get all SQL files in the directory
		const files = await utils.getSqlFilesInDirectory(directoryPath, pattern);

		if (files.length === 0) {
			console.error(`No migration files matching the pattern ${pattern} found in ${directoryPath}.`);
			return;
		}

		console.log(`Found ${files.length} migration files.`);

		// Extract schema information from the migration files
		const schemaInfo = await extractSchemaFromMigrations(files, directoryPath);

		// Generate model files
		generateModelFiles(schemaInfo, outputDir);

		console.log(`\nSuccessfully generated TypeScript models.`);
		console.log(`Generated ${Object.keys(schemaInfo.tables).length} table models.`);
		console.log(`Generated ${schemaInfo.enums.length} enum models.`);
	} catch (error) {
		console.error('Error processing migration directory:', error);
	}
}

/**
 * Validates that the input directory exists and creates the output directory if needed.
 * 
 * @param inputDir - Path to input directory
 * @param outputDir - Path to output directory
 * @returns True if the directories are valid, false otherwise
 * 
 * @internal
 */
function validateDirectories(inputDir: string, outputDir: string): boolean {
	// Check if input directory exists
	if (!utils.checkDirExists(inputDir)) {
		console.error(`Error: ${inputDir} is not a valid directory.`);
		return false;
	}

	// Create the output directory if it doesn't exist
	if (!utils.ensureDir(outputDir)) {
		console.error(`Error: Could not create output directory ${outputDir}.`);
		return false;
	}

	return true;
}

/**
 * Extracts schema information from migration files.
 * 
 * @param files - Array of migration file names
 * @param directoryPath - Path to the directory containing migration files
 * @returns Schema information with tables and enums
 * 
 * @internal
 */
async function extractSchemaFromMigrations(files: string[], directoryPath: string): Promise<SchemaInfo> {
	// Initialize schema info
	const schemaInfo: SchemaInfo = {
		tables: {},
		enums: []
	};

	// Process each file in order
	files.forEach(async (file) => {
		const filePath = join(directoryPath, file);
		console.log(`Processing: ${file}`);

		const sqlContent = await utils.readFile(filePath);
		if (!sqlContent) return;

		// First, parse CREATE TABLE statements
		const { tables, enums } = utils.parseCreateTableStatements(sqlContent, file);

		// Add tables to schema
		tables.forEach(table => {
			// If table already exists, this means it's being recreated or modified
			// For simplicity, we'll just replace it
			schemaInfo.tables[table.name] = table;
		});

		// Add enums
		schemaInfo.enums.push(...enums);

		// Then, parse ALTER TABLE statements to update existing tables
		utils.parseAlterTableStatements(sqlContent, schemaInfo, file);
	});

	return schemaInfo;
}

/**
 * Generates TypeScript model files from schema information.
 * 
 * @param schemaInfo - Schema information with tables and enums
 * @param outputDir - Path to the output directory for generated files
 * 
 * @internal
 */
function generateModelFiles(schemaInfo: SchemaInfo, outputDir: string): void {
	// Check if any tables have common fields that would benefit from BaseModel
	const tablesWithCommonFields = Object.values(schemaInfo.tables).filter(table =>
		shouldExtendBaseModel(table)
	);

	const shouldCreateBaseModel = tablesWithCommonFields.length > 0;

	// Generate base model if needed
	if (shouldCreateBaseModel) {
		generateBaseModelFile(outputDir);
	}

	// Generate a file for each table
	Object.values(schemaInfo.tables).forEach(table => {
		generateTableModelFile(table, schemaInfo, outputDir, shouldCreateBaseModel);
	});

	// Generate a file for each enum
	schemaInfo.enums.forEach(enumTable => {
		generateEnumFile(enumTable, outputDir);
	});

	// Generate an index file
	generateIndexFile(schemaInfo, shouldCreateBaseModel, outputDir);
}

/**
 * Generates the base model file with common fields.
 * 
 * @param outputDir - Path to the output directory
 * 
 * @internal
 */
async function generateBaseModelFile(outputDir: string): Promise<void> {
	const baseModelPath = join(outputDir, 'base.model.ts');
	const baseModelContent = generateBaseModelContent();

	if (await utils.writeToFile(baseModelPath, baseModelContent)) {
		console.log(`Generated base model -> ${baseModelPath}`);
	}
}

/**
 * Generates a model file for a table.
 * 
 * @param table - Table definition
 * @param schemaInfo - Schema information with all tables and enums
 * @param outputDir - Path to the output directory
 * @param shouldExtendBaseModel - Whether the model should extend BaseModel
 * 
 * @internal
 */
async function generateTableModelFile(
	table: TableDefinition,
	schemaInfo: SchemaInfo,
	outputDir: string,
	shouldExtendBaseModelBool: boolean
): Promise<void> {
	const interfaceName = utils.tableNameToInterfaceName(table.name);
	const fileName = utils.interfaceNameToFileName(interfaceName);
	const filePath = join(outputDir, `${fileName}.ts`);

	// Check if this table should extend BaseModel
	const extendsBase = shouldExtendBaseModelBool && shouldExtendBaseModel(table);

	const fileContent = generateTypeScriptModelForTable(table, schemaInfo, extendsBase);
	if (await utils.writeToFile(filePath, fileContent)) {
		if (extendsBase) {
			console.log(`Generated model for ${table.name} (extends BaseModel) -> ${filePath}`);
		} else {
			console.log(`Generated model for ${table.name} -> ${filePath}`);
		}
	}
}

/**
 * Generates an enum file.
 * 
 * @param enumTable - Enum table definition
 * @param outputDir - Path to the output directory
 * 
 * @internal
 */
async function generateEnumFile(enumTable: EnumDefinition, outputDir: string): Promise<void> {
	const enumName = enumTable.name.replace(/s$/, ''); // Remove trailing 's' if present
	const pascalCaseName = enumName.charAt(0).toUpperCase() + enumName.slice(1);
	const fileName = utils.interfaceNameToFileName(pascalCaseName);
	const filePath = join(outputDir, `${fileName}.ts`);

	const fileContent = generateEnumFileContent(enumTable);
	if (await utils.writeToFile(filePath, fileContent)) {
		console.log(`Generated enum for ${enumTable.name} -> ${filePath}`);
	}
}

/**
 * Generates an index file that exports all models.
 * 
 * @param schemaInfo - Schema information with tables and enums
 * @param hasBaseModel - Whether a base model was generated
 * @param outputDir - Path to the output directory
 * 
 * @internal
 */
async function generateIndexFile(
	schemaInfo: SchemaInfo,
	hasBaseModel: boolean,
	outputDir: string
): Promise<void> {
	const indexFilePath = join(outputDir, 'index.ts');
	const indexFileContent = generateIndexFileContent(schemaInfo, hasBaseModel);
	if (await utils.writeToFile(indexFilePath, indexFileContent)) {
		console.log(`Generated index file -> ${indexFilePath}`);
	}
}

/**
 * Generate index file that exports all models.
 * 
 * @param schema - Schema information containing tables and enums
 * @param hasBaseModel - Whether base.model.ts was generated
 * @returns Generated index file content as a string
 * 
 * @internal
 */
function generateIndexFileContent(schema: SchemaInfo, hasBaseModel: boolean = false): string {
	let output = '// Auto-generated index file for SQLite migration models\n';
	output += `// Generated on ${new Date().toISOString()}\n\n`;

	// Add base model export if it exists
	if (hasBaseModel) {
		output += `export { BaseModel, BaseTable } from './base.model';\n`;
	}

	// Add exports for all tables
	Object.values(schema.tables).forEach(table => {
		const interfaceName = utils.tableNameToInterfaceName(table.name);
		const fileName = utils.interfaceNameToFileName(interfaceName);
		output += `export { ${interfaceName}, ${interfaceName}Table } from './${fileName}';\n`;
	});

	// Add exports for all enums
	schema.enums.forEach(enumTable => {
		const enumName = enumTable.name.replace(/s$/, ''); // Remove trailing 's' if present
		const pascalCaseName = enumName.charAt(0).toUpperCase() + enumName.slice(1);
		const fileName = utils.interfaceNameToFileName(pascalCaseName);
		output += `export { ${pascalCaseName} } from './${fileName}';\n`;
	});

	return output;
}

/**
 * Check if a table has common fields that would benefit from extending BaseModel.
 * 
 * A table is considered suitable for extending BaseModel if it has id, created_at,
 * and updated_at fields, which are common in most database tables.
 * 
 * @param table - Table definition object
 * @returns True if table has common fields
 * 
 * @internal
 */
function shouldExtendBaseModel(table: TableDefinition): boolean {
	console.log(`Checking if table ${table.name} should extend BaseModel...`);
	// Check if table has id, created_at, and updated_at fields
	const hasId = table.columns.some(col => col.name === 'id');
	const hasCreatedAt = table.columns.some(col => col.name === 'created_at');
	const hasUpdatedAt = table.columns.some(col => col.name === 'updated_at');

	console.log(`Table ${table.name} has id: ${hasId}, created_at: ${hasCreatedAt}, updated_at: ${hasUpdatedAt}`);
	return hasId && hasCreatedAt && hasUpdatedAt;
}

/**
 * Generate a base model interface with common fields.
 * 
 * This creates a TypeScript interface with common fields like id, createdAt, and updatedAt
 * that can be extended by other models for consistency.
 * 
 * @returns Generated base model content as a string
 * 
 * @internal
 */
function generateBaseModelContent(): string {
	let output = `// Auto-generated TypeScript base model with common fields\n`;
	output += `// Generated on ${new Date().toISOString()}\n\n`;

	output += `/**\n * Base interface with common fields for all models\n */\n`;
	output += `export interface BaseModel<IDType = number> {\n`;
	output += `  /** Primary Key */\n`;
	output += `  id: IDType;\n`;
	output += `  /** Creation timestamp */\n`;
	output += `  createdAt: string;\n`;
	output += `  /** Last update timestamp */\n`;
	output += `  updatedAt: string;\n`;
	output += `}\n\n`;

	output += `/**\n * Base interface with snake_case fields for database tables\n */\n`;
	output += `export interface BaseTable<IDType = number> {\n`;
	output += `  /** Primary Key */\n`;
	output += `  id: IDType;\n`;
	output += `  /** Creation timestamp */\n`;
	output += `  created_at: string;\n`;
	output += `  /** Last update timestamp */\n`;
	output += `  updated_at: string;\n`;
	output += `}\n`;

	return output;
}

/**
 * Generate TypeScript enum file content.
 * 
 * @param enumTable - Enum table definition
 * @returns Generated enum file content as a string
 * 
 * @internal
 */
function generateEnumFileContent(enumTable: EnumDefinition): string {
	const enumName = enumTable.name.replace(/s$/, ''); // Remove trailing 's' if present
	const pascalCaseName = enumName.charAt(0).toUpperCase() + enumName.slice(1);

	let output = `// Auto-generated TypeScript enum for ${enumTable.name} table\n`;
	output += `// Generated on ${new Date().toISOString()}\n\n`;

	output += `/**\n * Enum for the ${enumTable.name} table\n */\n`;
	output += `export enum ${pascalCaseName} {\n`;
	output += `  // Note: You'll need to fill in enum values based on your actual data\n`;
	output += `  // Example:\n`;
	output += `  // VALUE_ONE = 'value_one',\n`;
	output += `  // VALUE_TWO = 'value_two',\n`;
	output += `}\n`;

	return output;
}

/**
 * Generate TypeScript interface for a single table.
 * 
 * This function creates TypeScript interfaces for a database table,
 * including both camelCase (for the application) and snake_case (for the database) versions.
 * 
 * @param table - Table definition object
 * @param schema - Schema information containing all tables
 * @param extendsBaseModel - Whether the model should extend BaseModel
 * @returns Generated TypeScript interface content as a string
 * 
 * @internal
 */
function generateTypeScriptModelForTable(
	table: TableDefinition,
	schema: SchemaInfo,
	extendsBaseModel: boolean = false
): string {
	let output = '';

	// Header
	output += `// Auto-generated TypeScript model for the ${table.name} table\n`;
	output += `// Generated on ${new Date().toISOString()}\n`;
	if (table.originalFile) {
		output += `// Originally defined in: ${table.originalFile}\n`;
	}
	output += '\n';

	// Import related models
	const imports = generateImports(table, schema, extendsBaseModel);
	if (imports.length > 0) {
		output += imports.join('\n') + '\n\n';
	}

	// Interface documentation
	const interfaceName = utils.tableNameToInterfaceName(table.name);
	output += `/**\n * Interface for the ${table.name} table\n */\n`;

	// Check if this table has an ID column with a type different from number
	const idColumn = table.columns.find(col => col.name === 'id' && col.isPrimaryKey);
	const idType = idColumn && idColumn.sqlType.toUpperCase() === 'TEXT' ? 'string | undefined' : 'number | undefined';

	// Main interface definition (camelCase props)
	if (extendsBaseModel) {
		output += `export interface ${interfaceName} extends BaseModel<${idType}> {\n`;
	} else {
		output += `export interface ${interfaceName} {\n`;
	}

	// Properties in camelCase
	output += generateModelProperties(table, extendsBaseModel);

	// Add foreign key comments
	output += generateForeignKeyComments(table);

	output += `}\n\n`;

	// Table interface documentation (snake_case props for direct DB access)
	if (extendsBaseModel) {
		output += `/**\n * Table interface (snake_case) for the ${table.name} table\n */\n`;
		output += `export interface ${interfaceName}Table extends BaseTable<${idType}> {\n`;
	} else {
		output += `/**\n * Table interface (snake_case) for the ${table.name} table\n */\n`;
		output += `export interface ${interfaceName}Table {\n`;
	}

	// Properties in snake_case (original DB column names)
	output += generateTableProperties(table, extendsBaseModel);

	output += `}\n`;

	return output;
}

/**
 * Generate import statements for a table model.
 * 
 * @param table - Table definition
 * @param schema - Schema information
 * @param extendsBaseModel - Whether the model extends BaseModel
 * @returns Array of import statements
 * 
 * @internal
 */
function generateImports(
	table: TableDefinition,
	schema: SchemaInfo,
	extendsBaseModel: boolean
): string[] {
	const imports: string[] = [];

	// Import BaseModel if extending
	if (extendsBaseModel) {
		imports.push(`import { BaseModel, BaseTable } from './base.model';`);
	}

	// Import related models for foreign keys
	table.foreignKeys.forEach(fk => {
		const refInterfaceName = utils.tableNameToInterfaceName(fk.referenceTable);

		// Only add import if the table actually exists in our schema
		// and it's not self-referencing
		if (schema.tables[fk.referenceTable] && fk.referenceTable !== table.name) {
			imports.push(`import { ${refInterfaceName} } from './${utils.interfaceNameToFileName(refInterfaceName)}';`);
		}
	});

	return imports;
}

/**
 * Generate model properties in camelCase.
 * 
 * @param table - Table definition
 * @param extendsBaseModel - Whether the model extends BaseModel
 * @returns Generated properties as a string
 * 
 * @internal
 */
function generateModelProperties(table: TableDefinition, extendsBaseModel: boolean): string {
	let output = '';

	table.columns.forEach(column => {
		// Skip common fields if extending BaseModel (id, created_at, updated_at)
		if (extendsBaseModel &&
			(column.name === 'id' ||
				column.name === 'created_at' ||
				column.name === 'updated_at')) {
			return;
		}

		// Convert snake_case to camelCase for interface properties
		const camelCaseName = column.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
		const optionalFlag = column.isNullable || camelCaseName === "id" ? '?' : '';

		// Generate property comment
		output += generatePropertyComment(column);

		// Add the property in camelCase
		output += `  ${camelCaseName}${optionalFlag}: ${column.tsType};\n`;
	});

	return output;
}

/**
 * Generate table properties in snake_case.
 * 
 * @param table - Table definition
 * @param extendsBaseModel - Whether the model extends BaseModel
 * @returns Generated properties as a string
 * 
 * @internal
 */
function generateTableProperties(table: TableDefinition, extendsBaseModel: boolean): string {
	let output = '';

	table.columns.forEach(column => {
		// Skip common fields if extending BaseTable (id, created_at, updated_at)
		if (extendsBaseModel &&
			(column.name === 'id' ||
				column.name === 'created_at' ||
				column.name === 'updated_at')) {
			return;
		}

		const optionalFlag = column.isNullable || column.name === 'id' ? '?' : '';

		// Generate property comment
		output += generatePropertyComment(column);

		// Add the property in snake_case (original DB column name)
		output += `  ${column.name}${optionalFlag}: ${column.tsType};\n`;
	});

	return output;
}

/**
 * Generate JSDoc comment for a column property.
 * 
 * @param column - Column definition
 * @returns Generated comment as a string
 * 
 * @internal
 */
function generatePropertyComment(column: ColumnDefinition): string {
	const commentParts = [];

	if (column.isPrimaryKey) commentParts.push('Primary Key');
	if (column.isAutoIncrement) commentParts.push('Auto Increment');
	if (column.isUnique) commentParts.push('Unique');
	if (column.defaultValue) commentParts.push(`Default: ${column.defaultValue}`);

	// Add comments if we have any
	if (commentParts.length > 0) {
		return `  /** ${commentParts.join(', ')} */\n`;
	}

	return '';
}

/**
 * Generate foreign key comments for a table.
 * 
 * @param table - Table definition
 * @returns Generated foreign key comments as a string
 * 
 * @internal
 */
function generateForeignKeyComments(table: TableDefinition): string {
	let output = '';

	table.foreignKeys.forEach(fk => {
		const refInterfaceName = utils.tableNameToInterfaceName(fk.referenceTable);
		const camelCaseColumnName = fk.column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

		output += `\n  /**\n   * Relation to ${fk.referenceTable}\n   * @see ${refInterfaceName}\n   */\n`;
		output += `  // ${camelCaseColumnName} references ${fk.referenceTable}(${fk.referenceColumn})\n`;
	});

	return output;
}

/**
 * Process a single migration file and output separate model files.
 * 
 * This function parses a single SQL migration file, extracts table definitions,
 * and generates TypeScript model files for each table.
 * 
 * @param sqlFilePath - Path to the SQL file
 * @param outputDir - Path to the output directory for generated files
 * 
 * @example
 * ```typescript
 * // Generate models from a single migration file
 * processModelFile('./migrations/V1__initial_schema.sql', './src/app/models');
 * ```
 */
export async function processModelFile(sqlFilePath: string, outputDir: string): Promise<void> {
	try {
		// Validate file and create output directory
		if (!validateFile(sqlFilePath, outputDir)) {
			return;
		}

		console.log(`Processing file: ${sqlFilePath}`);

		const fileName = basename(sqlFilePath);

		// Extract schema information from the file
		const schemaInfo = await extractSchemaFromFile(sqlFilePath, fileName);

		// Generate model files
		generateModelFiles(schemaInfo, outputDir);

		console.log(`\nSuccessfully generated TypeScript models.`);
		console.log(`Generated ${Object.keys(schemaInfo.tables).length} table models.`);
		console.log(`Generated ${schemaInfo.enums.length} enum models.`);
	} catch (error) {
		console.error('Error processing file:', error);
	}
}

/**
 * Validates that the input file exists and creates the output directory if needed.
 * 
 * @param sqlFilePath - Path to SQL file
 * @param outputDir - Path to output directory
 * @returns True if the file exists and output directory is valid, false otherwise
 * 
 * @internal
 */
function validateFile(sqlFilePath: string, outputDir: string): boolean {
	const sqlContent = utils.readFile(sqlFilePath);
	if (!sqlContent) {
		console.error(`Error: Could not read file ${sqlFilePath}.`);
		return false;
	}

	// Create the output directory if it doesn't exist
	if (!utils.ensureDir(outputDir)) {
		console.error(`Error: Could not create output directory ${outputDir}.`);
		return false;
	}

	return true;
}

/**
 * Extracts schema information from a single file.
 * 
 * @param sqlFilePath - Path to SQL file
 * @param fileName - Name of the SQL file
 * @returns Schema information with tables and enums
 * 
 * @internal
 */
async function extractSchemaFromFile(sqlFilePath: string, fileName: string): Promise<SchemaInfo> {
	// Initialize schema info
	const schemaInfo: SchemaInfo = {
		tables: {},
		enums: []
	};

	const sqlContent = await utils.readFile(sqlFilePath);
	if (!sqlContent) return schemaInfo;

	// Parse CREATE TABLE statements
	const { tables, enums } = utils.parseCreateTableStatements(sqlContent, fileName);

	// Add tables to schema
	tables.forEach(table => {
		schemaInfo.tables[table.name] = table;
	});

	// Add enums
	schemaInfo.enums.push(...enums);

	// Parse ALTER TABLE statements
	utils.parseAlterTableStatements(sqlContent, schemaInfo, fileName);

	return schemaInfo;
}
