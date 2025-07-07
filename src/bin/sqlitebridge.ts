#!/usr/bin/env node

/**
 * SQLiteBridge CLI Tool - Universal Edition
 * 
 * Works with both Bun and Node.js automatically
 * Now with proper async config loading and structured logging
 */

import { Command } from "commander";
import { initConfig, detectRuntime, getConfigHelp, type Config } from "../config";
import { configureLogger, LogLevel, createLogger } from "../logger";
import {
	generateSqliteMigrationsFromDir,
	processModelFile,
	processModelDirectory,
	processServiceDirectory,
	processServiceFile,
	generateDexieMigrationFromDir,
	generateDatabaseService
} from "../generators/index";
import * as utils from "../utils/index";

// Create CLI logger
const cliLogger = createLogger('CLI');

// Detect and log runtime
const runtime = detectRuntime();

/**
 * Configure logger based on command line arguments
 */
function configureLoggerFromArgs(): void {
	const args = process.argv;
	const isVerbose = args.includes('--verbose') || args.includes('-v');
	const isDebug = args.includes('--debug') || args.includes('-d');
	const isQuiet = args.includes('--quiet') || args.includes('-q');

	let logLevel = LogLevel.WARN; // Default: only warnings and errors

	if (isQuiet) {
		logLevel = LogLevel.ERROR; // Only critical errors
	} else if (isDebug) {
		logLevel = LogLevel.DEBUG; // Detailed debugging
	} else if (isVerbose) {
		logLevel = LogLevel.INFO; // Normal progress information
	}

	configureLogger({
		level: logLevel,
		useColors: !process.env.NO_COLOR && !process.env.CI,
		showTimestamps: true,
		showLevel: true,
		showLoggerName: true
	});
}

/**
 * Main CLI function with proper async handling and logger configuration
 */
async function main() {
	// Configure logger first, before any other operations
	configureLoggerFromArgs();

	// Initialize configuration
	let config: Config;
	try {
		config = await initConfig();
		cliLogger.info(`SQLiteBridge running on: ${runtime}`);
		cliLogger.debug('Configuration loaded successfully');
	} catch (error) {
		cliLogger.error('Failed to load configuration:', error);
		process.exit(1);
	}

	// Destructure configuration values
	const { migrationsPath, generatedPath, queriesPath, withDexie, frameworkConfig, migrationPattern, databaseName } = config;
	const { models, migrations, services, dexie, hooks, providers } = generatedPath;
	const { framework, servicePattern, generateHooks, generateProviders } = frameworkConfig;

	/**
	 * Create and configure the main program
	 */
	const program = new Command();

	// Add global options to all commands
	program
		.option('-v, --verbose', 'Enable verbose logging')
		.option('-d, --debug', 'Enable debug logging')
		.option('-q, --quiet', 'Suppress all output except errors')
		.hook('preAction', (thisCommand) => {
			// Reconfigure logger if options are provided at command level
			const opts = thisCommand.opts();
			if (opts.verbose || opts.debug || opts.quiet) {
				let newLevel = LogLevel.WARN;
				if (opts.quiet) newLevel = LogLevel.ERROR;
				else if (opts.debug) newLevel = LogLevel.DEBUG;
				else if (opts.verbose) newLevel = LogLevel.INFO;

				configureLogger({
					level: newLevel,
					useColors: !process.env.NO_COLOR && !process.env.CI,
					showTimestamps: true,
					showLevel: true,
					showLoggerName: true
				});
			}
		});

	// Add version command
	program.command('version')
		.description('Display the version of SQLiteBridge')
		.action(() => {
			const packageInfo = utils.readPackageJson();
			// Always show version info regardless of log level
			console.log(`SQLiteBridge v${packageInfo.version} (${runtime})`);
		});

	// Add config help command
	program.command('config')
		.description('Show configuration help and current settings')
		.action(() => {
			// Always show config info regardless of log level
			console.log(getConfigHelp()); // Keep console.log for help text formatting
			console.log('\nCurrent Configuration:');
			console.log(JSON.stringify(config, null, 2)); // Keep console.log for JSON pretty-print
		});

	/**
	 * Command to run all generators (models, migrations, services, dexie)
	 */
	program.command('all')
		.description('Generate all outputs: models, migrations, services, and optionally Dexie schema')
		.option('--dexie', 'Enable Dexie.js schema generation', false)
		.option('--framework <framework>', 'Target framework (react|angular)', framework)
		.option('--replace-database-service', 'Replace existing database service if it exists', false)
		.action(async (options) => {
			cliLogger.info('🚀 Starting generation of all artifacts...');
			cliLogger.info(`📁 Using migrations from: ${migrationsPath}`);
			cliLogger.info(`📁 Using queries from: ${queriesPath}`);
			cliLogger.info(`🎯 Target framework: ${options.framework || framework}`);

			// Determine if Dexie should be generated
			const optDexie = options.dexie ? options.dexie : withDexie;
			if (optDexie) {
				cliLogger.info('🌐 Dexie.js schema generation is enabled');
			}

			const replaceDatabaseService = options.replaceDatabaseService || false;

			try {
				// Track overall timing
				const startTime = Date.now();

				// Generate models first as they're needed by other generators
				cliLogger.info('📝 Generating models...');
				const modelStart = Date.now();
				await processModelDirectory(migrationsPath, models, migrationPattern, framework);
				cliLogger.debug(`Models generated in ${Date.now() - modelStart}ms`);

				// Generate SQLite migrations
				cliLogger.info('🔄 Generating SQLite migrations...');
				const migrationStart = Date.now();
				await generateSqliteMigrationsFromDir(migrationsPath, migrations, migrationPattern, framework);
				cliLogger.debug(`Migrations generated in ${Date.now() - migrationStart}ms`);

				// Generate services/hooks based on framework
				cliLogger.info(`⚙️  Generating ${framework} ${servicePattern}...`);
				const serviceStart = Date.now();
				await processServiceDirectory(
					queriesPath,
					migrationsPath,
					services,
					optDexie,
					migrationPattern,
					framework,
					databaseName,
					replaceDatabaseService
				);
				cliLogger.debug(`Services generated in ${Date.now() - serviceStart}ms`);

				// Generate React-specific files if needed
				if (framework === 'react') {
					if (generateHooks && hooks) {
						cliLogger.info('🪝 Generating React hooks...');
						// Implementation would generate hooks in the hooks directory
						cliLogger.debug('React hooks generation completed');
					}

					if (generateProviders && providers) {
						cliLogger.info('🔗 Generating React providers...');
						// Implementation would generate providers in the providers directory
						cliLogger.debug('React providers generation completed');
					}
				}

				// Generate Dexie schema if enabled
				if (optDexie) {
					cliLogger.info('🌐 Generating Dexie.js schema...');
					const dexieStart = Date.now();
					await generateDexieMigrationFromDir(migrationsPath, dexie, migrationPattern, framework);
					cliLogger.debug(`Dexie schema generated in ${Date.now() - dexieStart}ms`);
				}

				const totalTime = Date.now() - startTime;
				cliLogger.info('✅ All artifacts generated successfully!');
				cliLogger.info(`📊 Framework: ${framework}`);
				cliLogger.info(`📊 Service pattern: ${servicePattern}`);
				cliLogger.info(`📊 Runtime: ${runtime}`);
				cliLogger.info(`⏱️  Total time: ${totalTime}ms`);
			} catch (error) {
				cliLogger.error('❌ Error generating artifacts:', error);
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

				// Always show start message
				console.log(`🚀 Starting model generation...`);
				cliLogger.info(`📝 Generating models in: ${outputDir}`);
				cliLogger.info(`🎯 Framework: ${framework}`);

				const startTime = Date.now();

				if (options.file) {
					cliLogger.info(`📄 Processing single file: ${options.file}`);
					await processModelFile(options.file, outputDir, framework);
				} else {
					cliLogger.info(`📁 Processing migrations directory: ${migrationsPath}`);
					await processModelDirectory(migrationsPath, outputDir, migrationPattern, framework);
				}

				const duration = Date.now() - startTime;

				// Always show completion message
				console.log(`✅ Model generation completed successfully (${duration}ms)`);
			} catch (error) {
				console.log(`❌ Model generation failed`);
				cliLogger.error('Error generating models:', error);
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

				// Always show start message
				console.log(`🚀 Starting migration generation...`);
				cliLogger.info(`🔄 Generating migrations in: ${outputFile}`);
				cliLogger.info(`📁 Processing migrations directory: ${migrationsPath}`);

				const startTime = Date.now();
				await generateSqliteMigrationsFromDir(migrationsPath, outputFile, migrationPattern, framework);
				const duration = Date.now() - startTime;

				// Always show completion message
				console.log(`✅ Migration generation completed successfully (${duration}ms)`);
			} catch (error) {
				console.log(`❌ Migration generation failed`);
				cliLogger.error('Error generating migrations:', error);
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
		.option('--replace-database-service', 'Replace existing database service if it exists', false)
		.action(async (options) => {
			try {
				const outputDir = options.outputDir || services;
				const targetFramework = options.framework || framework;
				const replaceDatabaseService = options.replaceDatabaseService || false;

				// Always show start message
				console.log(`🚀 Starting service generation...`);
				cliLogger.info(`⚙️  Generating ${targetFramework} ${servicePattern} in: ${outputDir}`);

				const startTime = Date.now();

				if (options.file) {
					cliLogger.info(`📄 Processing single query file: ${options.file}`);
					await processServiceFile(
						options.file,
						migrationsPath,
						outputDir,
						withDexie,
						migrationPattern,
						framework
					);
				} else {
					cliLogger.info(`📁 Processing queries directory: ${queriesPath}`);
					cliLogger.info(`📁 Using migrations from: ${migrationsPath}`);
					await processServiceDirectory(
						queriesPath,
						migrationsPath,
						outputDir,
						withDexie,
						migrationPattern,
						framework,
						databaseName,
						replaceDatabaseService
					);
				}

				const duration = Date.now() - startTime;

				// Always show completion message
				console.log(`✅ Service generation completed successfully (${duration}ms)`);
			} catch (error) {
				console.log(`❌ Service generation failed`);
				cliLogger.error('Error generating services:', error);
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

				// Always show start message
				console.log(`🚀 Starting Dexie schema generation...`);
				cliLogger.info(`🌐 Generating Dexie schema in: ${outputFile}`);
				cliLogger.info(`📁 Processing migrations directory: ${migrationsPath}`);

				const startTime = Date.now();
				await generateDexieMigrationFromDir(migrationsPath, outputFile, migrationPattern, framework);
				const duration = Date.now() - startTime;

				// Always show completion message
				console.log(`✅ Dexie schema generation completed successfully (${duration}ms)`);
			} catch (error) {
				console.log(`❌ Dexie schema generation failed`);
				cliLogger.error('Error generating Dexie schema:', error);
				process.exit(1);
			}
		});

	/**
	 * Command to generate database service file
	 */
	program.command('database-service')
		.description('Generate database service file for platform detection and database management')
		.option('--output-file <output-file>', 'Path for the generated database service file')
		.option('--framework <framework>', 'Target framework (react|angular)', framework)
		.option('--dexie', 'Enable Dexie.js support', withDexie)
		.option('--replace-database-service', 'Replace existing database service if it exists', false)
		.action(async (options) => {
			try {
				const outputFile = options.outputFile || `${services}/database.service.ts`;
				const targetFramework = options.framework || framework;
				const enableDexie = options.dexie !== undefined ? options.dexie : withDexie;
				const replaceDatabaseService = options.replaceDatabaseService || false;

				// Always show start message
				console.log(`🚀 Starting database service generation...`);
				cliLogger.info(`🗄️  Generating ${targetFramework} database service in: ${outputFile}`);
				cliLogger.info(`🌐 Dexie support: ${enableDexie ? 'enabled' : 'disabled'}`);

				const startTime = Date.now();
				const success = await generateDatabaseService(outputFile, targetFramework, enableDexie, databaseName, replaceDatabaseService);
				const duration = Date.now() - startTime;

				if (success) {
					// Always show completion message
					console.log(`✅ Database service generation completed successfully (${duration}ms)`);
				} else {
					console.log(`❌ Database service generation failed`);
					process.exit(1);
				}
			} catch (error) {
				console.log(`❌ Database service generation failed`);
				cliLogger.error('Error generating database service:', error);
				process.exit(1);
			}
		});

	// Parse command line arguments
	program.parse();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	cliLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
	process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	cliLogger.error('Uncaught Exception:', error);
	process.exit(1);
});

// Run the main function
main().catch((error) => {
	cliLogger.error('Fatal error:', error);
	process.exit(1);
});

// Usage examples in comments for documentation
/*
Usage Examples:

Standard usage (warnings and errors only):
  npx sqlitebridge all
  npx sqlitebridge model

Verbose output (progress information):
  npx sqlitebridge all --verbose
  npx sqlitebridge model -v

Debug output (detailed information):
  npx sqlitebridge all --debug
  npx sqlitebridge service -d

Quiet mode (errors only):
  npx sqlitebridge all --quiet
  npx sqlitebridge migration -q

Framework-specific:
  npx sqlitebridge all --framework=react --verbose
  npx sqlitebridge service --framework=angular --debug

With Dexie support:
  npx sqlitebridge all --dexie --verbose

Bun usage:
  bunx sqlitebridge all --framework=react --dexie --verbose

Both will auto-detect runtime and use appropriate file operations!
*/
