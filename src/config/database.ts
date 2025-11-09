import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
config();

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * PrismaClient singleton instance
 */
let prismaClient: PrismaClient | null = null;

/**
 * Prisma Client configuration options
 */
const prismaOptions = {
  log: isDevelopment
    ? [
        { emit: 'event' as const, level: 'query' as const },
        { emit: 'event' as const, level: 'error' as const },
        { emit: 'event' as const, level: 'info' as const },
        { emit: 'event' as const, level: 'warn' as const },
      ]
    : [{ emit: 'event' as const, level: 'error' as const }],
};

/**
 * Get or create PrismaClient singleton instance
 * @returns PrismaClient instance
 */
export const getPrismaClient = (): PrismaClient => {
  if (prismaClient) {
    return prismaClient;
  }

  try {
    prismaClient = new PrismaClient(prismaOptions);

    // Set up logging event listeners
    if (isDevelopment) {
      prismaClient.$on('query' as never, (e: any) => {
        logger.debug({
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        }, 'Prisma Query');
      });
    }

    prismaClient.$on('error' as never, (e: any) => {
      logger.error({ error: e }, 'Prisma Error');
    });

    prismaClient.$on('info' as never, (e: any) => {
      logger.info({ message: e.message }, 'Prisma Info');
    });

    prismaClient.$on('warn' as never, (e: any) => {
      logger.warn({ message: e.message }, 'Prisma Warning');
    });

    logger.info('Database: PrismaClient initialized successfully');

    return prismaClient;
  } catch (error) {
    logger.error({ err: error }, 'Database: Failed to initialize PrismaClient');
    throw new Error(`Failed to initialize database connection: ${error}`);
  }
};

/**
 * Connect to the database
 * @returns Promise that resolves when connection is established
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    const client = getPrismaClient();
    await client.$connect();
    logger.info('Database: Connected successfully');
  } catch (error) {
    logger.error({ err: error }, 'Database: Connection failed');
    throw error;
  }
};

/**
 * Disconnect from the database gracefully
 * @returns Promise that resolves when disconnection is complete
 */
export const disconnectDatabase = async (): Promise<void> => {
  if (prismaClient) {
    try {
      await prismaClient.$disconnect();
      logger.info('Database: Disconnected successfully');
      prismaClient = null;
    } catch (error) {
      logger.error({ err: error }, 'Database: Error during disconnection');
      prismaClient = null;
      throw error;
    }
  }
};

/**
 * Check database connection health
 * @returns Promise<boolean> indicating if database is accessible
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database: Health check failed');
    return false;
  }
};

/**
 * Graceful shutdown handler
 */
const setupGracefulShutdown = (): void => {
  const shutdownHandler = async (signal: string) => {
    logger.info(`Database: Received ${signal}, disconnecting...`);
    try {
      await disconnectDatabase();
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'Database: Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('beforeExit', () => {
    disconnectDatabase().catch((error) => {
      logger.error('Database: Error during beforeExit cleanup', error);
    });
  });
};

// Set up graceful shutdown handlers
setupGracefulShutdown();

export default {
  getPrismaClient,
  connectDatabase,
  disconnectDatabase,
  checkDatabaseHealth,
};
