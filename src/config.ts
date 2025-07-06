/**
 * Configuration module for SQLiteBridge
 * 
 * Enhanced to support both Angular and React frameworks
 * Compatible with both Bun and Node.js runtimes
 * 
 * @packageDocumentation
 */

import { checkFileExists, readFile } from "./utils/file-utils.js";

/**
 * Supported framework types
 */
export type FrameworkType = 'angular' | 'react';

/**
 * Service generation patterns
 */
export type ServicePattern = 'class' | 'hooks' | 'functions';

/**
 * Runtime environment detection
 */
export type RuntimeEnvironment = 'bun' | 'node' | 'browser';

/**
 * Detect the current runtime environment
 */
export function detectRuntime(): RuntimeEnvironment {
	// Check for Bun
	if (typeof Bun !== 'undefined') {
		return 'bun';
	}

	// Check for Node.js
	if (typeof process !== 'undefined' && process.versions?.node) {
		return 'node';
	}

	// Default to browser
	return 'browser';
}

/**
 * Universal path operations (works in both Bun and Node.js)
 */
export class UniversalPath {
	static join(...paths: string[]): string {
		return paths
			.filter(Boolean)
			.join('/')
			.replace(/\/+/g, '/')
			.replace(/\/$/, '') || '/';
	}

	static resolve(...paths: string[]): string {
		const runtime = detectRuntime();

		if (runtime === 'bun') {
			// Bun doesn't have path.resolve, but we can use process.cwd() if available
			const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';
			const joined = this.join(...paths);
			return joined.startsWith('/') ? joined : this.join(cwd, joined);
		} else if (runtime === 'node') {
			// Use Node.js path.resolve
			const { resolve } = require('node:path');
			return resolve(...paths);
		} else {
			// Browser fallback
			return this.join(...paths);
		}
	}

	static dirname(filePath: string): string {
		const parts = filePath.split('/');
		return parts.slice(0, -1).join('/') || '.';
	}
}

/**
 * File configuration interface
 */
export interface FileConfig {
	/** Path to the configuration file directory */
	path: string;
	/** Name of the configuration file */
	name: string;
}

/**
 * Default configuration file settings
 */
export const fileConfig: FileConfig = {
	path: '',
	name: "sqlitebridge.config.json"
};

// /**
//  * Additional configuration options interface
//  */
// export interface OtherConfig {
// 	/** Regular expression pattern to match migration files */
// 	migrationPattern: RegExp;
// }
//
// /**
//  * Additional configuration options
//  */
// export const otherConfig: OtherConfig = {
// 	migrationPattern: /^V\d+__.+\.sql$/
// };

/**
 * Framework-specific configuration options
 */
export interface FrameworkConfig {
	/** Target framework */
	framework: FrameworkType;
	/** Service generation pattern */
	servicePattern: ServicePattern;
	/** Whether to generate TypeScript hooks (React only) */
	generateHooks: boolean;
	/** Whether to generate context providers (React only) */
	generateProviders: boolean;
	/** Whether to use dependency injection (Angular only) */
	useDependencyInjection: boolean;
}

/**
 * Main configuration interface
 */
export interface Config {
	/** Path to the directory containing migration SQL files */
	migrationsPath: string;
	/** Path to the directory containing query SQL files */
	queriesPath: string;
	/** Paths for generated output files */
	generatedPath: {
		/** Path for generated migrations file */
		migrations: string;
		/** Path for generated model files */
		models: string;
		/** Path for generated Dexie schema file */
		dexie: string;
		/** Path for generated service files */
		services: string;
		/** Path for generated hooks (React only) */
		hooks?: string;
		/** Path for generated providers (React only) */
		providers?: string;
	};
	/** Whether to generate Dexie.js schema */
	withDexie: boolean;
	/** Framework-specific configuration */
	frameworkConfig: FrameworkConfig;
	/** Regular expression pattern to match migration files */
	migrationPattern: RegExp;
}

/**
 * Default configuration values for Angular
 */
export const defaultAngularConfig: Config = {
	migrationsPath: './migrations',
	queriesPath: './queries',
	generatedPath: {
		migrations: './src/app/core/database/migrations.ts',
		models: './src/app/core/database/models',
		dexie: './src/app/core/database/dexie-schema.ts',
		services: './src/app/core/database/services',
	},
	withDexie: false,
	frameworkConfig: {
		framework: 'angular',
		servicePattern: 'class',
		generateHooks: false,
		generateProviders: false,
		useDependencyInjection: true,
	},
	migrationPattern: /^V\d+__.+\.sql$/
};

/**
 * Default configuration values for React
 */
export const defaultReactConfig: Config = {
	migrationsPath: './migrations',
	queriesPath: './queries',
	generatedPath: {
		migrations: './src/database/migrations.ts',
		models: './src/database/models',
		dexie: './src/database/dexie-schema.ts',
		services: './src/database/services',
		hooks: './src/database/hooks',
		providers: './src/database/providers',
	},
	withDexie: true, // React typically uses Dexie for web
	frameworkConfig: {
		framework: 'react',
		servicePattern: 'hooks',
		generateHooks: true,
		generateProviders: true,
		useDependencyInjection: false,
	},
	migrationPattern: /^V\d+__.+\.sql$/
};

/**
 * Loads configuration from file or uses defaults
 * 
 * @returns Config object with settings for SQLiteBridge
 */
export async function loadConfig(): Promise<Config> {
	const configFilePath = UniversalPath.join(fileConfig.path, fileConfig.name);
	const absolutePath = UniversalPath.resolve(configFilePath);

	// Try to load config file
	if (await checkFileExists(absolutePath)) {
		try {
			const fileContent = await readFile(absolutePath);
			if (fileContent) {
				// Parse the config file
				const fileConfigData = JSON.parse(fileContent);

				// Determine which default to use based on framework
				const baseDefault = fileConfigData.framework?.framework === 'react'
					? defaultReactConfig
					: defaultAngularConfig;

				// Merge with default config, keeping defaults for any missing properties
				return {
					...baseDefault,
					...fileConfigData,
					generatedPath: {
						...baseDefault.generatedPath,
						...fileConfigData.generatedPath
					},
					frameworkConfig: {
						...baseDefault.frameworkConfig,
						...fileConfigData.frameworkConfig
					}
				};
			}
		} catch (error) {
			console.error('Error parsing config file:', error);
			console.warn('Using default configuration instead.');
		}
	} else {
		const runtime = detectRuntime();
		console.warn(`Config file '${absolutePath}' not found, using default configuration.`);
		console.info(`Create a '${fileConfig.name}' file to customize settings.`);
		console.info(`Runtime detected: ${runtime}`);
	}

	// Default to Angular for backward compatibility
	return defaultAngularConfig;
}

/**
 * Synchronous version for immediate use (uses cached result)
 */
let cachedConfig: Config | null = null;

export function getConfig(): Config {
	if (!cachedConfig) {
		// If not loaded yet, return default and load asynchronously
		cachedConfig = defaultAngularConfig;
		loadConfig().then(config => {
			cachedConfig = config;
		}).catch(error => {
			console.error('Failed to load configuration:', error);
		});
	}
	return cachedConfig;
}

/**
 * Initialize config - should be called at startup
 */
export async function initConfig(): Promise<Config> {
	cachedConfig = await loadConfig();
	return cachedConfig;
}

/**
 * Export the loaded configuration as the default export
 * Note: This will be the default config initially, but gets updated after async load
 */
const config: Config = getConfig();
export default config;

// Example React configuration file
export const exampleReactConfig = `{
  "migrationsPath": "./migrations",
  "queriesPath": "./queries",
  "generatedPath": {
    "migrations": "./src/database/migrations.ts",
    "models": "./src/database/models",
    "dexie": "./src/database/dexie-schema.ts",
    "services": "./src/database/services",
    "hooks": "./src/database/hooks",
    "providers": "./src/database/providers"
  },
  "withDexie": true,
  "framework": {
    "framework": "react",
    "servicePattern": "hooks",
    "generateHooks": true,
    "generateProviders": true,
    "useDependencyInjection": false
  }
}`;

// Example Angular configuration file (for reference)
export const exampleAngularConfig = `{
  "migrationsPath": "./migrations",
  "queriesPath": "./queries", 
  "generatedPath": {
    "migrations": "./src/app/core/database/migrations.ts",
    "models": "./src/app/core/database/models",
    "dexie": "./src/app/core/database/dexie-schema.ts",
    "services": "./src/app/core/database/services"
  },
  "withDexie": false,
  "framework": {
    "framework": "angular",
    "servicePattern": "class",
    "generateHooks": false,
    "generateProviders": false,
    "useDependencyInjection": true
  }
}`;

// CLI usage helper
export function getConfigHelp(): string {
	const runtime = detectRuntime();

	return `
SQLiteBridge Configuration (${runtime})

Create a 'sqlitebridge.config.json' file in your project root:

For React projects:
${exampleReactConfig}

For Angular projects:
${exampleAngularConfig}

Runtime detected: ${runtime}
${runtime === 'bun' ? '🚀 Using Bun for optimal performance!' : '📦 Using Node.js compatibility mode'}
`;
}
