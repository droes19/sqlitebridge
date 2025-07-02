#!/usr/bin/env node

/**
 * SQLiteBridge CLI Tool - Universal Edition
 * 
 * Works with both Bun and Node.js automatically
 * Now with proper async config loading
 */

import { Command } from "commander";
import { initConfig, detectRuntime, getConfigHelp, type Config } from "../config.js";
import {
	generateSqliteMigrationsFromDir,
	processModelFile,
	processModelDirectory,
	processServiceDirectory,
	processServiceFile,
	generateDexieMigrationFromDir
} from "../generators/index.js";
import * as utils from "../utils/index.js";

// Detect and log runtime
const runtime = detectRuntime();

/**
 * Main CLI function with proper async handling
 */
async function main() {
	// Initialize configuration
	let config: Config;
	try {
		config = await initConfig();
		console.log(`SQLiteBridge running on: ${runtime}`);
	} catch (error) {
		console.error('Failed to load configuration:', error);
		process.exit(1);
	}

	// Destructure configuration values
	const { migrationsPath, generatedPath, queriesPath, withDexie, frameworkConfig, migrationPattern } = config;
	const { models, migrations, services, dexie, hooks, providers } = generatedPath;
	const { framework, servicePattern, generateHooks, generateProviders } = frameworkConfig

	/**
	 * Create and configure the main program
	 */
	const program = new Command();

	// Add version command
	program.command('version')
		.description('Display the version of SQLiteBridge')
		.action(() => {
			const packageInfo = utils.readPackageJson();
			console.log(`SQLiteBridge v${packageInfo.version} (${runtime})`);
		});

	// Add config help command
	program.command('config')
		.description('Show configuration help and current settings')
		.action(() => {
			console.log(getConfigHelp());
			console.log('\nCurrent Configuration:');
			console.log(JSON.stringify(config, null, 2));
		});

	/**
	 * Command to run all generators (models, migrations, services, dexie)
	 */
	program.command('all')
		.description('Generate all outputs: models, migrations, services, and optionally Dexie schema')
		.option('--dexie', 'Enable Dexie.js schema generation', false)
		.option('--framework <framework>', 'Target framework (react|angular)', framework)
		.action(async (options) => {
			console.log('Starting generation of all artifacts...');
			console.log(`Using migrations from: ${migrationsPath}`);
			console.log(`Using queries from: ${queriesPath}`);
			console.log(`Target framework: ${options.framework || framework}`);

			// Determine if Dexie should be generated
			const optDexie = options.dexie ? options.dexie : withDexie;
			if (optDexie) {
				console.log('Dexie.js schema generation is enabled');
			}

			try {
				// Generate models first as they're needed by other generators
				console.log('\nGenerating models...');
				await processModelDirectory(migrationsPath, models, migrationPattern, framework);

				// Generate SQLite migrations
				console.log('\nGenerating SQLite migrations...');
				await generateSqliteMigrationsFromDir(migrationsPath, migrations, migrationPattern, framework);

				// Generate services/hooks based on framework
				console.log(`\nGenerating ${framework} ${servicePattern}...`);
				await processServiceDirectory(
					queriesPath,
					migrationsPath,
					services,
					optDexie,
					migrationPattern,
					framework // Pass framework config
				);

				// Generate React-specific files if needed
				if (framework === 'react') {
					if (generateHooks && hooks) {
						console.log('\nGenerating React hooks...');
						// Implementation would generate hooks in the hooks directory
					}

					if (generateProviders && providers) {
						console.log('\nGenerating React providers...');
						// Implementation would generate providers in the providers directory
					}
				}

				// Generate Dexie schema if enabled
				if (optDexie) {
					console.log('\nGenerating Dexie.js schema...');
					await generateDexieMigrationFromDir(migrationsPath, dexie, migrationPattern);
				}

				console.log('\nAll artifacts generated successfully!');
				console.log(`Framework: ${framework}`);
				console.log(`Service pattern: ${servicePattern}`);
				console.log(`Runtime: ${runtime}`);
			} catch (error) {
				console.error('Error generating artifacts:', error);
				process.exit(1);
			}
		});

	/**
	 * Command to generate TypeScript models from SQLite migrations
	 */
	program.command('model')
		.description('Generate TypeScript models from SQLite migrations')
		.option('-f, --file <filepath>', 'Process a single migration file')
		.option('--output-dir <output-dir>', 'Directory for generated model files')
		.action(async (options) => {
			try {
				const outputDir = options.outputDir || models;
				console.log(`Generating models in: ${outputDir}`);
				console.log(`Framework: ${framework}`);

				if (options.file) {
					console.log(`Processing single file: ${options.file}`);
					await processModelFile(options.file, outputDir);
				} else {
					console.log(`Processing migrations directory: ${migrationsPath}`);
					await processModelDirectory(migrationsPath, outputDir, migrationPattern);
				}

				console.log('Model generation completed successfully');
			} catch (error) {
				console.error('Error generating models:', error);
				process.exit(1);
			}
		});

	/**
	 * Command to generate SQLite migrations from migration files
	 */
	program.command('migration')
		.description('Generate SQLite migration utilities from SQL files')
		.option('--output-file <output-file>', 'Path for the generated migrations file')
		.action(async (options) => {
			try {
				const outputFile = options.outputFile || migrations;
				console.log(`Generating migrations in: ${outputFile}`);
				console.log(`Processing migrations directory: ${migrationsPath}`);

				await generateSqliteMigrationsFromDir(migrationsPath, outputFile, migrationPattern);

				console.log('Migration generation completed successfully');
			} catch (error) {
				console.error('Error generating migrations:', error);
				process.exit(1);
			}
		});

	/**
	 * Command to generate service classes from SQL query files
	 */
	program.command('service')
		.description('Generate TypeScript service classes/hooks from SQL query files')
		.option('-f, --file <filepath>', 'Process a single query file')
		.option('--output-dir <output-dir>', 'Directory for generated service files')
		.option('--framework <framework>', 'Target framework (react|angular)', framework)
		.action(async (options) => {
			try {
				const outputDir = options.outputDir || services;
				const targetFramework = options.framework || framework;

				console.log(`Generating ${targetFramework} ${servicePattern} in: ${outputDir}`);

				if (options.file) {
					console.log(`Processing single query file: ${options.file}`);
					await processServiceFile(
						options.file,
						migrationsPath,
						outputDir,
						withDexie,
						migrationPattern,
						framework
					);
				} else {
					console.log(`Processing queries directory: ${queriesPath}`);
					console.log(`Using migrations from: ${migrationsPath}`);
					await processServiceDirectory(
						queriesPath,
						migrationsPath,
						outputDir,
						withDexie,
						migrationPattern,
						framework
					);
				}

				console.log(`${targetFramework} ${servicePattern} generation completed successfully`);
			} catch (error) {
				console.error('Error generating services:', error);
				process.exit(1);
			}
		});

	/**
	 * Command to generate Dexie.js schema from SQLite migrations
	 */
	program.command('dexie')
		.description('Generate Dexie.js schema from SQLite migrations')
		.option('--output-file <output-file>', 'Path for the generated Dexie schema file')
		.action(async (options) => {
			try {
				const outputFile = options.outputFile || dexie;
				console.log(`Generating Dexie schema in: ${outputFile}`);
				console.log(`Processing migrations directory: ${migrationsPath}`);

				await generateDexieMigrationFromDir(migrationsPath, outputFile, migrationPattern);

				console.log('Dexie schema generation completed successfully');
			} catch (error) {
				console.error('Error generating Dexie schema:', error);
				process.exit(1);
			}
		});

	// Parse command line arguments
	program.parse();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	process.exit(1);
});

// Run the main function
main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

// Usage examples in comments for documentation
/*
Usage Examples:

Node.js:
  npx sqlitebridge all --framework=react --dexie
  npx sqlitebridge model
  npx sqlitebridge service --framework=react

Bun:
  bunx sqlitebridge all --framework=react --dexie  
  bunx sqlitebridge model
  bunx sqlitebridge service --framework=react

Both will auto-detect runtime and use appropriate file operations!
*/
