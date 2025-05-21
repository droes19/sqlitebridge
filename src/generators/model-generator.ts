import { basename, join } from "node:path";
import { EnumDefinition, SchemaInfo, TableDefinition } from "../types";
import * as utils from "../utils"

/**
 * Process a directory of migration files and generate separate model files
 * @param directoryPath Path to the directory containing migration files
 * @param outputDir Path to the output directory for generated files
 * @param pattern Regular expression pattern to match migration files
 */
export function processModelDirectory(
    directoryPath: string,
    outputDir: string,
    pattern: RegExp = /^V\d+__.+\.sql$/
): void {
    try {
        // Check if input directory exists
        if (!utils.checkDirExists(directoryPath)) {
            console.error(`Error: ${directoryPath} is not a valid directory.`);
            return;
        }

        // Create the output directory if it doesn't exist
        if (!utils.ensureDir(outputDir)) {
            console.error(`Error: Could not create output directory ${outputDir}.`);
            return;
        }

        console.log(`Processing migration files in ${directoryPath}...`);

        // Get all SQL files in the directory
        const files = utils.getSqlFilesInDirectory(directoryPath, pattern);

        if (files.length === 0) {
            console.error(`No migration files matching the pattern ${pattern} found in ${directoryPath}.`);
            return;
        }

        console.log(`Found ${files.length} migration files.`);

        // Initialize schema info
        const schemaInfo: SchemaInfo = {
            tables: {},
            enums: []
        };

        // Process each file in order
        files.forEach(file => {
            const filePath = join(directoryPath, file);
            console.log(`Processing: ${file}`);

            const sqlContent = utils.readFile(filePath);
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

        // Check if any tables have common fields that would benefit from BaseModel
        const tablesWithCommonFields = Object.values(schemaInfo.tables).filter(table =>
            shouldExtendBaseModel(table)
        );

        const shouldCreateBaseModel = tablesWithCommonFields.length > 0;

        // Generate base model if needed
        if (shouldCreateBaseModel) {
            const baseModelPath = join(outputDir, 'base.model.ts');
            const baseModelContent = generateBaseModelContent();

            if (utils.writeToFile(baseModelPath, baseModelContent)) {
                console.log(`Generated base model -> ${baseModelPath}`);
            }
        }

        // Generate a file for each table
        Object.values(schemaInfo.tables).forEach(table => {
            const interfaceName = utils.tableNameToInterfaceName(table.name);
            const fileName = utils.interfaceNameToFileName(interfaceName);
            const filePath = join(outputDir, `${fileName}.ts`);

            // Check if this table should extend BaseModel
            const extendsBase = shouldCreateBaseModel && shouldExtendBaseModel(table);

            const fileContent = generateTypeScriptModelForTable(table, schemaInfo, extendsBase);
            if (utils.writeToFile(filePath, fileContent)) {
                if (extendsBase) {
                    console.log(`Generated model for ${table.name} (extends BaseModel) -> ${filePath}`);
                } else {
                    console.log(`Generated model for ${table.name} -> ${filePath}`);
                }
            }
        });

        // Generate a file for each enum
        schemaInfo.enums.forEach(enumTable => {
            const enumName = enumTable.name.replace(/s$/, ''); // Remove trailing 's' if present
            const pascalCaseName = enumName.charAt(0).toUpperCase() + enumName.slice(1);
            const fileName = utils.interfaceNameToFileName(pascalCaseName);
            const filePath = join(outputDir, `${fileName}.ts`);

            const fileContent = generateEnumFile(enumTable);
            if (utils.writeToFile(filePath, fileContent)) {
                console.log(`Generated enum for ${enumTable.name} -> ${filePath}`);
            }
        });

        // Generate an index file
        const indexFilePath = join(outputDir, 'index.ts');
        const indexFileContent = generateIndexFile(schemaInfo, shouldCreateBaseModel);
        if (utils.writeToFile(indexFilePath, indexFileContent)) {
            console.log(`Generated index file -> ${indexFilePath}`);
        }

        console.log(`\nSuccessfully generated TypeScript models.`);
        console.log(`Generated ${Object.keys(schemaInfo.tables).length} table models.`);
        console.log(`Generated ${schemaInfo.enums.length} enum models.`);
        if (shouldCreateBaseModel) {
            console.log(`Generated base model with common fields.`);
        }
    } catch (error) {
        console.error('Error processing migration directory:', error);
    }
}

/**
 * Check if a table has common fields that would benefit from extending BaseModel
 * @param table Table definition object
 * @returns True if table has common fields
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
 * Generate a base model interface with common fields
 * @returns Generated base model content
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
 * Generate TypeScript interface for a single table
 * @param table Table definition object
 * @param schema Schema information containing all tables
 * @param extendsBaseModel Whether the model should extend BaseModel
 * @returns Generated TypeScript interface content
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
    const imports: string[] = [];

    // Import BaseModel if extending
    if (extendsBaseModel) {
        imports.push(`import { BaseModel, BaseTable } from './base.model';`);
    }

    table.foreignKeys.forEach(fk => {
        const refInterfaceName = utils.tableNameToInterfaceName(fk.referenceTable);

        // Only add import if the table actually exists in our schema
        // and it's not self-referencing
        if (schema.tables[fk.referenceTable] && fk.referenceTable !== table.name) {
            imports.push(`import { ${refInterfaceName} } from './${utils.interfaceNameToFileName(refInterfaceName)}';`);
        }
    });

    // Add imports at the top if needed
    if (imports.length > 0) {
        output += imports.join('\n') + '\n\n';
    }

    // Interface documentation
    const interfaceName = utils.tableNameToInterfaceName(table.name);
    output += `/**\n * Interface for the ${table.name} table\n */\n`;

    // Check if this table has an ID column with a type different from number
    const idColumn = table.columns.find(col => col.name === 'id' && col.isPrimaryKey);
    const idType = idColumn && idColumn.sqlType.toUpperCase() === 'TEXT' ? 'string' : 'number';

    // Main interface definition (camelCase props)
    if (extendsBaseModel) {
        output += `export interface ${interfaceName} extends BaseModel<${idType}> {\n`;
    } else {
        output += `export interface ${interfaceName} {\n`;
    }

    // Properties in camelCase
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
        const optionalFlag = column.isNullable ? '?' : '';
        const commentParts = [];

        if (column.isPrimaryKey) commentParts.push('Primary Key');
        if (column.isAutoIncrement) commentParts.push('Auto Increment');
        if (column.isUnique) commentParts.push('Unique');
        if (column.defaultValue) commentParts.push(`Default: ${column.defaultValue}`);

        // Add comments if we have any
        if (commentParts.length > 0) {
            output += `  /** ${commentParts.join(', ')} */\n`;
        }

        // Add the property in camelCase
        output += `  ${camelCaseName}${optionalFlag}: ${column.tsType};\n`;
    });

    // Add foreign key comments
    table.foreignKeys.forEach(fk => {
        const refInterfaceName = utils.tableNameToInterfaceName(fk.referenceTable);
        const camelCaseColumnName = fk.column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        output += `\n  /**\n   * Relation to ${fk.referenceTable}\n   * @see ${refInterfaceName}\n   */\n`;
        output += `  // ${camelCaseColumnName} references ${fk.referenceTable}(${fk.referenceColumn})\n`;
    });

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
    table.columns.forEach(column => {
        // Skip common fields if extending BaseTable (id, created_at, updated_at)
        if (extendsBaseModel &&
            (column.name === 'id' ||
                column.name === 'created_at' ||
                column.name === 'updated_at')) {
            return;
        }

        const optionalFlag = column.isNullable ? '?' : '';
        const commentParts = [];

        if (column.isPrimaryKey) commentParts.push('Primary Key');
        if (column.isAutoIncrement) commentParts.push('Auto Increment');
        if (column.isUnique) commentParts.push('Unique');
        if (column.defaultValue) commentParts.push(`Default: ${column.defaultValue}`);

        // Add comments if we have any
        if (commentParts.length > 0) {
            output += `  /** ${commentParts.join(', ')} */\n`;
        }

        // Add the property in snake_case (original DB column name)
        output += `  ${column.name}${optionalFlag}: ${column.tsType};\n`;
    });

    output += `}\n`;

    return output;
}

/**
 * Generate TypeScript enum file
 * @param enumTable Enum table definition
 * @returns Generated enum file content
 */
function generateEnumFile(enumTable: EnumDefinition): string {
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
 * Generate index file that exports all models
 * @param schema Schema information containing tables and enums
 * @param hasBaseModel Whether base.model.ts was generated
 * @returns Generated index file content
 */
function generateIndexFile(schema: SchemaInfo, hasBaseModel: boolean = false): string {
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
 * Process a single migration file and output separate model files
 * @param sqlFilePath Path to the SQL file
 * @param outputDir Path to the output directory for generated files
 */
export function processModelFile(sqlFilePath: string, outputDir: string): void {
    try {
        const sqlContent = utils.readFile(sqlFilePath);
        if (!sqlContent) return;

        console.log(`Processing file: ${sqlFilePath}`);

        // Create the output directory if it doesn't exist
        if (!utils.ensureDir(outputDir)) {
            console.error(`Error: Could not create output directory ${outputDir}.`);
            return;
        }

        const fileName = basename(sqlFilePath);

        // Initialize schema info
        const schemaInfo: SchemaInfo = {
            tables: {},
            enums: []
        };

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

        // Check if any tables have common fields that would benefit from BaseModel
        const tablesWithCommonFields = Object.values(schemaInfo.tables).filter(table =>
            shouldExtendBaseModel(table)
        );

        const shouldCreateBaseModel = tablesWithCommonFields.length > 0;

        // Generate base model if needed
        if (shouldCreateBaseModel) {
            const baseModelPath = join(outputDir, 'base.model.ts');
            const baseModelContent = generateBaseModelContent();

            if (utils.writeToFile(baseModelPath, baseModelContent)) {
                console.log(`Generated base model -> ${baseModelPath}`);
            }
        }

        // Generate a file for each table
        Object.values(schemaInfo.tables).forEach(table => {
            const interfaceName = utils.tableNameToInterfaceName(table.name);
            const fileName = utils.interfaceNameToFileName(interfaceName);
            const filePath = join(outputDir, `${fileName}.ts`);

            // Check if this table should extend BaseModel
            const extendsBase = shouldCreateBaseModel && shouldExtendBaseModel(table);

            const fileContent = generateTypeScriptModelForTable(table, schemaInfo, extendsBase);
            if (utils.writeToFile(filePath, fileContent)) {
                if (extendsBase) {
                    console.log(`Generated model for ${table.name} (extends BaseModel) -> ${filePath}`);
                } else {
                    console.log(`Generated model for ${table.name} -> ${filePath}`);
                }
            }
        });

        // Generate a file for each enum
        schemaInfo.enums.forEach(enumTable => {
            const enumName = enumTable.name.replace(/s$/, ''); // Remove trailing 's' if present
            const pascalCaseName = enumName.charAt(0).toUpperCase() + enumName.slice(1);
            const fileName = utils.interfaceNameToFileName(pascalCaseName);
            const filePath = join(outputDir, `${fileName}.ts`);

            const fileContent = generateEnumFile(enumTable);
            if (utils.writeToFile(filePath, fileContent)) {
                console.log(`Generated enum for ${enumTable.name} -> ${filePath}`);
            }
        });

        // Generate an index file
        const indexFilePath = join(outputDir, 'index.ts');
        const indexFileContent = generateIndexFile(schemaInfo, shouldCreateBaseModel);
        if (utils.writeToFile(indexFilePath, indexFileContent)) {
            console.log(`Generated index file -> ${indexFilePath}`);
        }

        console.log(`\nSuccessfully generated TypeScript models.`);
        console.log(`Generated ${Object.keys(schemaInfo.tables).length} table models.`);
        console.log(`Generated ${schemaInfo.enums.length} enum models.`);
        if (shouldCreateBaseModel) {
            console.log(`Generated base model with common fields.`);
        }
    } catch (error) {
        console.error('Error processing file:', error);
    }
}
