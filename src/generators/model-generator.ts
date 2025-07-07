/**
 * Model Generator Module
 * 
 * This module generates TypeScript model interfaces from SQLite migration files.
 * It parses SQL CREATE TABLE statements and generates corresponding TypeScript interfaces
 * with proper typing, documentation, and relationships between models.
 * Supports both Angular and React frameworks with framework-specific optimizations.
 * 
 * @packageDocumentation
 */

import { basename, join } from "node:path";
import { ColumnDefinition, EnumDefinition, SchemaInfo, TableDefinition } from "../types";
import { FrameworkType } from "../config";
import { createLogger } from "../logger";
import * as utils from "../utils";

// Create dedicated logger for model generation
const logger = createLogger('ModelGenerator');

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
 * @param framework - Target framework ('angular' | 'react')
 * 
 * @example
 * ```typescript
 * // Generate models from migrations in the 'migrations' directory for React
 * processModelDirectory('./migrations', './src/models', /^V\d+__.+\.sql$/, 'react');
 * ```
 */
export async function processModelDirectory(
	directoryPath: string,
	outputDir: string,
	pattern: RegExp = /^V\d+__.+\.sql$/,
	framework: FrameworkType
): Promise<void> {
	try {
		// Validate input and create output directory
		if (!validateDirectories(directoryPath, outputDir)) {
			return;
		}

		logger.info(`Processing migration files in ${directoryPath}...`);
		logger.info(`Target framework: ${framework}`);

		// Get all SQL files in the directory
		const files = await utils.getSqlFilesInDirectory(directoryPath, pattern);

		if (files.length === 0) {
			logger.error(`No migration files matching the pattern ${pattern} found in ${directoryPath}.`);
			throw new Error(`No migration files found matching pattern ${pattern}`);
		}

		logger.info(`Found ${files.length} migration files.`);

		// Extract schema information from the migration files
		const schemaInfo = await extractSchemaFromMigrations(files, directoryPath);

		// Generate model files
		await generateModelFiles(schemaInfo, outputDir, framework);

		logger.info(`Successfully generated TypeScript models for ${framework}.`);
		logger.info(`Generated ${Object.keys(schemaInfo.tables).length} table models.`);
		logger.info(`Generated ${schemaInfo.enums.length} enum models.`);
	} catch (error) {
		logger.error('Error processing migration directory:', error);
		throw error;
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
		logger.error(`${inputDir} is not a valid directory.`);
		return false;
	}

	// Create the output directory if it doesn't exist
	if (!utils.ensureDir(outputDir)) {
		logger.error(`Could not create output directory ${outputDir}.`);
		return false;
	}

	logger.debug(`Validated directories - input: ${inputDir}, output: ${outputDir}`);
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

	logger.debug(`Extracting schema from ${files.length} migration files`);

	// Process each file in order
	for (const file of files) {
		const filePath = join(directoryPath, file);
		logger.debug(`Processing: ${file}`);

		const sqlContent = await utils.readFile(filePath);
		if (!sqlContent) {
			logger.warn(`Could not read content from ${file}, skipping`);
			continue;
		}

		// First, parse CREATE TABLE statements
		const { tables, enums } = utils.parseCreateTableStatements(sqlContent, file);
		logger.trace(`Found ${tables.length} tables and ${enums.length} enums in ${file}`);

		// Add tables to schema
		tables.forEach(table => {
			// If table already exists, this means it's being recreated or modified
			// For simplicity, we'll just replace it
			schemaInfo.tables[table.name] = table;
			logger.trace(`Added/updated table: ${table.name}`);
		});

		// Add enums
		schemaInfo.enums.push(...enums);
		if (enums.length > 0) {
			logger.trace(`Added ${enums.length} enums: ${enums.map(e => e.name).join(', ')}`);
		}

		// Then, parse ALTER TABLE statements to update existing tables
		const alterations = utils.parseAlterTableStatements(sqlContent, schemaInfo, file);
		if (alterations.length > 0) {
			logger.debug(`Applied ${alterations.length} table alterations from ${file}`);
		}
	}

	const totalTables = Object.keys(schemaInfo.tables).length;
	const totalEnums = schemaInfo.enums.length;
	logger.info(`Schema extraction complete: ${totalTables} tables, ${totalEnums} enums`);

	return schemaInfo;
}

/**
 * Generates TypeScript model files from schema information.
 * 
 * @param schemaInfo - Schema information with tables and enums
 * @param outputDir - Path to the output directory for generated files
 * @param framework - Target framework ('angular' | 'react')
 * 
 * @internal
 */
async function generateModelFiles(
	schemaInfo: SchemaInfo,
	outputDir: string,
	framework: FrameworkType
): Promise<void> {
	logger.debug('Starting model file generation');

	// Check if any tables have common fields that would benefit from BaseModel
	const tablesWithCommonFields = Object.values(schemaInfo.tables).filter(table =>
		shouldExtendBaseModel(table)
	);

	const shouldCreateBaseModel = tablesWithCommonFields.length > 0;

	if (shouldCreateBaseModel) {
		logger.info(`${tablesWithCommonFields.length} tables will extend BaseModel`);
	}

	// Generate base model if needed
	if (shouldCreateBaseModel) {
		await generateBaseModelFile(outputDir, framework);
	}

	// Generate a file for each table
	logger.debug(`Generating ${Object.keys(schemaInfo.tables).length} table model files`);
	const tablePromises = Object.values(schemaInfo.tables).map(table =>
		generateTableModelFile(table, schemaInfo, outputDir, shouldCreateBaseModel, framework)
	);
	await Promise.all(tablePromises);

	// Generate a file for each enum
	if (schemaInfo.enums.length > 0) {
		logger.debug(`Generating ${schemaInfo.enums.length} enum files`);
		const enumPromises = schemaInfo.enums.map(enumTable =>
			generateEnumFile(enumTable, outputDir, framework)
		);
		await Promise.all(enumPromises);
	}

	// Generate an index file
	await generateIndexFile(schemaInfo, shouldCreateBaseModel, outputDir, framework);

	logger.debug('Model file generation complete');
}

/**
 * Generates the base model file with common fields.
 * 
 * @param outputDir - Path to the output directory
 * @param framework - Target framework
 * 
 * @internal
 */
async function generateBaseModelFile(outputDir: string, framework: FrameworkType): Promise<void> {
	const baseModelPath = join(outputDir, 'base.model.ts');
	logger.debug(`Generating base model file: ${baseModelPath}`);

	const baseModelContent = generateBaseModelContent(framework);

	if (await utils.writeToFile(baseModelPath, baseModelContent)) {
		logger.debug(`Generated base model -> ${baseModelPath}`);
	} else {
		logger.error(`Failed to write base model to ${baseModelPath}`);
		throw new Error(`Failed to generate base model file`);
	}
}

/**
 * Generates a model file for a table.
 * 
 * @param table - Table definition
 * @param schemaInfo - Schema information with all tables and enums
 * @param outputDir - Path to the output directory
 * @param shouldExtendBaseModel - Whether the model should extend BaseModel
 * @param framework - Target framework
 * 
 * @internal
 */
async function generateTableModelFile(
	table: TableDefinition,
	schemaInfo: SchemaInfo,
	outputDir: string,
	shouldExtendBaseModelBool: boolean,
	framework: FrameworkType
): Promise<void> {
	const interfaceName = utils.tableNameToInterfaceName(table.name);
	const fileName = utils.interfaceNameToFileName(interfaceName);
	const filePath = join(outputDir, `${fileName}.ts`);

	logger.debug(`Generating model for table: ${table.name} -> ${interfaceName}`);

	// Check if this table should extend BaseModel
	const extendsBase = shouldExtendBaseModelBool && shouldExtendBaseModel(table);

	const fileContent = generateTypeScriptModelForTable(table, schemaInfo, extendsBase, framework);

	if (await utils.writeToFile(filePath, fileContent)) {
		if (extendsBase) {
			logger.debug(`Generated model for ${table.name} (extends BaseModel) -> ${filePath}`);
		} else {
			logger.debug(`Generated model for ${table.name} -> ${filePath}`);
		}
	} else {
		logger.error(`Failed to write model file for ${table.name} to ${filePath}`);
		throw new Error(`Failed to generate model file for table ${table.name}`);
	}
}

/**
 * Generates an enum file.
 * 
 * @param enumTable - Enum table definition
 * @param outputDir - Path to the output directory
 * @param framework - Target framework
 * 
 * @internal
 */
async function generateEnumFile(
	enumTable: EnumDefinition,
	outputDir: string,
	framework: FrameworkType
): Promise<void> {
	const enumName = enumTable.name.replace(/s$/, ''); // Remove trailing 's' if present
	const pascalCaseName = enumName.charAt(0).toUpperCase() + enumName.slice(1);
	const fileName = utils.interfaceNameToFileName(pascalCaseName);
	const filePath = join(outputDir, `${fileName}.ts`);

	logger.debug(`Generating enum for table: ${enumTable.name} -> ${pascalCaseName}`);

	const fileContent = generateEnumFileContent(enumTable, framework);

	if (await utils.writeToFile(filePath, fileContent)) {
		logger.debug(`Generated enum for ${enumTable.name} -> ${filePath}`);
	} else {
		logger.error(`Failed to write enum file for ${enumTable.name} to ${filePath}`);
		throw new Error(`Failed to generate enum file for ${enumTable.name}`);
	}
}

/**
 * Generates an index file that exports all models.
 * 
 * @param schemaInfo - Schema information with tables and enums
 * @param hasBaseModel - Whether a base model was generated
 * @param outputDir - Path to the output directory
 * @param framework - Target framework
 * 
 * @internal
 */
async function generateIndexFile(
	schemaInfo: SchemaInfo,
	hasBaseModel: boolean,
	outputDir: string,
	framework: FrameworkType
): Promise<void> {
	const indexFilePath = join(outputDir, 'index.ts');
	logger.debug(`Generating index file: ${indexFilePath}`);

	const indexFileContent = generateIndexFileContent(schemaInfo, hasBaseModel, framework);

	if (await utils.writeToFile(indexFilePath, indexFileContent)) {
		logger.debug(`Generated index file -> ${indexFilePath}`);
	} else {
		logger.error(`Failed to write index file to ${indexFilePath}`);
		throw new Error(`Failed to generate index file`);
	}
}

/**
 * Generate index file that exports all models.
 * 
 * @param schema - Schema information containing tables and enums
 * @param hasBaseModel - Whether base.model.ts was generated
 * @param framework - Target framework
 * @returns Generated index file content as a string
 * 
 * @internal
 */
function generateIndexFileContent(
	schema: SchemaInfo,
	hasBaseModel: boolean = false,
	framework: FrameworkType
): string {
	let output = `// Auto-generated index file for SQLite migration models\n`;
	output += `// Generated on ${new Date().toISOString()}\n`;
	output += `// Target framework: ${framework}\n\n`;

	// Add framework-specific comments
	if (framework === 'react') {
		output += `// React TypeScript models for database entities\n`;
		output += `// Compatible with React hooks and state management\n\n`;
	} else {
		output += `// Angular TypeScript models for database entities\n`;
		output += `// Compatible with Angular services and dependency injection\n\n`;
	}

	// Add base model export if it exists
	if (hasBaseModel) {
		output += `export { BaseModel, BaseTable } from './base.model';\n`;
		logger.trace('Added BaseModel exports to index');
	}

	// Add exports for all tables
	const tableCount = Object.keys(schema.tables).length;
	if (tableCount > 0) {
		Object.values(schema.tables).forEach(table => {
			const interfaceName = utils.tableNameToInterfaceName(table.name);
			const fileName = utils.interfaceNameToFileName(interfaceName);

			if (framework === 'react') {
				// For React, also export type aliases that are commonly used
				output += `export type { ${interfaceName}, ${interfaceName}Table } from './${fileName}';\n`;
			} else {
				// For Angular, use regular exports
				output += `export { ${interfaceName}, ${interfaceName}Table } from './${fileName}';\n`;
			}
		});
		logger.trace(`Added ${tableCount} table exports to index`);
	}

	// Add exports for all enums
	if (schema.enums.length > 0) {
		schema.enums.forEach(enumTable => {
			const enumName = enumTable.name.replace(/s$/, ''); // Remove trailing 's' if present
			const pascalCaseName = enumName.charAt(0).toUpperCase() + enumName.slice(1);
			const fileName = utils.interfaceNameToFileName(pascalCaseName);

			if (framework === 'react') {
				output += `export { ${pascalCaseName} } from './${fileName}';\n`;
			} else {
				output += `export { ${pascalCaseName} } from './${fileName}';\n`;
			}
		});
		logger.trace(`Added ${schema.enums.length} enum exports to index`);
	}

	// Add framework-specific utility exports
	if (framework === 'react') {
		output += `\n// React-specific type utilities\n`;
		output += `export type EntityState<T> = {\n`;
		output += `  data: T[];\n`;
		output += `  loading: boolean;\n`;
		output += `  error: string | null;\n`;
		output += `};\n\n`;

		output += `export type EntityItem<T> = {\n`;
		output += `  item: T | null;\n`;
		output += `  loading: boolean;\n`;
		output += `  error: string | null;\n`;
		output += `};\n`;
	}

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
	logger.trace(`Checking if table ${table.name} should extend BaseModel...`);

	// Check if table has id, created_at, and updated_at fields
	const hasId = table.columns.some(col => col.name === 'id');
	const hasCreatedAt = table.columns.some(col => col.name === 'created_at');
	const hasUpdatedAt = table.columns.some(col => col.name === 'updated_at');

	logger.trace(`Table ${table.name} has id: ${hasId}, created_at: ${hasCreatedAt}, updated_at: ${hasUpdatedAt}`);

	const shouldExtend = hasId && hasCreatedAt && hasUpdatedAt;
	if (shouldExtend) {
		logger.debug(`Table ${table.name} will extend BaseModel`);
	}

	return shouldExtend;
}

/**
 * Generate a base model interface with common fields.
 * 
 * This creates a TypeScript interface with common fields like id, createdAt, and updatedAt
 * that can be extended by other models for consistency.
 * 
 * @param framework - Target framework
 * @returns Generated base model content as a string
 * 
 * @internal
 */
function generateBaseModelContent(framework: FrameworkType): string {
	let output = `// Auto-generated TypeScript base model with common fields\n`;
	output += `// Generated on ${new Date().toISOString()}\n`;
	output += `// Target framework: ${framework}\n\n`;

	if (framework === 'react') {
		output += `/**\n * Base interface with common fields for all models\n * Optimized for React applications with hooks and state management\n */\n`;
	} else {
		output += `/**\n * Base interface with common fields for all models\n * Compatible with Angular services and dependency injection\n */\n`;
	}

	output += `export interface BaseModel<IDType = number> {\n`;
	output += `  /** Primary Key */\n`;
	output += `  id: IDType;\n`;
	output += `  /** Creation timestamp */\n`;
	output += `  createdAt: string;\n`;
	output += `  /** Last update timestamp */\n`;
	output += `  updatedAt: string;\n`;
	output += `}\n\n`;

	output += `/**\n * Base interface with snake_case fields for database tables\n`;
	if (framework === 'react') {
		output += ` * Use this when working directly with database responses in React\n`;
	} else {
		output += ` * Use this when working directly with database responses in Angular services\n`;
	}
	output += ` */\n`;

	output += `export interface BaseTable<IDType = number> {\n`;
	output += `  /** Primary Key */\n`;
	output += `  id: IDType;\n`;
	output += `  /** Creation timestamp */\n`;
	output += `  created_at: string;\n`;
	output += `  /** Last update timestamp */\n`;
	output += `  updated_at: string;\n`;
	output += `}\n`;

	// Add framework-specific utilities
	if (framework === 'react') {
		output += `\n/**\n * React hook-friendly base entity state\n */\n`;
		output += `export interface BaseEntityState<T extends BaseModel> {\n`;
		output += `  entities: T[];\n`;
		output += `  selectedEntity: T | null;\n`;
		output += `  loading: boolean;\n`;
		output += `  error: string | null;\n`;
		output += `  lastUpdated: string | null;\n`;
		output += `}\n\n`;

		output += `/**\n * React mutation state for create/update/delete operations\n */\n`;
		output += `export interface MutationState {\n`;
		output += `  loading: boolean;\n`;
		output += `  error: string | null;\n`;
		output += `  success: boolean;\n`;
		output += `}\n`;
	}

	return output;
}

/**
 * Generate TypeScript enum file content.
 * 
 * @param enumTable - Enum table definition
 * @param framework - Target framework
 * @returns Generated enum file content as a string
 * 
 * @internal
 */
function generateEnumFileContent(enumTable: EnumDefinition, framework: FrameworkType): string {
	const enumName = enumTable.name.replace(/s$/, ''); // Remove trailing 's' if present
	const pascalCaseName = enumName.charAt(0).toUpperCase() + enumName.slice(1);

	let output = `// Auto-generated TypeScript enum for ${enumTable.name} table\n`;
	output += `// Generated on ${new Date().toISOString()}\n`;
	output += `// Target framework: ${framework}\n\n`;

	if (framework === 'react') {
		output += `/**\n * Enum for the ${enumTable.name} table\n * React-compatible enum with type safety\n */\n`;
	} else {
		output += `/**\n * Enum for the ${enumTable.name} table\n * Angular-compatible enum for services and components\n */\n`;
	}

	output += `export enum ${pascalCaseName} {\n`;
	output += `  // Note: You'll need to fill in enum values based on your actual data\n`;
	output += `  // Example:\n`;
	output += `  // VALUE_ONE = 'value_one',\n`;
	output += `  // VALUE_TWO = 'value_two',\n`;
	output += `}\n\n`;

	// Add framework-specific utilities
	if (framework === 'react') {
		output += `/**\n * Helper function to get all enum values as an array\n * Useful for React select components or mapping\n */\n`;
		output += `export const get${pascalCaseName}Values = (): ${pascalCaseName}[] => {\n`;
		output += `  return Object.values(${pascalCaseName});\n`;
		output += `};\n\n`;

		output += `/**\n * Helper function to check if a value is a valid enum value\n * Useful for React form validation\n */\n`;
		output += `export const isValid${pascalCaseName} = (value: any): value is ${pascalCaseName} => {\n`;
		output += `  return Object.values(${pascalCaseName}).includes(value);\n`;
		output += `};\n`;
	}

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
 * @param framework - Target framework
 * @returns Generated TypeScript interface content as a string
 * 
 * @internal
 */
function generateTypeScriptModelForTable(
	table: TableDefinition,
	schema: SchemaInfo,
	extendsBaseModel: boolean = false,
	framework: FrameworkType
): string {
	let output = '';

	// Header
	output += `// Auto-generated TypeScript model for the ${table.name} table\n`;
	output += `// Generated on ${new Date().toISOString()}\n`;
	output += `// Target framework: ${framework}\n`;
	if (table.originalFile) {
		output += `// Originally defined in: ${table.originalFile}\n`;
	}
	output += '\n';

	// Import related models
	const imports = generateImports(table, schema, extendsBaseModel);
	if (imports.length > 0) {
		output += imports.join('\n') + '\n\n';
		logger.trace(`Added ${imports.length} imports for ${table.name}`);
	}

	// Interface documentation
	const interfaceName = utils.tableNameToInterfaceName(table.name);

	if (framework === 'react') {
		output += `/**\n * React-compatible interface for the ${table.name} table\n * Optimized for React hooks, state management, and components\n */\n`;
	} else {
		output += `/**\n * Angular-compatible interface for the ${table.name} table\n * Compatible with Angular services and dependency injection\n */\n`;
	}

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
		output += `/**\n * Table interface (snake_case) for the ${table.name} table\n`;
		if (framework === 'react') {
			output += ` * Use this when working directly with database responses in React\n`;
		} else {
			output += ` * Use this when working directly with database responses in Angular services\n`;
		}
		output += ` */\n`;
		output += `export interface ${interfaceName}Table extends BaseTable<${idType}> {\n`;
	} else {
		output += `/**\n * Table interface (snake_case) for the ${table.name} table\n`;
		if (framework === 'react') {
			output += ` * Use this when working directly with database responses in React\n`;
		} else {
			output += ` * Use this when working directly with database responses in Angular services\n`;
		}
		output += ` */\n`;
		output += `export interface ${interfaceName}Table {\n`;
	}

	// Properties in snake_case (original DB column names)
	output += generateTableProperties(table, extendsBaseModel);

	output += `}\n`;

	// Add framework-specific type utilities
	if (framework === 'react') {
		output += generateReactTypeUtilities(interfaceName);
	}

	logger.trace(`Generated complete model interface for ${table.name}`);
	return output;
}

/**
 * Generate React-specific type utilities for a model.
 * 
 * @param interfaceName - Name of the interface
 * @returns Generated React type utilities as a string
 * 
 * @internal
 */
function generateReactTypeUtilities(interfaceName: string): string {
	let output = `\n// React-specific type utilities\n`;

	output += `/**\n * Partial ${interfaceName} for create operations (React forms)\n */\n`;
	output += `export type Create${interfaceName} = Omit<${interfaceName}, 'id' | 'createdAt' | 'updatedAt'>;\n\n`;

	output += `/**\n * Partial ${interfaceName} for update operations (React forms)\n */\n`;
	output += `export type Update${interfaceName} = Partial<Omit<${interfaceName}, 'id' | 'createdAt' | 'updatedAt'>>;\n\n`;

	output += `/**\n * ${interfaceName} with optional fields for React state initialization\n */\n`;
	output += `export type ${interfaceName}State = Partial<${interfaceName}>;\n\n`;

	output += `/**\n * ${interfaceName} form data type for React forms\n */\n`;
	output += `export type ${interfaceName}FormData = {\n`;
	output += `  [K in keyof Create${interfaceName}]: Create${interfaceName}[K] | '';\n`;
	output += `};\n`;

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
		logger.trace(`Added BaseModel import for ${table.name}`);
	}

	// Import related models for foreign keys
	table.foreignKeys.forEach(fk => {
		const refInterfaceName = utils.tableNameToInterfaceName(fk.referenceTable);

		// Only add import if the table actually exists in our schema
		// and it's not self-referencing
		if (schema.tables[fk.referenceTable] && fk.referenceTable !== table.name) {
			imports.push(`import { ${refInterfaceName} } from './${utils.interfaceNameToFileName(refInterfaceName)}';`);
			logger.trace(`Added foreign key import for ${table.name}: ${refInterfaceName}`);
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
	let propertyCount = 0;

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
		propertyCount++;
	});

	logger.trace(`Generated ${propertyCount} camelCase properties for ${table.name}`);
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
	let propertyCount = 0;

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
		propertyCount++;
	});

	logger.trace(`Generated ${propertyCount} snake_case properties for ${table.name}`);
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

	if (table.foreignKeys.length > 0) {
		table.foreignKeys.forEach(fk => {
			const refInterfaceName = utils.tableNameToInterfaceName(fk.referenceTable);
			const camelCaseColumnName = fk.column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

			output += `\n  /**\n   * Relation to ${fk.referenceTable}\n   * @see ${refInterfaceName}\n   */\n`;
			output += `  // ${camelCaseColumnName} references ${fk.referenceTable}(${fk.referenceColumn})\n`;
		});

		logger.trace(`Generated ${table.foreignKeys.length} foreign key comments for ${table.name}`);
	}

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
 * @param framework - Target framework ('angular' | 'react')
 * 
 * @example
 * ```typescript
 * // Generate models from a single migration file for React
 * processModelFile('./migrations/V1__initial_schema.sql', './src/models', 'react');
 * ```
 */
export async function processModelFile(
	sqlFilePath: string,
	outputDir: string,
	framework: FrameworkType
): Promise<void> {
	try {
		// Validate file and create output directory
		if (!(await validateFile(sqlFilePath, outputDir))) {
			return;
		}

		logger.info(`Processing file: ${sqlFilePath}`);
		logger.info(`Target framework: ${framework}`);

		const fileName = basename(sqlFilePath);

		// Extract schema information from the file
		const schemaInfo = await extractSchemaFromFile(sqlFilePath, fileName);

		// Generate model files
		await generateModelFiles(schemaInfo, outputDir, framework);

		logger.info(`Successfully generated TypeScript models for ${framework}.`);
		logger.info(`Generated ${Object.keys(schemaInfo.tables).length} table models.`);
		logger.info(`Generated ${schemaInfo.enums.length} enum models.`);
	} catch (error) {
		logger.error('Error processing file:', error);
		throw error;
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
async function validateFile(sqlFilePath: string, outputDir: string): Promise<boolean> {
	if (!(await utils.checkFileExists(sqlFilePath))) {
		logger.error(`Could not read file ${sqlFilePath}.`);
		return false;
	}

	// Create the output directory if it doesn't exist
	if (!(await utils.ensureDir(outputDir))) {
		logger.error(`Could not create output directory ${outputDir}.`);
		return false;
	}

	logger.debug(`Validated file - input: ${sqlFilePath}, output: ${outputDir}`);
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

	logger.debug(`Extracting schema from single file: ${fileName}`);

	const sqlContent = await utils.readFile(sqlFilePath);
	if (!sqlContent) {
		logger.warn(`Could not read content from ${fileName}`);
		return schemaInfo;
	}

	// Parse CREATE TABLE statements
	const { tables, enums } = utils.parseCreateTableStatements(sqlContent, fileName);
	logger.debug(`Found ${tables.length} tables and ${enums.length} enums in ${fileName}`);

	// Add tables to schema
	tables.forEach(table => {
		schemaInfo.tables[table.name] = table;
		logger.trace(`Added table: ${table.name}`);
	});

	// Add enums
	schemaInfo.enums.push(...enums);
	if (enums.length > 0) {
		logger.trace(`Added ${enums.length} enums: ${enums.map(e => e.name).join(', ')}`);
	}

	// Parse ALTER TABLE statements
	const alterations = utils.parseAlterTableStatements(sqlContent, schemaInfo, fileName);
	if (alterations.length > 0) {
		logger.debug(`Applied ${alterations.length} table alterations from ${fileName}`);
	}

	const totalTables = Object.keys(schemaInfo.tables).length;
	const totalEnums = schemaInfo.enums.length;
	logger.info(`Schema extraction complete: ${totalTables} tables, ${totalEnums} enums`);

	return schemaInfo;
}
