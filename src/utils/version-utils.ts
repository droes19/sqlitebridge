import { VersionInfo } from "../types";

/**
 * Extract version number from migration filename
 * Assumes format: Vx__description.sql where x is the version number
 * @param fileName Name of the migration file
 * @returns Object with version and description, or null if no match
 */
export const extractVersionInfo = (fileName: string): VersionInfo | null => {
    // Pattern to match Vx__description.sql format
    const versionMatch = fileName.match(/^V(\d+)__(.+)\.sql$/);

    if (versionMatch && versionMatch.length >= 3) {
        const version = parseInt(versionMatch[1], 10);

        // Convert the filename to a readable description
        let description = versionMatch[2]
            .replace(/-/g, ' ')          // Replace hyphens with spaces
            .replace(/_/g, ' ')          // Replace underscores with spaces
            .replace(/([a-z])([A-Z])/g, '$1 $2')  // Convert camelCase to spaces
            .toLowerCase();

        // Capitalize first letter of each word
        description = description
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        return { version, description };
    }

    return null;
};

/**
 * Extract just the version number from migration filename
 * @param fileName Name of the migration file
 * @returns Version number or null if no match
 */
export const extractVersionFromFileName = (fileName: string): number | null => {
    const versionInfo = extractVersionInfo(fileName);
    return versionInfo ? versionInfo.version : null;
};
//
///**
// * Group tables by version based on migration filenames
// * @param parsedFiles Array of parsed file information
// * @returns Array of version objects with tables
// */
//export const groupTablesByVersion = (parsedFiles: FileInfo[]): Version[] => {
//    const versions: Version[] = [];
//
//    // Sort parsedFiles by version number
//    parsedFiles.sort((a, b) => a.version - b.version);
//
//    // Track which tables we've seen in previous versions
//    const allTablesSeenSoFar: Record<string, any> = {};
//
//    // For each version, include all tables seen so far
//    parsedFiles.forEach(fileInfo => {
//        const version = fileInfo.version;
//        const tables = fileInfo.tables;
//        const alterations = fileInfo.alterations || [];
//
//        // Add/update tables to our tracking object
//        tables.forEach(table => {
//            allTablesSeenSoFar[table.name] = table;
//        });
//
//        // Apply any alterations to existing tables
//        alterations.forEach(alteration => {
//            const { tableName, columnName, columnInfo } = alteration;
//
//            if (allTablesSeenSoFar[tableName]) {
//                // Add column to the table
//                allTablesSeenSoFar[tableName].columns.push(columnInfo);
//
//                // Add to indexed columns if needed
//                if (columnInfo.isPrimaryKey || columnInfo.isUnique || columnName.endsWith('_id')) {
//                    if (!allTablesSeenSoFar[tableName].indexedColumns) {
//                        allTablesSeenSoFar[tableName].indexedColumns = [];
//                    }
//
//                    if (!allTablesSeenSoFar[tableName].indexedColumns.includes(columnName)) {
//                        allTablesSeenSoFar[tableName].indexedColumns.push(columnName);
//                    }
//                }
//
//                console.log(`Applied alteration: Added column ${columnName} to table ${tableName} in version ${version}`);
//            } else {
//                console.warn(`Warning: Could not apply alteration to non-existent table ${tableName} in version ${version}`);
//            }
//        });
//
//        // Create a version entry with all tables seen so far
//        versions.push({
//            version: version,
//            // Create a deep copy of all tables seen so far
//            tables: Object.values(allTablesSeenSoFar).map(t => JSON.parse(JSON.stringify(t)))
//        });
//    });
//
//    return versions;
//};
