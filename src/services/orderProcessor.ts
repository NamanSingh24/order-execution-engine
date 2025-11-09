import { Worker, Job } from 'bullmq';
import { getRedisConfig } from '../config/redis';
import { getPrismaClient } from '../config/database';
import dexRouter from './dexRouter';
import { OrderStatus, CreateOrderDTO } from '../types/order.types';
import { logger } from '../utils/logger';

/**
 * Job data interface for order processing
 */
interface OrderJobData extends CreateOrderDTO {
  id: string;
}

/**
 * WebSocket emitter interface (to be implemented by WebSocket service)
 */
interface WebSocketEmitter {
  emitOrderUpdate: (orderId: string, status: OrderStatus, data?: any) => void;
}

/**
 * Order processor service using BullMQ Worker
 * Handles the complete order execution lifecycle
 */
export class OrderProcessor {
  private worker: Worker;
  private prisma = getPrismaClient();
  private wsEmitter?: WebSocketEmitter;

  constructor(wsEmitter?: WebSocketEmitter) {
    this.wsEmitter = wsEmitter;

    const redisConfig = getRedisConfig();

    try {
      this.worker = new Worker(
        'orders',
        async (job: Job<OrderJobData>) => {
          return await this.processOrder(job);
        },
        {
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          },
          concurrency: 10, // Process 10 jobs concurrently
          limiter: {
            max: 100, // Maximum 100 jobs
            duration: 60000, // Per 60 seconds
          },
        }
      );

      // Set up worker event listeners
      this.worker.on('completed', (job) => {
        logger.info(
          { jobId: job.id, orderId: job.data.id },
          'OrderProcessor: Job completed successfully'
        );
      });

      this.worker.on('failed', (job, error) => {
        logger.error(
          { jobId: job?.id, orderId: job?.data?.id, err: error },
          'OrderProcessor: Job failed'
        );
      });

      this.worker.on('error', (error) => {
        logger.error({ err: error }, 'OrderProcessor: Worker error');
      });

      logger.info('OrderProcessor: Worker initialized successfully');
    } catch (error) {
      logger.error({ err: error }, 'OrderProcessor: Failed to initialize worker');
      throw new Error(`Failed to initialize order processor: ${error}`);
    }
  }

  /**
   * Process an order through the complete execution lifecycle
   * @param job - BullMQ job containing order data
   * @returns Promise<void>
   */
  private async processOrder(job: Job<OrderJobData>): Promise<void> {
    const orderData = job.data;
    const orderId = orderData.id;

    try {
      logger.info({ orderId, jobId: job.id }, 'OrderProcessor: Starting order processing');

      // Step 1: Update order status to ROUTING
      await this.updateOrderStatus(orderId, OrderStatus.ROUTING);
      this.emitWebSocketUpdate(orderId, OrderStatus.ROUTING);

      // Step 2: Get best route from DEX router
      logger.debug({ orderId }, 'OrderProcessor: Fetching DEX quotes');
      
      // First, retrieve the full order from database
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found in database`);
      }

      // Step 3: Update status to BUILDING
      await this.updateOrderStatus(orderId, OrderStatus.BUILDING);
      this.emitWebSocketUpdate(orderId, OrderStatus.BUILDING);

      // Step 4: Execute the order through MockDexRouter
      logger.debug({ orderId }, 'OrderProcessor: Executing order');
      const executionResult = await dexRouter.executeBestRoute(order);

      // Step 5: Update status to SUBMITTED with transaction hash
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.SUBMITTED,
          txHash: executionResult.txHash,
          executedPrice: executionResult.executedPrice,
          dex: executionResult.dex,
        },
      });

      this.emitWebSocketUpdate(orderId, OrderStatus.SUBMITTED, {
        txHash: executionResult.txHash,
        dex: executionResult.dex,
        executedPrice: executionResult.executedPrice,
      });

      logger.info(
        {
          orderId,
          txHash: executionResult.txHash,
          dex: executionResult.dex,
        },
        'OrderProcessor: Order submitted to blockchain'
      );

      // Step 6: Wait 2 seconds to simulate blockchain confirmation
      await this.sleep(2000);

      // Step 7: Update to CONFIRMED
      await this.updateOrderStatus(orderId, OrderStatus.CONFIRMED);
      this.emitWebSocketUpdate(orderId, OrderStatus.CONFIRMED, {
        txHash: executionResult.txHash,
        dex: executionResult.dex,
        executedPrice: executionResult.executedPrice,
      });

      logger.info({ orderId, txHash: executionResult.txHash }, 'OrderProcessor: Order confirmed');
    } catch (error) {
      logger.error({ err: error, orderId }, 'OrderProcessor: Order processing failed');

      // Update order status to FAILED
      await this.updateOrderStatus(orderId, OrderStatus.FAILED);
      this.emitWebSocketUpdate(orderId, OrderStatus.FAILED, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error; // Re-throw to mark job as failed
    }
  }

  /**
   * Update order status in database
   * @param orderId - Order ID
   * @param status - New status
   */
  private async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    try {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status },
      });

      logger.debug({ orderId, status }, 'OrderProcessor: Order status updated');
    } catch (error) {
      logger.error({ err: error, orderId, status }, 'OrderProcessor: Failed to update order status');
      throw error;
    }
  }

  /**
   * Emit WebSocket update for order status change
   * @param orderId - Order ID
   * @param status - New status
   * @param data - Additional data to include in update
   */
  private emitWebSocketUpdate(orderId: string, status: OrderStatus, data?: any): void {
    if (this.wsEmitter) {
      this.wsEmitter.emitOrderUpdate(orderId, status, data);
      logger.debug({ orderId, status }, 'OrderProcessor: WebSocket update emitted');
    }
  }

  /**
   * Sleep utility for delays
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Start the worker (resume processing)
   */
  async start(): Promise<void> {
    try {
      await this.worker.resume();
      logger.info('OrderProcessor: Worker started');
    } catch (error) {
      logger.error({ err: error }, 'OrderProcessor: Failed to start worker');
      throw error;
    }
  }

  /**
   * Stop the worker gracefully (pause processing)
   */
  async stop(): Promise<void> {
    try {
      await this.worker.pause();
      logger.info('OrderProcessor: Worker paused');
    } catch (error) {
      logger.error({ err: error }, 'OrderProcessor: Failed to pause worker');
      throw error;
    }
  }

  /**
   * Close the worker and cleanup
   */
  async close(): Promise<void> {
    try {
      await this.worker.close();
      logger.info('OrderProcessor: Worker closed successfully');
    } catch (error) {
      logger.error({ err: error }, 'OrderProcessor: Error closing worker');
      throw error;
    }
  }
}

/**
 * Singleton instance of OrderProcessor
 * Note: WebSocket emitter should be set after WebSocket service is initialized
 */
export default OrderProcessor;
