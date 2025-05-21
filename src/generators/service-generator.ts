/**
 * Service Generator Module
 * 
 * This module generates Angular service classes for database operations based on
 * SQL migration files and custom query files. It creates strongly-typed services
 * that provide CRUD operations and custom queries for each table.
 * 
 * @packageDocumentation
 */

import * as utils from '../utils';
import { SchemaInfo, TableDefinition } from '../types';
import { basename, join } from 'node:path';
import * as service_utils from './service-utils';

/**
 * Process a directory of query files and generate service files.
 * 
 * This function scans directories for SQL migration files and query files,
 * then generates Angular service classes for each table with CRUD operations
 * and custom queries. It automatically maps between query tables and schema tables.
 * 
 * @param queriesDir - Path to directory containing query files
 * @param migrationsDir - Path to directory containing migration files
 * @param outputDir - Path to output directory for generated services
 * @param withDexie - Whether to include Dexie.js support in the services
 * @param pattern - Regular expression pattern to match migration files (default: /^V\d+__.+\.sql$/)
 * 
 * @example
 * ```typescript
 * // Generate services from queries in 'queries' directory and migrations in 'migrations' directory
 * processServiceDirectory('./queries', './migrations', './src/app/services', true);
 * ```
 */
export function processServiceDirectory(
    queriesDir: string,
    migrationsDir: string,
    outputDir: string,
    withDexie: boolean,
    pattern: RegExp = /^V\d+__.+\.sql$/
): void {
    try {
        // Check if directories exist
        if (!utils.checkDirExists(queriesDir)) {
            console.error(`Error: Queries directory ${queriesDir} is not a valid directory.`);
            return;
        }

        if (!utils.checkDirExists(migrationsDir)) {
            console.error(`Error: Migrations directory ${migrationsDir} is not a valid directory.`);
            return;
        }

        // Create output directory if it doesn't exist
        if (!utils.ensureDir(outputDir)) {
            console.error(`Error: Could not create output directory ${outputDir}.`);
            return;
        }

        console.log(`Processing query files in ${queriesDir}...`);

        // Get all SQL files in the queries directory
        const queryFiles = utils.getSqlFilesInDirectory(queriesDir);

        if (queryFiles.length === 0) {
            console.error(`No SQL files found in ${queriesDir}.`);
            return;
        }

        console.log(`Found ${queryFiles.length} query files.`);

        // Parse migration files to get table definitions
        const schemaInfo = parseSchemaFromMigrations(migrationsDir, pattern);

        // Create a mapping between query table names and actual schema table names
        const tableNameMap = createTableNameMapping(schemaInfo, queryFiles, queriesDir);

        // Process each query file
        queryFiles.forEach(queryFile => {
            processQueryFile(queryFile, queriesDir, schemaInfo, tableNameMap, outputDir, withDexie);
        });

        console.log(`\nSuccessfully generated service files with custom queries in ${outputDir}`);
    } catch (error) {
        console.error('Error processing query directory:', error);
    }
}

/**
 * Parse migration files to extract schema information.
 * 
 * @param migrationsDir - Path to directory containing migration files
 * @param pattern - Regular expression pattern to match migration files
 * @returns Schema information with tables and enums
 * 
 * @internal
 */
function parseSchemaFromMigrations(migrationsDir: string, pattern: RegExp): SchemaInfo {
    const schemaInfo: SchemaInfo = {
        tables: {},
        enums: []
    };

    const migrationFiles = utils.getSqlFilesInDirectory(migrationsDir, pattern);
    console.log(`Found ${migrationFiles.length} migration files.`);

    migrationFiles.forEach(file => {
        const filePath = join(migrationsDir, file);
        console.log(`Processing migration file: ${file}`);
        const sqlContent = utils.readFile(filePath);
        if (!sqlContent) return;

        // Parse tables
        const { tables, enums } = utils.parseCreateTableStatements(sqlContent, file);

        // Add tables to schema
        tables.forEach(table => {
            schemaInfo.tables[table.name] = table;
        });

        // Add enums
        schemaInfo.enums.push(...enums);

        // Process ALTER TABLE statements
        utils.parseAlterTableStatements(sqlContent, schemaInfo, file);
    });

    return schemaInfo;
}

/**
 * Create a mapping between query table names and actual schema table names.
 * 
 * @param schemaInfo - Schema information with tables and enums
 * @param queryFiles - Array of query file names
 * @param queriesDir - Path to directory containing query files
 * @returns Mapping from query table names to schema table names
 * 
 * @internal
 */
function createTableNameMapping(
    schemaInfo: SchemaInfo,
    queryFiles: string[],
    queriesDir: string
): Record<string, string> {
    const tableNameMap: Record<string, string> = {};
    
    // Build all possible variations of table names for matching
    const tableVariations = buildTableNameVariations(schemaInfo);

    // Scan all query files to build the table name mapping
    queryFiles.forEach(queryFile => {
        const filePath = join(queriesDir, queryFile);
        const sqlContent = utils.readFile(filePath);
        if (!sqlContent) return;

        const namedQueries = utils.extractNamedQueries(sqlContent);

        // Extract table names from queries
        Object.values(namedQueries).forEach(query => {
            const queryInfo = utils.analyzeQuery(query);
            if (queryInfo.tableName && queryInfo.tableName.length > 0) {
                // Map the query table name to a schema table name
                if (!tableNameMap[queryInfo.tableName]) {
                    const matchedTable = tableVariations[queryInfo.tableName];
                    if (matchedTable) {
                        tableNameMap[queryInfo.tableName] = matchedTable;
                        console.log(`Mapped query table '${queryInfo.tableName}' to schema table '${matchedTable}'`);
                    } else {
                        console.warn(`Warning: Could not find matching schema table for query table '${queryInfo.tableName}'`);
                    }
                }
            }
        });
    });

    return tableNameMap;
}

/**
 * Build variations of table names for matching between queries and schema.
 * 
 * @param schemaInfo - Schema information with tables and enums
 * @returns Mapping from table name variations to actual table names
 * 
 * @internal
 */
function buildTableNameVariations(schemaInfo: SchemaInfo): Record<string, string> {
    const tableVariations: Record<string, string> = {};
    
    Object.keys(schemaInfo.tables).forEach(tableName => {
        // Store original name
        tableVariations[tableName] = tableName;

        // Add singular form if plural
        if (tableName.endsWith('s')) {
            const singularName = tableName.slice(0, -1);
            tableVariations[singularName] = tableName;
        }
        // Add plural form if singular
        else {
            const pluralName = `${tableName}s`;
            tableVariations[pluralName] = tableName;
        }

        // Handle special cases like 'y' -> 'ies'
        if (tableName.endsWith('y')) {
            const pluralIesName = `${tableName.slice(0, -1)}ies`;
            tableVariations[pluralIesName] = tableName;
        }
    });

    return tableVariations;
}

/**
 * Process a single query file and generate a service.
 * 
 * @param queryFile - Name of the query file
 * @param queriesDir - Path to directory containing query files
 * @param schemaInfo - Schema information with tables and enums
 * @param tableNameMap - Mapping from query table names to schema table names
 * @param outputDir - Path to output directory
 * @param withDexie - Whether to include Dexie.js support
 * 
 * @internal
 */
function processQueryFile(
    queryFile: string,
    queriesDir: string,
    schemaInfo: SchemaInfo,
    tableNameMap: Record<string, string>,
    outputDir: string,
    withDexie: boolean
): void {
    const filePath = join(queriesDir, queryFile);
    console.log(`Processing query file: ${queryFile}`);

    // Find the table for this query file
    const tableInfo = findTableForQueryFile(queryFile, schemaInfo, tableNameMap, filePath);
    
    if (!tableInfo.table) {
        console.warn(`Warning: Could not find table for query file ${queryFile}. Skipping.`);
        return;
    }

    const tableName = tableInfo.tableName;
    console.log(`Found table ${tableName} for query file ${queryFile}`);

    // Read and process the query file
    const sqlContent = utils.readFile(filePath);
    if (!sqlContent) return;

    const namedQueries = utils.extractNamedQueries(sqlContent);

    if (Object.keys(namedQueries).length === 0) {
        console.warn(`Warning: No named queries found in ${queryFile}. Skipping.`);
        return;
    }

    console.log(`Found ${Object.keys(namedQueries).length} named queries in ${queryFile}.`);

    // Process queries and transform table names
    const processedQueries = processQueries(namedQueries, tableNameMap);

    // Generate service file
    generateServiceFile(tableName, tableInfo.table, processedQueries, tableNameMap, outputDir, withDexie);
}

/**
 * Find the table corresponding to a query file.
 * 
 * @param queryFile - Name of the query file
 * @param schemaInfo - Schema information with tables and enums
 * @param tableNameMap - Mapping from query table names to schema table names
 * @param filePath - Path to the query file
 * @returns Object with table definition and table name, or null table if not found
 * 
 * @internal
 */
function findTableForQueryFile(
    queryFile: string,
    schemaInfo: SchemaInfo,
    tableNameMap: Record<string, string>,
    filePath: string
): { table: TableDefinition | null; tableName: string } {
    // Extract table name from file name (e.g., user.sql -> user/users)
    const baseTableName = basename(queryFile, '.sql');
    
    // Build all possible variations of table names for matching
    const tableVariations = buildTableNameVariations(schemaInfo);

    // Try to find the table in our schema using the variations map
    let tableInfo: TableDefinition | null = null;
    let tableName = '';

    // First check if the base name matches directly
    if (schemaInfo.tables[baseTableName]) {
        tableInfo = schemaInfo.tables[baseTableName];
        tableName = baseTableName;
    }
    // Then check if it's in our variations map
    else if (tableVariations[baseTableName]) {
        const mappedName = tableVariations[baseTableName];
        tableInfo = schemaInfo.tables[mappedName];
        tableName = mappedName;
    }
    // If still not found, try to extract from queries
    if (!tableInfo) {
        const result = findTableFromQueries(filePath, schemaInfo, tableNameMap);
        tableInfo = result.table;
        tableName = result.tableName;
    }

    return { table: tableInfo, tableName };
}

/**
 * Attempts to find a table by analyzing the queries in a file.
 * 
 * @param filePath - Path to the query file
 * @param schemaInfo - Schema information with tables and enums
 * @param tableNameMap - Mapping from query table names to schema table names
 * @returns Object with table definition and table name, or null table if not found
 * 
 * @internal
 */
function findTableFromQueries(
    filePath: string,
    schemaInfo: SchemaInfo,
    tableNameMap: Record<string, string>
): { table: TableDefinition | null; tableName: string } {
    // Read the SQL file content
    const sqlContent = utils.readFile(filePath);
    if (!sqlContent) return { table: null, tableName: '' };

    // Extract named queries
    const namedQueries = utils.extractNamedQueries(sqlContent);

    // Try to determine the table from the first query
    if (Object.keys(namedQueries).length > 0) {
        const firstQuery = namedQueries[Object.keys(namedQueries)[0]];
        const queryInfo = utils.analyzeQuery(firstQuery);

        // If the query has a table name, try to find it in schema
        if (queryInfo.tableName) {
            // Check direct match
            if (schemaInfo.tables[queryInfo.tableName]) {
                return {
                    table: schemaInfo.tables[queryInfo.tableName],
                    tableName: queryInfo.tableName
                };
            }
            // Check mapped table
            else if (tableNameMap[queryInfo.tableName]) {
                const mappedName = tableNameMap[queryInfo.tableName];
                return {
                    table: schemaInfo.tables[mappedName],
                    tableName: mappedName
                };
            }
        }
    }

    return { table: null, tableName: '' };
}

/**
 * Processes queries to replace table names with their correct schema names.
 * 
 * @param namedQueries - Map of query names to query strings
 * @param tableNameMap - Mapping from query table names to schema table names
 * @returns Processed queries with corrected table names
 * 
 * @internal
 */
function processQueries(
    namedQueries: Record<string, string>,
    tableNameMap: Record<string, string>
): Record<string, string> {
    const processedQueries: Record<string, string> = {};

    Object.entries(namedQueries).forEach(([queryName, query]) => {
        const queryInfo = utils.analyzeQuery(query);

        // Replace table name in query if it's mapped
        if (queryInfo.tableName && tableNameMap[queryInfo.tableName]) {
            const correctTableName = tableNameMap[queryInfo.tableName];
            const updatedQuery = query.replace(
                new RegExp(`\\b${queryInfo.tableName}\\b`, 'g'),
                correctTableName
            );
            processedQueries[queryName] = updatedQuery;

            // Log the transformation
            if (updatedQuery !== query) {
                console.log(`Transformed query '${queryName}' to use correct table name '${correctTableName}'`);
            } else {
                processedQueries[queryName] = query;
            }
        } else {
            processedQueries[queryName] = query;
        }
    });

    return processedQueries;
}

/**
 * Generates a service file for a table.
 * 
 * @param tableName - Name of the table
 * @param tableInfo - Table definition
 * @param processedQueries - Processed queries for the table
 * @param tableNameMap - Mapping from query table names to schema table names
 * @param outputDir - Path to output directory
 * @param withDexie - Whether to include Dexie.js support
 * 
 * @internal
 */
function generateServiceFile(
    tableName: string,
    tableInfo: TableDefinition,
    processedQueries: Record<string, string>,
    tableNameMap: Record<string, string>,
    outputDir: string,
    withDexie: boolean
): void {
    const interfaceName = utils.tableNameToInterfaceName(tableName);
    const serviceFileName = `${utils.interfaceNameToFileName(interfaceName)}.service.ts`;
    const outputPath = join(outputDir, serviceFileName);

    // Generate service content
    const serviceContent = service_utils.generateServiceContent(
        interfaceName,
        tableInfo,
        processedQueries,
        tableNameMap,
        withDexie
    );

    // Write the file
    if (utils.writeToFile(outputPath, serviceContent)) {
        console.log(`Generated service for ${tableName} with custom queries -> ${outputPath}`);
    }
}

/**
 * Process a single query file and generate a service file.
 * 
 * This function processes a single SQL query file, finds the corresponding table definition,
 * and generates an Angular service class with CRUD operations and custom queries.
 * 
 * @param queryFilePath - Path to the query file
 * @param migrationsDir - Path to directory containing migration files
 * @param outputDir - Path to output directory for generated services
 * @param withDexie - Whether to include Dexie.js support in the services
 * @param pattern - Regular expression pattern to match migration files (default: /^V\d+__.+\.sql$/)
 * 
 * @example
 * ```typescript
 * // Generate a service from a single query file
 * processServiceFile('./queries/users.sql', './migrations', './src/app/services', true);
 * ```
 */
export function processServiceFile(
    queryFilePath: string,
    migrationsDir: string,
    outputDir: string,
    withDexie: boolean,
    pattern: RegExp = /^V\d+__.+\.sql$/
): void {
    try {
        // Validate input
        if (!validateSingleFile(queryFilePath, migrationsDir, outputDir)) {
            return;
        }

        console.log(`Processing query file: ${queryFilePath}`);

        // Parse migration files to get table definitions
        const schemaInfo = parseSchemaFromMigrations(migrationsDir, pattern);

        // Create table name mapping
        const tableNameMap = createTableNameMappingForSingleFile(schemaInfo, queryFilePath);

        // Extract table name from file name
        const queryFileName = basename(queryFilePath);
        const { table: tableInfo, tableName } = findTableForSingleQueryFile(
            queryFileName, 
            queryFilePath, 
            schemaInfo, 
            tableNameMap
        );

        if (!tableInfo) {
            console.error(`Error: Could not find table for query file ${queryFileName}. Please specify table name.`);
            return;
        }

        console.log(`Found table ${tableName} for query file ${queryFileName}`);

        // Read and process the query file
        const sqlContent = utils.readFile(queryFilePath);
        if (!sqlContent) return;

        const namedQueries = utils.extractNamedQueries(sqlContent);

        if (Object.keys(namedQueries).length === 0) {
            console.warn(`Warning: No named queries found in ${queryFileName}. Skipping.`);
            return;
        }

        console.log(`Found ${Object.keys(namedQueries).length} named queries in ${queryFileName}.`);

        // Process queries and transform table names
        const processedQueries = processQueries(namedQueries, tableNameMap);

        // Generate service file
        generateServiceFile(tableName, tableInfo, processedQueries, tableNameMap, outputDir, withDexie);

        console.log(`\nSuccessfully generated service file with custom queries in ${outputDir}`);
    } catch (error) {
        console.error('Error processing query file:', error);
    }
}

/**
 * Validates that the file exists and directories are valid.
 * 
 * @param queryFilePath - Path to query file
 * @param migrationsDir - Path to migrations directory
 * @param outputDir - Path to output directory
 * @returns True if all inputs are valid, false otherwise
 * 
 * @internal
 */
function validateSingleFile(queryFilePath: string, migrationsDir: string, outputDir: string): boolean {
    // Check if file exists
    if (!utils.checkFileExists(queryFilePath)) {
        console.error(`Error: Query file ${queryFilePath} does not exist.`);
        return false;
    }

    if (!utils.checkDirExists(migrationsDir)) {
        console.error(`Error: Migrations directory ${migrationsDir} is not a valid directory.`);
        return false;
    }

    // Create output directory if it doesn't exist
    if (!utils.ensureDir(outputDir)) {
        console.error(`Error: Could not create output directory ${outputDir}.`);
        return false;
    }

    return true;
}

/**
 * Creates a table name mapping from a single query file.
 * 
 * @param schemaInfo - Schema information with tables and enums
 * @param queryFilePath - Path to the query file
 * @returns Mapping from query table names to schema table names
 * 
 * @internal
 */
function createTableNameMappingForSingleFile(
    schemaInfo: SchemaInfo,
    queryFilePath: string
): Record<string, string> {
    const tableNameMap: Record<string, string> = {};
    const tableVariations = buildTableNameVariations(schemaInfo);
    
    // Read the SQL file content
    const sqlContent = utils.readFile(queryFilePath);
    if (!sqlContent) return tableNameMap;

    // Extract named queries
    const namedQueries = utils.extractNamedQueries(sqlContent);

    // Scan all queries to build the table name mapping
    Object.values(namedQueries).forEach(query => {
        const queryInfo = utils.analyzeQuery(query);
        if (queryInfo.tableName && queryInfo.tableName.length > 0) {
            // Map the query table name to a schema table name
            if (!tableNameMap[queryInfo.tableName]) {
                const matchedTable = tableVariations[queryInfo.tableName];
                if (matchedTable) {
                    tableNameMap[queryInfo.tableName] = matchedTable;
                    console.log(`Mapped query table '${queryInfo.tableName}' to schema table '${matchedTable}'`);
                } else {
                    console.warn(`Warning: Could not find matching schema table for query table '${queryInfo.tableName}'`);
                }
            }
        }
    });

    return tableNameMap;
}

/**
 * Find the table corresponding to a single query file.
 * 
 * @param queryFileName - Name of the query file
 * @param queryFilePath - Path to the query file
 * @param schemaInfo - Schema information with tables and enums
 * @param tableNameMap - Mapping from query table names to schema table names
 * @returns Object with table definition and table name, or null table if not found
 * 
 * @internal
 */
function findTableForSingleQueryFile(
    queryFileName: string,
    queryFilePath: string,
    schemaInfo: SchemaInfo,
    tableNameMap: Record<string, string>
): { table: TableDefinition | null; tableName: string } {
    const baseTableName = basename(queryFilePath, '.sql');
    const tableVariations = buildTableNameVariations(schemaInfo);

    // Try to find the table in our schema using the variations map
    let tableInfo: TableDefinition | null = null;
    let tableName = '';

    // First check if the base name matches directly
    if (schemaInfo.tables[baseTableName]) {
        tableInfo = schemaInfo.tables[baseTableName];
        tableName = baseTableName;
    }
    // Then check if it's in our variations map
    else if (tableVariations[baseTableName]) {
        const mappedName = tableVariations[baseTableName];
        tableInfo = schemaInfo.tables[mappedName];
        tableName = mappedName;
    }

    // If no matching table found, try to extract from queries
    if (!tableInfo) {
        const result = findTableFromQueries(queryFilePath, schemaInfo, tableNameMap);
        tableInfo = result.table;
        tableName = result.tableName;
    }

    return { table: tableInfo, tableName };
}