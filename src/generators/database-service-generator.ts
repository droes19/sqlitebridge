/**
 * Database Service Generator Module
 * 
 * This module generates a database service that handles both SQLite (native) and Dexie.js (web)
 * database operations. It supports both Angular and React frameworks with appropriate patterns.
 * 
 * @packageDocumentation
 */

import * as utils from '../utils';
import { FrameworkType } from '../config';
import {
	generateDatabaseServiceContent
} from './database-service-utils';

/**
 * Generates a database service file for the specified framework.
 * 
 * @param outputPath - Path where the database service file will be written
 * @param framework - Target framework ('angular' | 'react')
 * @param withDexie - Whether to include Dexie.js support
 * @returns Promise that resolves when the file is written
 * 
 * @example
 * ```typescript
 * // Generate Angular database service
 * await generateDatabaseService('./src/app/services/database.service.ts', 'angular', true);
 * 
 * // Generate React database service
 * await generateDatabaseService('./src/services/database.service.ts', 'react', true);
 * ```
 */
export async function generateDatabaseService(
	outputPath: string,
	framework: FrameworkType = 'angular',
	withDexie: boolean = true
): Promise<void> {
	try {
		console.log(`Generating database service for ${framework}...`);

		const serviceContent = generateDatabaseServiceContent(framework, withDexie);

		if (await utils.writeToFile(outputPath, serviceContent)) {
			console.log(`Successfully generated ${framework} database service.`);
			console.log(`Output written to: ${outputPath}`);
		}
	} catch (error) {
		console.error('Error generating database service:', error);
		throw error;
	}
}
