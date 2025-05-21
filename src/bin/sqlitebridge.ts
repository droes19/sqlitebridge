#!/usr/bin/env node

/**
 * SQLiteBridge CLI Tool
 * 
 * This is the main entry point for the SQLiteBridge command-line interface.
 * It handles command parsing and dispatches to the appropriate generators.
 * 
 * @packageDocumentation
 */

import { Command } from "commander";
import config, { otherConfig } from "../config";
import { 
  generateSqliteMigrationsFromDir, 
  processModelFile, 
  processModelDirectory, 
  processServiceDirectory, 
  processServiceFile, 
  generateDexieMigrationFromDir 
} from "../generators";
import * as utils from "../utils";

// Destructure configuration values for easier access
const { migrationsPath, generatedPath, queriesPath, withDexie } = config;
const { models, migrations, services, dexie } = generatedPath;

/**
 * Create and configure the main program
 */
const program = new Command();

// Add version command
program.command('version')
  .description('Display the version of SQLiteBridge')
  .action(() => {
    const packageInfo = utils.readPackageJson();
    console.log(`SQLiteBridge v${packageInfo.version}`);
  });

/**
 * Command to run all generators (models, migrations, services, dexie)
 */
program.command('all')
  .description('Generate all outputs: models, migrations, services, and optionally Dexie schema')
  .option('--dexie', 'Enable Dexie.js schema generation', false)
  .action(async (options) => {
    console.log('Starting generation of all artifacts...');
    console.log(`Using migrations from: ${migrationsPath}`);
    console.log(`Using queries from: ${queriesPath}`);
    
    // Determine if Dexie should be generated
    const optDexie = options.dexie ? options.dexie : withDexie;
    if (optDexie) {
      console.log('Dexie.js schema generation is enabled');
    }

    try {
      // Generate models first as they're needed by other generators
      console.log('\nGenerating models...');
      await processModelDirectory(migrationsPath, models, otherConfig.migrationPattern);
      
      // Generate SQLite migrations
      console.log('\nGenerating SQLite migrations...');
      await generateSqliteMigrationsFromDir(migrationsPath, migrations, otherConfig.migrationPattern);
      
      // Generate services
      console.log('\nGenerating services...');
      await processServiceDirectory(queriesPath, migrationsPath, services, optDexie, otherConfig.migrationPattern);
      
      // Generate Dexie schema if enabled
      if (optDexie) {
        console.log('\nGenerating Dexie.js schema...');
        await generateDexieMigrationFromDir(migrationsPath, dexie, otherConfig.migrationPattern);
      }
      
      console.log('\nAll artifacts generated successfully!');
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
  .action((options) => {
    try {
      const outputDir = options.outputDir || models;
      console.log(`Generating models in: ${outputDir}`);
      
      if (options.file) {
        console.log(`Processing single file: ${options.file}`);
        processModelFile(options.file, outputDir);
      } else {
        console.log(`Processing migrations directory: ${migrationsPath}`);
        processModelDirectory(migrationsPath, outputDir, otherConfig.migrationPattern);
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
  .action((options) => {
    try {
      const outputFile = options.outputFile || migrations;
      console.log(`Generating migrations in: ${outputFile}`);
      console.log(`Processing migrations directory: ${migrationsPath}`);
      
      generateSqliteMigrationsFromDir(migrationsPath, outputFile, otherConfig.migrationPattern);
      
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
  .description('Generate TypeScript service classes from SQL query files')
  .option('-f, --file <filepath>', 'Process a single query file')
  .option('--output-dir <output-dir>', 'Directory for generated service files')
  .action((options) => {
    try {
      const outputDir = options.outputDir || services;
      console.log(`Generating services in: ${outputDir}`);
      
      if (options.file) {
        console.log(`Processing single query file: ${options.file}`);
        processServiceFile(options.file, migrationsPath, outputDir, withDexie, otherConfig.migrationPattern);
      } else {
        console.log(`Processing queries directory: ${queriesPath}`);
        console.log(`Using migrations from: ${migrationsPath}`);
        processServiceDirectory(queriesPath, migrationsPath, outputDir, withDexie, otherConfig.migrationPattern);
      }
      
      console.log('Service generation completed successfully');
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
  .action((options) => {
    try {
      const outputFile = options.outputFile || dexie;
      console.log(`Generating Dexie schema in: ${outputFile}`);
      console.log(`Processing migrations directory: ${migrationsPath}`);
      
      generateDexieMigrationFromDir(migrationsPath, outputFile, otherConfig.migrationPattern);
      
      console.log('Dexie schema generation completed successfully');
    } catch (error) {
      console.error('Error generating Dexie schema:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();