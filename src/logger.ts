/**
 * Logger Module
 * 
 * This module provides a standardized logging system for the SQLiteBridge toolkit.
 * It supports different verbosity levels and color-coded output.
 * 
 * @packageDocumentation
 */

/**
 * Log levels for the logger
 */
export enum LogLevel {
    /** Critical errors that prevent the application from continuing */
    ERROR = 0,
    /** Important warnings that don't stop the application */
    WARN = 1,
    /** General information about the application's progress */
    INFO = 2,
    /** Detailed information for debugging purposes */
    DEBUG = 3,
    /** Highly detailed tracing information */
    TRACE = 4
}

/**
 * ANSI color codes for terminal output
 */
const Colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

/**
 * Logger configuration options
 */
export interface LoggerConfig {
    /** Maximum log level to display */
    level: LogLevel;
    /** Whether to use colors in the output */
    useColors: boolean;
    /** Whether to include timestamps in log messages */
    showTimestamps: boolean;
    /** Whether to show log level in the output */
    showLevel: boolean;
    /** Whether to include the logger name in the output */
    showLoggerName: boolean;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
    level: LogLevel.INFO,
    useColors: true,
    showTimestamps: true,
    showLevel: true,
    showLoggerName: true
};

/**
 * Current logger configuration
 */
let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * Logger class for consistent logging throughout the application
 */
export class Logger {
    private name: string;

    /**
     * Create a new logger instance
     * 
     * @param name - Name of the logger (usually the module name)
     */
    constructor(name: string) {
        this.name = name;
    }

    /**
     * Log an error message
     * 
     * @param message - Message to log
     * @param ...args - Additional arguments to log
     */
    error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, message, args);
    }

    /**
     * Log a warning message
     * 
     * @param message - Message to log
     * @param ...args - Additional arguments to log
     */
    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, args);
    }

    /**
     * Log an informational message
     * 
     * @param message - Message to log
     * @param ...args - Additional arguments to log
     */
    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, args);
    }

    /**
     * Log a debug message
     * 
     * @param message - Message to log
     * @param ...args - Additional arguments to log
     */
    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, args);
    }

    /**
     * Log a trace message
     * 
     * @param message - Message to log
     * @param ...args - Additional arguments to log
     */
    trace(message: string, ...args: any[]): void {
        this.log(LogLevel.TRACE, message, args);
    }

    /**
     * Log a message at a specific level
     * 
     * @param level - Log level
     * @param message - Message to log
     * @param args - Additional arguments to log
     */
    private log(level: LogLevel, message: string, args: any[]): void {
        // Skip if current log level is lower than requested level
        if (level > currentConfig.level) {
            return;
        }

        // Build log components
        const components: string[] = [];

        // Add timestamp if configured
        if (currentConfig.showTimestamps) {
            components.push(this.getTimestamp());
        }

        // Add log level if configured
        if (currentConfig.showLevel) {
            const levelString = this.getLevelString(level);
            components.push(levelString);
        }

        // Add logger name if configured
        if (currentConfig.showLoggerName) {
            components.push(`[${this.name}]`);
        }

        // Add message
        components.push(message);

        // Build log string
        let logString = components.join(' ');

        // Add color if configured
        if (currentConfig.useColors) {
            logString = this.colorize(level, logString);
        }

        // Log to console
        switch (level) {
            case LogLevel.ERROR:
                console.error(logString, ...args);
                break;
            case LogLevel.WARN:
                console.warn(logString, ...args);
                break;
            default:
                console.log(logString, ...args);
                break;
        }
    }

    /**
     * Get a timestamp string for the current time
     * 
     * @returns Formatted timestamp string
     */
    private getTimestamp(): string {
        const now = new Date();
        return `[${now.toISOString()}]`;
    }

    /**
     * Get a string representation of a log level
     * 
     * @param level - Log level
     * @returns String representation of the log level
     */
    private getLevelString(level: LogLevel): string {
        switch (level) {
            case LogLevel.ERROR:
                return '[ERROR]';
            case LogLevel.WARN:
                return '[WARN]';
            case LogLevel.INFO:
                return '[INFO]';
            case LogLevel.DEBUG:
                return '[DEBUG]';
            case LogLevel.TRACE:
                return '[TRACE]';
            default:
                return `[LEVEL ${level}]`;
        }
    }

    /**
     * Add ANSI color codes to a string based on log level
     * 
     * @param level - Log level
     * @param str - String to colorize
     * @returns Colorized string
     */
    private colorize(level: LogLevel, str: string): string {
        switch (level) {
            case LogLevel.ERROR:
                return `${Colors.red}${str}${Colors.reset}`;
            case LogLevel.WARN:
                return `${Colors.yellow}${str}${Colors.reset}`;
            case LogLevel.INFO:
                return `${Colors.green}${str}${Colors.reset}`;
            case LogLevel.DEBUG:
                return `${Colors.cyan}${str}${Colors.reset}`;
            case LogLevel.TRACE:
                return `${Colors.gray}${str}${Colors.reset}`;
            default:
                return str;
        }
    }
}

/**
 * Configure the logger
 * 
 * @param config - Logger configuration options
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
    currentConfig = { ...currentConfig, ...config };
}

/**
 * Get the current logger configuration
 * 
 * @returns Current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
    return { ...currentConfig };
}

/**
 * Create a new logger instance
 * 
 * @param name - Name of the logger (usually the module name)
 * @returns New logger instance
 * 
 * @example
 * ```typescript
 * const logger = createLogger('MyModule');
 * logger.info('Application started');
 * logger.error('Something went wrong', { details: error });
 * ```
 */
export function createLogger(name: string): Logger {
    return new Logger(name);
}

/**
 * A default logger instance for quick access
 */
export const logger = createLogger('SQLiteBridge');