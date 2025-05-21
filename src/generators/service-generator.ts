import * as utils from '../utils';
import { SchemaInfo, TableDefinition } from '../types';
import { basename, join } from 'node:path';
import * as service_utils from './service-utils'

/**
 * Process a directory of query files and generate service files
 * @param queriesDir Path to directory containing query files
 * @param migrationsDir Path to directory containing migration files
 * @param outputDir Path to output directory for generated services
 * @param pattern Regular expression pattern to match migration files
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

        // Create a mapping between query table names and actual schema table names
        const tableNameMap: Record<string, string> = {};

        // Build all possible variations of table names for matching
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

        //console.log('Table name variations:', tableVariations);

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

        // Process each query file
        queryFiles.forEach(queryFile => {
            const filePath = join(queriesDir, queryFile);
            console.log(`Processing query file: ${queryFile}`);

            // Extract table name from file name (e.g., user.sql -> user/users)
            const baseTableName = basename(queryFile, '.sql');

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
                // Read the SQL file content
                const sqlContent = utils.readFile(filePath);
                if (!sqlContent) return;

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
                            tableInfo = schemaInfo.tables[queryInfo.tableName];
                            tableName = queryInfo.tableName;
                        }
                        // Check mapped table
                        else if (tableNameMap[queryInfo.tableName]) {
                            const mappedName = tableNameMap[queryInfo.tableName];
                            tableInfo = schemaInfo.tables[mappedName];
                            tableName = mappedName;
                        }
                    }
                }
            }

            if (!tableInfo) {
                console.warn(`Warning: Could not find table for query file ${queryFile}. Skipping.`);
                return;
            }

            console.log(`Found table ${tableName} for query file ${queryFile}`);

            // Read the SQL file and extract named queries
            const sqlContent = utils.readFile(filePath);
            if (!sqlContent) return;

            const namedQueries = utils.extractNamedQueries(sqlContent);

            if (Object.keys(namedQueries).length === 0) {
                console.warn(`Warning: No named queries found in ${queryFile}. Skipping.`);
                return;
            }

            console.log(`Found ${Object.keys(namedQueries).length} named queries in ${queryFile}.`);

            // Transform queries to use correct table names
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

            // Generate service file
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
        });

        console.log(`\nSuccessfully generated service files with custom queries in ${outputDir}`);
    } catch (error) {
        console.error('Error processing query directory:', error);
    }
}

/**
 * Process a single query file and generate a service file
 * @param queryFilePath Path to the query file
 * @param migrationsDir Path to directory containing migration files
 * @param outputDir Path to output directory for generated services
 * @param pattern Regular expression pattern to match migration files
 */
export function processServiceFile(
    queryFilePath: string,
    migrationsDir: string,
    outputDir: string,
    withDexie: boolean,
    pattern: RegExp = /^V\d+__.+\.sql$/
): void {
    try {
        // Check if file exists
        if (!utils.checkFileExists(queryFilePath)) {
            console.error(`Error: Query file ${queryFilePath} does not exist.`);
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

        console.log(`Processing query file: ${queryFilePath}`);

        // Parse migration files to get table definitions
        const schemaInfo: SchemaInfo = {
            tables: {},
            enums: []
        };

        const migrationFiles = utils.getSqlFilesInDirectory(migrationsDir, pattern);

        migrationFiles.forEach(file => {
            const filePath = join(migrationsDir, file);
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

        // Create a mapping between query table names and actual schema table names
        const tableNameMap: Record<string, string> = {};

        // Build all possible variations of table names for matching
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

        console.log('Table name variations:', tableVariations);

        // Extract table name from file name (e.g., user.sql -> users)
        const queryFileName = basename(queryFilePath);
        const baseTableName = basename(queryFilePath, '.sql');

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
            // Read the SQL file content
            const sqlContent = utils.readFile(queryFilePath);
            if (!sqlContent) return;

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

            // Try to determine the table from the first query
            if (Object.keys(namedQueries).length > 0) {
                const firstQuery = namedQueries[Object.keys(namedQueries)[0]];
                const queryInfo = utils.analyzeQuery(firstQuery);

                // If the query has a table name, try to find it in schema
                if (queryInfo.tableName) {
                    // Check direct match
                    if (schemaInfo.tables[queryInfo.tableName]) {
                        tableInfo = schemaInfo.tables[queryInfo.tableName];
                        tableName = queryInfo.tableName;
                    }
                    // Check mapped table
                    else if (tableNameMap[queryInfo.tableName]) {
                        const mappedName = tableNameMap[queryInfo.tableName];
                        tableInfo = schemaInfo.tables[mappedName];
                        tableName = mappedName;
                    }
                }
            }
        }

        if (!tableInfo) {
            console.error(`Error: Could not find table for query file ${queryFileName}. Please specify table name.`);
            return;
        }

        console.log(`Found table ${tableName} for query file ${queryFileName}`);

        // Read the SQL file and extract named queries
        const sqlContent = utils.readFile(queryFilePath);
        if (!sqlContent) return;

        const namedQueries = utils.extractNamedQueries(sqlContent);

        if (Object.keys(namedQueries).length === 0) {
            console.warn(`Warning: No named queries found in ${queryFileName}. Skipping.`);
            return;
        }

        console.log(`Found ${Object.keys(namedQueries).length} named queries in ${queryFileName}.`);

        // Transform queries to use correct table names
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

        // Generate service file
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

        console.log(`\nSuccessfully generated service file with custom queries in ${outputDir}`);
    } catch (error) {
        console.error('Error processing query file:', error);
    }
}
