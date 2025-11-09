import pino, { Logger } from 'pino';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = (process.env.LOG_LEVEL || 'info') as pino.Level;

/**
 * Pino logger configuration
 */
const loggerConfig: pino.LoggerOptions = {
  level: logLevel,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
};

/**
 * Create logger transport based on environment
 */
const createTransport = (): pino.TransportSingleOptions | pino.TransportMultiOptions => {
  if (isDevelopment) {
    // Development: Pretty print to console with colors
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        singleLine: false,
        messageFormat: '{levelLabel} - {msg}',
      },
    };
  }

  // Production: Write to files
  return {
    targets: [
      {
        target: 'pino/file',
        level: 'info',
        options: {
          destination: path.join(process.cwd(), 'logs', 'combined.log'),
          mkdir: true,
        },
      },
      {
        target: 'pino/file',
        level: 'error',
        options: {
          destination: path.join(process.cwd(), 'logs', 'error.log'),
          mkdir: true,
        },
      },
      {
        target: 'pino/file',
        level: 'info',
        options: {
          destination: 1, // stdout
        },
      },
    ],
  };
};

/**
 * Create and export logger instance
 */
export const logger: Logger = pino(
  loggerConfig,
  pino.transport(createTransport())
);

/**
 * Create child logger with additional context
 * @param context - Additional context to include in logs
 * @returns Child logger instance
 */
export const createLogger = (context: Record<string, unknown>): Logger => {
  return logger.child(context);
};

/**
 * Log an info message
 * @param message - Log message
 * @param meta - Additional metadata
 */
export const info = (message: string, meta?: Record<string, unknown>): void => {
  logger.info(meta || {}, message);
};

/**
 * Log an error message
 * @param message - Error message
 * @param error - Error object or metadata
 */
export const error = (message: string, error?: Error | Record<string, unknown>): void => {
  if (error instanceof Error) {
    logger.error({ err: error }, message);
  } else {
    logger.error(error || {}, message);
  }
};

/**
 * Log a warning message
 * @param message - Warning message
 * @param meta - Additional metadata
 */
export const warn = (message: string, meta?: Record<string, unknown>): void => {
  logger.warn(meta || {}, message);
};

/**
 * Log a debug message
 * @param message - Debug message
 * @param meta - Additional metadata
 */
export const debug = (message: string, meta?: Record<string, unknown>): void => {
  logger.debug(meta || {}, message);
};

/**
 * Log a trace message
 * @param message - Trace message
 * @param meta - Additional metadata
 */
export const trace = (message: string, meta?: Record<string, unknown>): void => {
  logger.trace(meta || {}, message);
};

export default logger;
