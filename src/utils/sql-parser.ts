import { Alteration, ColumnDefinition, EnumDefinition, ForeignKey, SchemaInfo, TableDefinition } from "../types";
import { sqliteToTypeScriptType } from "./type-mapping";

interface CreateTableResult {
    tables: TableDefinition[];
    enums: EnumDefinition[];
}

/**
 * Parse CREATE TABLE statements from SQL content
 * @param sqlContent SQL content to parse
 * @param fileName Name of the source file (for reference)
 * @returns Object containing tables and enums arrays
 */
export function parseCreateTableStatements(sqlContent: string | null, fileName: string): CreateTableResult {
    const tables: TableDefinition[] = [];
    const enums: EnumDefinition[] = [];

    if (!sqlContent) {
        return { tables, enums };
    }

    // Modified regex to match CREATE TABLE statements with table name capture
    const createTableStartRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/gmi;

    let match;
    while ((match = createTableStartRegex.exec(sqlContent)) !== null) {
        const tableName = match[1];
        const matchStart = match.index;

        // Find the opening parenthesis
        let openParenPos = sqlContent.indexOf('(', matchStart + match[0].length);
        if (openParenPos === -1) {
            console.error(`Error: Could not find opening parenthesis for table ${tableName}`);
            continue;
        }

        // Find the matching closing parenthesis, accounting for nested parentheses
        let endPos = openParenPos + 1;
        let parenLevel = 1;
        let inQuotes = false;
        let quoteChar = '';

        while (endPos < sqlContent.length && parenLevel > 0) {
            const char = sqlContent[endPos];

            // Handle quotes
            if ((char === '"' || char === "'" || char === '`') && (endPos === 0 || sqlContent[endPos - 1] !== '\\')) {
                if (inQuotes && char === quoteChar) {
                    inQuotes = false;
                } else if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                }
            }

            // Handle parentheses - only if not in quotes
            if (!inQuotes) {
                if (char === '(') {
                    parenLevel++;
                } else if (char === ')') {
                    parenLevel--;
                }
            }

            endPos++;
        }

        // Extract the full table content between the parentheses
        if (endPos <= openParenPos + 1 || parenLevel > 0) {
            console.error(`Error: Could not find closing parenthesis for table ${tableName}`);
            continue; // Skip this table if we couldn't find the closing parenthesis
        }

        const tableContentStr = sqlContent.substring(openParenPos + 1, endPos - 1);

        // Parse columns
        const columns: ColumnDefinition[] = [];

        // Split by commas, respecting parentheses
        const columnMatches = splitRespectingParentheses(tableContentStr);

        // For the foreign keys list
        const foreignKeys: ForeignKey[] = [];

        // For tracking primary keys defined within column definitions
        const primaryKeyColumns: string[] = [];

        // For tracking indexed columns (for Dexie schema)
        const indexedColumns: string[] = [];

        columnMatches.forEach((columnStr) => {
            columnStr = columnStr.trim();

            // Skip if empty
            if (!columnStr) {
                return;
            }

            // Handle FOREIGN KEY constraints
            if (columnStr.toUpperCase().startsWith('FOREIGN KEY')) {
                const fkMatch = columnStr.match(/FOREIGN\s+KEY\s*\(\s*["'`]?(\w+)["'`]?\s*\)\s*REFERENCES\s+["'`]?(\w+)["'`]?\s*\(\s*["'`]?(\w+)["'`]?\s*\)/i);
                if (fkMatch) {
                    foreignKeys.push({
                        column: fkMatch[1],
                        referenceTable: fkMatch[2],
                        referenceColumn: fkMatch[3]
                    });
                    // Foreign key columns should be indexed in Dexie
                    if (!indexedColumns.includes(fkMatch[1])) {
                        indexedColumns.push(fkMatch[1]);
                    }
                }
                return;
            }

            // Handle PRIMARY KEY constraints
            if (columnStr.toUpperCase().startsWith('PRIMARY KEY')) {
                const pkMatch = columnStr.match(/PRIMARY\s+KEY\s*\(\s*(.*?)\s*\)/i);
                if (pkMatch) {
                    const pkColumns = pkMatch[1].split(',').map(col =>
                        col.trim().replace(/["'`]/g, '')
                    );
                    primaryKeyColumns.push(...pkColumns);
                }
                return;
            }

            // Skip other constraints that aren't column definitions
            if (columnStr.toUpperCase().startsWith('CONSTRAINT') ||
                columnStr.toUpperCase().startsWith('UNIQUE') ||
                columnStr.toUpperCase().startsWith('CHECK')) {
                return;
            }

            // Parse regular column definitions
            const colMatch = columnStr.match(/["'`]?(\w+)["'`]?\s+([^]+)/);
            if (colMatch) {
                const columnName = colMatch[1];
                const columnDef = colMatch[2].trim();

                // Get the SQL type from the first word
                const typeParts = columnDef.split(/\s+/);
                const sqlType = typeParts[0];

                const tsType = sqliteToTypeScriptType(sqlType);
                const isPrimaryKey = columnDef.toUpperCase().includes('PRIMARY KEY');
                const isNotNull = columnDef.toUpperCase().includes('NOT NULL');
                const isUnique = columnDef.toUpperCase().includes('UNIQUE');
                const isAutoIncrement = columnDef.toUpperCase().includes('AUTOINCREMENT');

                // Extract DEFAULT value, handling complex expressions with parentheses
                let defaultValue: string | undefined;

                // Handle cases with nested parentheses like DEFAULT (datetime ('now', 'localtime'))
                const defaultMatch = columnDef.match(/DEFAULT\s+(.+)$/i);
                if (defaultMatch) {
                    defaultValue = defaultMatch[1].trim();
                }

                if (isPrimaryKey) {
                    primaryKeyColumns.push(columnName);
                }

                // In Dexie, PRIMARY KEY columns and UNIQUE columns should be indexed
                if (isPrimaryKey || isUnique) {
                    if (!indexedColumns.includes(columnName)) {
                        indexedColumns.push(columnName);
                    }
                }

                // Also add foreign key-like columns (ending with _id) to indexedColumns
                if (columnName.endsWith('_id') && !indexedColumns.includes(columnName)) {
                    indexedColumns.push(columnName);
                }

                columns.push({
                    name: columnName,
                    sqlType: sqlType,
                    tsType: tsType,
                    isPrimaryKey: isPrimaryKey,
                    isNullable: !isNotNull && !isPrimaryKey,
                    isUnique: isUnique,
                    isAutoIncrement: isAutoIncrement,
                    defaultValue: defaultValue
                });
            }
        });

        // Set the primary key flag for columns that are in the PRIMARY KEY constraint
        columns.forEach(col => {
            if (primaryKeyColumns.includes(col.name)) {
                col.isPrimaryKey = true;
            }
        });

        // Check for enum-like tables (simple tables with id and name/value columns)
        if (columns.length === 2 &&
            columns.some(col => col.name.toLowerCase() === 'id' && col.isPrimaryKey) &&
            columns.some(col => ['name', 'value', 'label', 'code'].includes(col.name.toLowerCase()))) {
            const nameColumn = columns.find(col =>
                ['name', 'value', 'label', 'code'].includes(col.name.toLowerCase())
            );

            // Add to enums
            if (nameColumn) {
                enums.push({
                    name: tableName,
                    //valueCol: nameColumn.name
                });
            }
        }

        tables.push({
            name: tableName,
            columns: columns,
            foreignKeys: foreignKeys,
            indexedColumns: indexedColumns,
            originalFile: fileName
        });
    }

    return { tables, enums };
};

/**
 * @param input Input string
 * @returns Array of split parts
 */
export function splitRespectingParentheses(input: string): string[] {
    const result: string[] = [];
    let current = '';
    let parenLevel = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        // Handle quotes
        if ((char === '"' || char === "'" || char === '`') && (i === 0 || input[i - 1] !== '\\')) {
            if (inQuotes && char === quoteChar) {
                inQuotes = false;
            } else if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
            }
            current += char;
            continue;
        }

        // Handle parentheses - only if not in quotes
        if (!inQuotes) {
            if (char === '(') {
                parenLevel++;
                current += char;
                continue;
            } else if (char === ')') {
                parenLevel--;
                current += char;
                continue;
            }
        }

        // Handle commas - only split if not in quotes or parentheses
        if (char === ',' && parenLevel === 0 && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    // Don't forget the last part
    if (current.trim()) {
        result.push(current.trim());
    }

    return result;
}

/**
 * Parse ALTER TABLE statements from SQL content
 * @param sqlContent SQL content to parse
 * @param schemaInfo Schema information containing tables and enums
 * @param fileName Name of the source file (for reference)
 * @returns Array of alteration objects
 */
export function parseAlterTableStatements(
    sqlContent: string | null,
    schemaInfo: SchemaInfo | TableDefinition[],
    fileName: string
): Alteration[] {
    if (!sqlContent) {
        return [];
    }

    // Pattern for ALTER TABLE ADD COLUMN statements
    const addColumnRegex = /ALTER\s+TABLE\s+["'`]?(\w+)["'`]?\s+ADD(?:\s+COLUMN)?\s+["'`]?(\w+)["'`]?\s+([^;]+)/gmi;

    const alterations: Alteration[] = [];

    let match;
    while ((match = addColumnRegex.exec(sqlContent)) !== null) {
        const tableName = match[1];
        const columnName = match[2];
        const columnDef = match[3].trim();

        const typeParts = columnDef.split(' ');
        const sqlType = typeParts[0];

        const tsType = sqliteToTypeScriptType(sqlType);
        const isPrimaryKey = columnDef.toUpperCase().includes('PRIMARY KEY');
        const isNotNull = columnDef.toUpperCase().includes('NOT NULL');
        const isUnique = columnDef.toUpperCase().includes('UNIQUE');
        const isAutoIncrement = columnDef.toUpperCase().includes('AUTOINCREMENT');

        // Look for DEFAULT value
        let defaultValue: string | undefined;
        const defaultMatch = columnDef.match(/DEFAULT\s+([^,\s]+)/i);
        if (defaultMatch) {
            defaultValue = defaultMatch[1];
        }

        // Create column info
        const columnInfo: ColumnDefinition = {
            name: columnName,
            sqlType: sqlType,
            tsType: tsType,
            isPrimaryKey: isPrimaryKey,
            isNullable: !isNotNull && !isPrimaryKey,
            isUnique: isUnique,
            isAutoIncrement: isAutoIncrement,
            defaultValue: defaultValue
        };

        // Check if column already exists in alterations before adding
        const existingAlteration = alterations.find(
            alt => alt.tableName === tableName && alt.columnName === columnName
        );

        if (existingAlteration) {
            console.warn(`Warning: Duplicate ALTER TABLE for column ${tableName}.${columnName} in file ${fileName}. Skipping duplicate.`);
            continue;
        }

        // Store the alteration for later processing
        alterations.push({
            tableName,
            columnName,
            columnInfo
        });

        // Find the table in existing tables to apply immediately for compatibility
        let table: TableDefinition | null = null;

        if (Array.isArray(schemaInfo)) {
            table = schemaInfo.find(t => t.name === tableName) || null;
        } else if (schemaInfo && schemaInfo.tables && schemaInfo.tables[tableName]) {
            table = schemaInfo.tables[tableName];
        }

        // Skip if the table doesn't exist in our schema
        if (!table) {
            console.warn(`Warning: ALTER TABLE references table "${tableName}" which was not found in the current file. This will be applied in version processing if the table exists in a previous version.`);
            continue;
        }

        // Check if column already exists in table before adding
        const existingColumn = table.columns.find(col => col.name === columnName);
        if (existingColumn) {
            console.warn(`Warning: Column ${columnName} already exists in table ${tableName}. Skipping duplicate ALTER TABLE statement.`);
            continue;
        }

        // In Dexie, PRIMARY KEY columns and UNIQUE columns should be indexed
        if (isPrimaryKey || isUnique) {
            if (!table.indexedColumns) {
                table.indexedColumns = [];
            }

            if (!table.indexedColumns.includes(columnName)) {
                table.indexedColumns.push(columnName);
            }
        }

        // Also add foreign key-like columns (ending with _id) to indexedColumns
        if (columnName.endsWith('_id')) {
            if (!table.indexedColumns) {
                table.indexedColumns = [];
            }

            if (!table.indexedColumns.includes(columnName)) {
                table.indexedColumns.push(columnName);
            }
        }

        // Add the new column to the table's schema
        table.columns.push(columnInfo);
    }

    return alterations;
}

/**
 * Convert a table name to a TypeScript interface name
 * @param tableName Table name to convert
 * @returns TypeScript interface name in PascalCase
 */
export function tableNameToInterfaceName(tableName: string): string {
    // Handle common naming patterns
    let interfaceName = tableName;

    if (interfaceName.endsWith('ies')) {
        interfaceName = interfaceName.replace(/ies$/, 'y');
    } else if (interfaceName.endsWith('s')) {
        interfaceName = interfaceName.slice(0, -1);
    }

    // Convert to PascalCase
    return interfaceName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
};

/**
 * Get file name from interface name
 * @param interfaceName Interface name to convert
 * @returns File name in kebab-case
 */
export function interfaceNameToFileName(interfaceName: string): string {
    // Convert PascalCase to kebab-case
    return interfaceName
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();
};

/**
 * Extract SQL queries from a migration file with special trigger handling
 * @param content SQL file content
 * @returns Array of SQL queries
 */
export const extractQueriesFromContent = (content: string | null): string[] => {
    if (!content) return [];

    // Normalize line endings
    content = content.replace(/\r\n/g, '\n');

    // Split by semicolons but maintain a stack to track BEGIN/END blocks
    const queries: string[] = [];
    let currentQuery = '';
    let inTriggerBlock = false;

    // Split into lines first to better track the structure
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines and comment-only lines
        if (!trimmedLine || trimmedLine.startsWith('--')) {
            continue;
        }

        // Check if we're entering a trigger block
        if (trimmedLine.includes('CREATE TRIGGER') && trimmedLine.includes('BEGIN')) {
            inTriggerBlock = true;
        } else if (!inTriggerBlock && trimmedLine.includes('CREATE TRIGGER')) {
            inTriggerBlock = true;
        } else if (inTriggerBlock && trimmedLine.includes('END;')) {
            inTriggerBlock = false;
            // Add the line with END to the current query
            currentQuery += line + '\n';

            // Finish this query
            if (currentQuery.trim()) {
                queries.push(formatSqlQuery(currentQuery));
                currentQuery = '';
            }
            continue;
        }

        // Add current line to the query
        currentQuery += line + '\n';

        // If we're not in a trigger block and the line ends with a semicolon, we've reached the end of a query
        if (!inTriggerBlock && trimmedLine.endsWith(';')) {
            if (currentQuery.trim()) {
                queries.push(formatSqlQuery(currentQuery));
                currentQuery = '';
            }
        }
    }

    // Add any remaining query
    if (currentQuery.trim()) {
        queries.push(formatSqlQuery(currentQuery));
    }

    return queries
        .filter(query => {
            // Remove any remaining empty queries
            const withoutComments = query
                .replace(/--.*$/gm, '')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .trim();
            return withoutComments.length > 0;
        });
};

/**
 * Clean up a SQL query by removing excessive whitespace and normalizing indentation
 * @param query SQL query to format
 * @returns Formatted SQL query
 */
export const formatSqlQuery = (query: string): string => {
    return query
        .trim()
        .replace(/\n\s+/g, '\n  ')
        .replace(/\s+/g, ' ')
        .replace(/\s*\(\s*/g, ' (')
        .replace(/\s*\)\s*/g, ') ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Generate Dexie schema string for a table
 * @param table Table definition
 * @returns Dexie schema string
 */
export function generateDexieSchemaString(table: TableDefinition): string {
    // Get primary key
    const primaryKey = table.columns.find(col => col.isPrimaryKey);
    let schemaString = '';

    if (primaryKey) {
        // If it's auto-increment, prefix with ++
        if (primaryKey.isAutoIncrement) {
            schemaString = `++${primaryKey.name}`;
        } else {
            schemaString = primaryKey.name;
        }
    } else {
        // If no primary key, use auto-incrementing id
        schemaString = '++id';
    }

    // Add all indexed columns and column names that should be indexed
    const indexedColumns = new Set<string>();

    // Add explicitly indexed columns
    if (Array.isArray(table.indexedColumns)) {
        table.indexedColumns.forEach(col => indexedColumns.add(col));
    }

    // Common fields that typically don't need indexing
    const commonFields = new Set([
        'created_at',
        'updated_at',
        'created_by',
        'updated_by',
        'deleted_at',
        'description',
        'content',
        'notes',
        'comments'
    ]);

    // Add all columns except common fields
    table.columns.forEach(col => {
        // Skip primary key (already handled above)
        if (col.isPrimaryKey) {
            return;
        }

        // Skip common fields that typically don't need indexing
        if (commonFields.has(col.name)) {
            return;
        }

        // Always index fields that:
        // 1. Are marked as unique
        // 2. End with _id (likely foreign keys)
        // 3. Have common indexable names (email, username, etc.)
        // 4. Are not large text fields (likely to be queried)
        const isUnique = col.isUnique;
        const isForeignKey = col.name.endsWith('_id');
        const isCommonIndexable = ['email', 'username', 'phone_number', 'private_key', 'api_key', 'code', 'status'].includes(col.name);
        const isLargeTextField = col.tsType === 'string' && (
            col.name.includes('description') ||
            col.name.includes('content') ||
            col.name.includes('text') ||
            col.name.includes('body')
        );

        if (isUnique || isForeignKey || isCommonIndexable || !isLargeTextField) {
            indexedColumns.add(col.name);
        }
    });

    // Remove the primary key from indexed columns
    if (primaryKey) {
        indexedColumns.delete(primaryKey.name);
    }

    // Convert Set to sorted array for consistent output
    const sortedIndexedColumns = Array.from(indexedColumns).sort();

    if (sortedIndexedColumns.length > 0) {
        schemaString += ', ' + sortedIndexedColumns.join(', ');
    }

    return schemaString;
}

