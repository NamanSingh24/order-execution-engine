import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { connectDatabase, disconnectDatabase } from './config/database';
import { closeRedisConnection } from './config/redis';
import { OrderProcessor } from './services/orderProcessor';
import websocketManager from './services/websocketManager';
import orderRoutes from './routes/orders';
import { logger } from './utils/logger';

// Load environment variables
config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Create and configure Fastify server
 */
const buildServer = async () => {
  const fastify = Fastify({
    logger: false, // Using custom Pino logger instead
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
  });

  try {
    // Register CORS plugin
    await fastify.register(cors, {
      origin: isDevelopment ? '*' : process.env.ALLOWED_ORIGINS?.split(',') || false,
      credentials: true,
    });

    logger.info('Server: CORS plugin registered');

    // Register WebSocket plugin
    await fastify.register(websocket);
    logger.info('Server: WebSocket plugin registered');

    // Add request logging middleware
    fastify.addHook('onRequest', async (request) => {
      logger.info(
        {
          method: request.method,
          url: request.url,
          ip: request.ip,
          reqId: request.id,
        },
        'Server: Incoming request'
      );
    });

    // Add response logging middleware
    fastify.addHook('onResponse', async (request, reply) => {
      logger.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: reply.elapsedTime,
          reqId: request.id,
        },
        'Server: Request completed'
      );
    });

    // Register routes
    await fastify.register(orderRoutes);
    logger.info('Server: Order routes registered');

    // Root endpoint
    fastify.get('/', async () => {
      return {
        service: 'order-execution-engine',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
      };
    });

    return fastify;
  } catch (error) {
    logger.error({ err: error }, 'Server: Failed to build server');
    throw error;
  }
};

/**
 * Start the server and all services
 */
const start = async () => {
  let fastify: Awaited<ReturnType<typeof buildServer>>;
  let orderProcessor: OrderProcessor;

  try {
    logger.info('Server: Starting application...');

    // Connect to database
    await connectDatabase();

    // Build and start Fastify server
    fastify = await buildServer();

    // Initialize OrderProcessor with WebSocket emitter
    orderProcessor = new OrderProcessor({
      emitOrderUpdate: (orderId, status, data) => {
        websocketManager.sendStatusUpdate(orderId, status, data);
      },
    });

    logger.info('Server: OrderProcessor initialized');

    // Start listening
    await fastify.listen({ port: PORT, host: HOST });

    logger.info(
      { port: PORT, host: HOST, env: process.env.NODE_ENV },
      'Server: Application started successfully'
    );

    console.log(`\n🚀 Server is running on http://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
    console.log(`🔌 WebSocket: ws://${HOST}:${PORT}/api/orders/execute\n`);

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Server: Received shutdown signal');

      try {
        // Close Fastify server (stop accepting new requests)
        logger.info('Server: Closing Fastify server...');
        await fastify.close();
        logger.info('Server: Fastify server closed');

        // Stop OrderProcessor worker
        logger.info('Server: Stopping OrderProcessor...');
        await orderProcessor.close();
        logger.info('Server: OrderProcessor stopped');

        // Close all WebSocket connections
        logger.info('Server: Closing WebSocket connections...');
        websocketManager.closeAll();
        logger.info('Server: WebSocket connections closed');

        // Disconnect from database
        logger.info('Server: Disconnecting from database...');
        await disconnectDatabase();
        logger.info('Server: Database disconnected');

        // Close Redis connections
        logger.info('Server: Closing Redis connections...');
        await closeRedisConnection();
        logger.info('Server: Redis connections closed');

        logger.info('Server: Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, 'Server: Error during graceful shutdown');
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error({ err: error }, 'Server: Uncaught exception');
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error(
        { reason, promise },
        'Server: Unhandled promise rejection'
      );
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error({ err: error }, 'Server: Failed to start application');
    process.exit(1);
  }
};

// Start the server
start();

export default start;
