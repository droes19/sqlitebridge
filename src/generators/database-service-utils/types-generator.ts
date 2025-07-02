/**
 * Types Generator
 * 
 * Generates TypeScript types and interfaces for database services
 */

import { FrameworkType } from '../../config';

/**
 * Generate TypeScript types and interfaces.
 * 
 * @param framework - Target framework
 * @returns Generated types
 */
export function generateTypes(framework: FrameworkType): string {
	let output = `// Database configuration interface\n`;
	output += `export interface DatabaseConfig {\n`;
	output += `  name: string;\n`;
	output += `  mode: string;\n`;
	output += `  encrypted?: boolean;\n`;
	output += `  readonly?: boolean;\n`;
	output += `}\n\n`;

	if (framework === 'react') {
		output += generateReactTypes();
	} else {
		output += generateAngularTypes();
	}

	return output;
}

/**
 * Generate React-specific types.
 * 
 * @returns Generated React types
 */
function generateReactTypes(): string {
	let output = `// React database context types\n`;
	output += `export interface DatabaseContextType {\n`;
	output += `  isReady: boolean;\n`;
	output += `  isNative: boolean;\n`;
	output += `  error: string | null;\n`;
	output += `  executeQuery: (query: string, params?: any[]) => Promise<any>;\n`;
	output += `  executeCommand: (query: string, params?: any[]) => Promise<any>;\n`;
	output += `  getDexieInstance: () => any;\n`;
	output += `  isNativeDatabase: () => boolean;\n`;
	output += `  closeDatabase: () => Promise<void>;\n`;
	output += `}\n\n`;

	output += `// Database state for React\n`;
	output += `export interface DatabaseState {\n`;
	output += `  isReady: boolean;\n`;
	output += `  isNative: boolean;\n`;
	output += `  error: string | null;\n`;
	output += `  isInitializing: boolean;\n`;
	output += `}\n\n`;

	output += `// Database Provider Props\n`;
	output += `export interface DatabaseProviderProps {\n`;
	output += `  children: ReactNode;\n`;
	output += `  autoInitialize?: boolean;\n`;
	output += `}\n\n`;

	return output;
}

/**
 * Generate Angular-specific types.
 * 
 * @returns Generated Angular types
 */
function generateAngularTypes(): string {
	let output = `// Angular database service types\n`;
	output += `export interface DatabaseStatus {\n`;
	output += `  isReady: boolean;\n`;
	output += `  isNative: boolean;\n`;
	output += `  error?: string;\n`;
	output += `}\n\n`;

	output += `// Migration status interface\n`;
	output += `export interface MigrationStatus {\n`;
	output += `  currentVersion: number;\n`;
	output += `  latestVersion: number;\n`;
	output += `  hasPendingMigrations: boolean;\n`;
	output += `  pendingMigrations: string[];\n`;
	output += `}\n\n`;

	return output;
}
