import { FastifyInstance, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../config/database';
import orderQueueService from '../services/orderQueue';
import websocketManager from '../services/websocketManager';
import { OrderType, OrderStatus } from '../types/order.types';
import { logger } from '../utils/logger';

/**
 * Route params for order retrieval
 */
interface OrderParams {
  orderId: string;
}

/**
 * JSON schema for order ID parameter validation
 */
const orderParamsSchema = {
  params: {
    type: 'object',
    required: ['orderId'],
    properties: {
      orderId: { type: 'string', format: 'uuid' },
    },
  },
};

/**
 * Register order routes with Fastify
 * @param fastify - Fastify instance
 */
export default async function orderRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  /**
   * GET /api/orders/execute (WebSocket endpoint)
   * Execute order with WebSocket status updates
   */
  fastify.get(
    '/api/orders/execute',
    { websocket: true } as any,
    (connection: any, request: FastifyRequest) => {
      const socket = connection;
      const query = request.query as any;

      try {
        // Validate query parameters (sent as query params for WebSocket)
        const tokenIn = query.tokenIn;
        const tokenOut = query.tokenOut;
        const amount = parseFloat(query.amount);
        const orderType = query.orderType as OrderType;

        if (!tokenIn || !tokenOut || !amount || !orderType) {
          socket.send(
            JSON.stringify({
              error: 'Missing required parameters: tokenIn, tokenOut, amount, orderType',
              timestamp: new Date().toISOString(),
            })
          );
          socket.close();
          return;
        }

        // Generate unique order ID
        const orderId = uuidv4();

        logger.info(
          { orderId, orderType, amount },
          'Orders: New order request received'
        );

        // Register WebSocket connection
        websocketManager.registerConnection(orderId, socket);

        // Send initial response with orderId and PENDING status
        socket.send(
          JSON.stringify({
            orderId,
            status: OrderStatus.PENDING,
            timestamp: new Date().toISOString(),
            message: 'Order created and queued for processing',
          })
        );

        // Create order record in database and add to queue
        (async () => {
          try {
            await prisma.order.create({
              data: {
                id: orderId,
                tokenIn,
                tokenOut,
                amount,
                orderType,
                status: OrderStatus.PENDING,
              },
            });

            logger.info({ orderId }, 'Orders: Order record created in database');

            // Add order to processing queue
            const jobId = await orderQueueService.addOrder({
              id: orderId,
              tokenIn,
              tokenOut,
              amount,
              orderType,
            });

            logger.info({ orderId, jobId }, 'Orders: Order added to processing queue');
          } catch (error) {
            logger.error({ err: error, orderId }, 'Orders: Failed to create order');
            socket.send(
              JSON.stringify({
                error: 'Failed to create order',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
              })
            );
          }
        })();

        // Handle WebSocket close event
        socket.on('close', () => {
          logger.debug({ orderId }, 'Orders: WebSocket connection closed by client');
          websocketManager.closeConnection(orderId);
        });
      } catch (error) {
        logger.error({ err: error }, 'Orders: Error processing order execution request');

        socket.send(
          JSON.stringify({
            error: 'Failed to process order',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          })
        );
        socket.close();
      }
    }
  );

  /**
   * GET /api/orders/:orderId
   * Get order details by ID
   */
  fastify.get<{ Params: OrderParams }>(
    '/api/orders/:orderId',
    {
      schema: orderParamsSchema,
    },
    async (request, reply) => {
      try {
        const { orderId } = request.params;

        logger.debug({ orderId }, 'Orders: Fetching order details');

        const order = await prisma.order.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          logger.warn({ orderId }, 'Orders: Order not found');
          return reply.code(404).send({
            error: 'Not Found',
            message: `Order with ID ${orderId} not found`,
          });
        }

        logger.info({ orderId, status: order.status }, 'Orders: Order details retrieved');

        return reply.send({
          success: true,
          data: order,
        });
      } catch (error) {
        logger.error({ err: error }, 'Orders: Error fetching order');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch order details',
        });
      }
    }
  );

  /**
   * GET /api/health
   * Health check endpoint
   */
  fastify.get('/api/health', async (_request, reply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      // Get queue metrics
      const queueMetrics = await orderQueueService.getQueueMetrics();

      return reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          queue: 'operational',
        },
        queueMetrics: {
          waiting: queueMetrics.waiting,
          active: queueMetrics.active,
          completed: queueMetrics.completed,
          failed: queueMetrics.failed,
        },
        websocket: {
          activeConnections: websocketManager.getConnectionCount(),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Orders: Health check failed');
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  logger.info('Orders: Routes registered successfully');
}
