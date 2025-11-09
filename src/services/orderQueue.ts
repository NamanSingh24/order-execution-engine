import { Queue, Job, QueueOptions } from 'bullmq';
import { getRedisConfig } from '../config/redis';
import { CreateOrderDTO } from '../types/order.types';
import { logger } from '../utils/logger';

/**
 * Queue metrics interface
 */
interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Service for managing order processing queue using BullMQ
 */
export class OrderQueueService {
  private queue: Queue;

  constructor() {
    const redisConfig = getRedisConfig();

    const queueOptions: QueueOptions = {
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          count: 50, // Keep last 50 failed jobs
        },
      },
    };

    try {
      this.queue = new Queue('orders', queueOptions);
      logger.info('OrderQueue: Queue initialized successfully');

      // Set up error event listener
      this.queue.on('error', (error) => {
        logger.error({ err: error }, 'OrderQueue: Queue error');
      });
    } catch (error) {
      logger.error({ err: error }, 'OrderQueue: Failed to initialize queue');
      throw new Error(`Failed to initialize order queue: ${error}`);
    }
  }

  /**
   * Add an order to the processing queue
   * @param orderData - Order data to process
   * @returns Promise<string> - Job ID
   */
  async addOrder(orderData: CreateOrderDTO & { id: string }): Promise<string> {
    try {
      const job = await this.queue.add('process-order', orderData, {
        jobId: orderData.id,
      });

      logger.info(
        {
          jobId: job.id,
          orderId: orderData.id,
          orderType: orderData.orderType,
        },
        'OrderQueue: Order added to queue'
      );

      return job.id as string;
    } catch (error) {
      logger.error(
        { err: error, orderData },
        'OrderQueue: Failed to add order to queue'
      );
      throw new Error(`Failed to add order to queue: ${error}`);
    }
  }

  /**
   * Get job by ID
   * @param jobId - Job ID to retrieve
   * @returns Promise<Job | undefined> - Job instance or undefined if not found
   */
  async getJob(jobId: string): Promise<Job | undefined> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        logger.warn({ jobId }, 'OrderQueue: Job not found');
        return undefined;
      }

      logger.debug({ jobId, state: await job.getState() }, 'OrderQueue: Job retrieved');

      return job;
    } catch (error) {
      logger.error({ err: error, jobId }, 'OrderQueue: Failed to get job');
      throw new Error(`Failed to get job: ${error}`);
    }
  }

  /**
   * Get queue metrics and statistics
   * @returns Promise<QueueMetrics> - Queue statistics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      const metrics: QueueMetrics = {
        waiting,
        active,
        completed,
        failed,
        delayed,
      };

      logger.debug({ metrics }, 'OrderQueue: Metrics retrieved');

      return metrics;
    } catch (error) {
      logger.error({ err: error }, 'OrderQueue: Failed to get queue metrics');
      throw new Error(`Failed to get queue metrics: ${error}`);
    }
  }

  /**
   * Close the queue connection gracefully
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    try {
      await this.queue.close();
      logger.info('OrderQueue: Queue closed successfully');
    } catch (error) {
      logger.error({ err: error }, 'OrderQueue: Error closing queue');
      throw new Error(`Failed to close queue: ${error}`);
    }
  }

  /**
   * Obliterate the queue (remove all jobs and clean up)
   * Use with caution - this will delete all jobs
   * @returns Promise<void>
   */
  async obliterate(): Promise<void> {
    try {
      await this.queue.obliterate({ force: true });
      logger.warn('OrderQueue: Queue obliterated - all jobs removed');
    } catch (error) {
      logger.error({ err: error }, 'OrderQueue: Failed to obliterate queue');
      throw new Error(`Failed to obliterate queue: ${error}`);
    }
  }
}

/**
 * Singleton instance of OrderQueueService
 */
export default new OrderQueueService();
