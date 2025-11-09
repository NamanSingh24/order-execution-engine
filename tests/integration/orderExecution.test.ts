import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import WebSocket from 'ws';
import { getPrismaClient, connectDatabase, disconnectDatabase } from '../../src/config/database';
import { closeRedisConnection } from '../../src/config/redis';
import { OrderProcessor } from '../../src/services/orderProcessor';
import websocketManager from '../../src/services/websocketManager';
import orderRoutes from '../../src/routes/orders';
import { OrderStatus, OrderType } from '../../src/types/order.types';

describe('Order Execution Flow', () => {
  let server: FastifyInstance;
  let orderProcessor: OrderProcessor;
  const prisma = getPrismaClient();
  const BASE_URL = 'http://localhost:3001';
  const WS_URL = 'ws://localhost:3001';

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';

    // Connect to test database
    await connectDatabase();

    // Build Fastify server
    server = Fastify({
      logger: false,
    });

    // Register plugins
    await server.register(cors, { origin: '*' });
    await server.register(websocket);
    await server.register(orderRoutes);

    // Initialize OrderProcessor with WebSocket emitter
    orderProcessor = new OrderProcessor({
      emitOrderUpdate: (orderId, status, data) => {
        websocketManager.sendStatusUpdate(orderId, status, data);
      },
    });

    // Start server
    await server.listen({ port: 3001, host: '0.0.0.0' });

    // Wait a bit for everything to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.order.deleteMany({});

    // Close OrderProcessor
    if (orderProcessor) {
      await orderProcessor.close();
    }

    // Close WebSocket connections
    websocketManager.closeAll();

    // Close server
    if (server) {
      await server.close();
    }

    // Disconnect from database
    await disconnectDatabase();

    // Close Redis connection
    await closeRedisConnection();

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    // Clean up orders after each test
    await prisma.order.deleteMany({});
  });

  describe('Order Execution', () => {
    it('should create order and process through all status updates', async () => {
      return new Promise<void>(async (resolve, reject) => {
        const tokenIn = 'SOL';
        const tokenOut = 'USDC';
        const amount = 100;
        const orderType = OrderType.MARKET;

        const statusUpdates: any[] = [];
        let orderId: string;

        try {
          // Establish WebSocket connection
          const ws = new WebSocket(
            `${WS_URL}/api/orders/execute?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amount=${amount}&orderType=${orderType}`
          );

          // Set timeout for test
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Test timeout - did not receive all status updates'));
          }, 15000);

          ws.on('open', () => {
            console.log('WebSocket connection established');
          });

          ws.on('message', async (data: WebSocket.Data) => {
            const message = JSON.parse(data.toString());
            console.log('Received message:', message);
            statusUpdates.push(message);

            // Capture orderId from first message
            if (message.orderId && !orderId) {
              orderId = message.orderId;
            }

            // Check if we received CONFIRMED status
            if (message.status === OrderStatus.CONFIRMED) {
              clearTimeout(timeout);
              ws.close();

              try {
                // Assert status progression
                const statuses = statusUpdates.map((u) => u.status);
                expect(statuses).toContain(OrderStatus.PENDING);
                expect(statuses).toContain(OrderStatus.ROUTING);
                expect(statuses).toContain(OrderStatus.BUILDING);
                expect(statuses).toContain(OrderStatus.SUBMITTED);
                expect(statuses).toContain(OrderStatus.CONFIRMED);

                // Verify order progression
                const pendingIndex = statuses.indexOf(OrderStatus.PENDING);
                const routingIndex = statuses.indexOf(OrderStatus.ROUTING);
                const buildingIndex = statuses.indexOf(OrderStatus.BUILDING);
                const submittedIndex = statuses.indexOf(OrderStatus.SUBMITTED);
                const confirmedIndex = statuses.indexOf(OrderStatus.CONFIRMED);

                expect(pendingIndex).toBeLessThan(routingIndex);
                expect(routingIndex).toBeLessThan(buildingIndex);
                expect(buildingIndex).toBeLessThan(submittedIndex);
                expect(submittedIndex).toBeLessThan(confirmedIndex);

                // Verify final order in database
                const order = await prisma.order.findUnique({
                  where: { id: orderId },
                });

                expect(order).toBeDefined();
                expect(order?.status).toBe(OrderStatus.CONFIRMED);
                expect(order?.txHash).toBeDefined();
                expect(order?.txHash).toMatch(/^[a-f0-9]{64}$/);
                expect(order?.executedPrice).toBeDefined();
                expect(order?.executedPrice).toBeGreaterThan(0);
                expect(order?.dex).toBeDefined();
                expect(['Raydium', 'Meteora']).toContain(order?.dex);

                resolve();
              } catch (error) {
                reject(error);
              }
            }
          });

          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });

          ws.on('close', () => {
            console.log('WebSocket connection closed');
          });
        } catch (error) {
          reject(error);
        }
      });
    }, 20000); // 20 second timeout for this test

    it('should handle concurrent orders correctly', async () => {
      const orderPromises: Promise<void>[] = [];

      // Submit 5 orders simultaneously
      for (let i = 0; i < 5; i++) {
        const promise = new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(
            `${WS_URL}/api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=${100 + i}&orderType=MARKET`
          );

          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error(`Order ${i} timeout`));
          }, 15000);

          ws.on('message', (data: WebSocket.Data) => {
            const message = JSON.parse(data.toString());

            if (message.status === OrderStatus.CONFIRMED) {
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          });

          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        orderPromises.push(promise);
      }

      // Wait for all orders to complete
      await Promise.all(orderPromises);

      // Verify all 5 orders are in database with CONFIRMED status
      const orders = await prisma.order.findMany({
        where: { status: OrderStatus.CONFIRMED },
      });

      expect(orders).toHaveLength(5);
      orders.forEach((order: any) => {
        expect(order.txHash).toBeDefined();
        expect(order.executedPrice).toBeDefined();
        expect(order.dex).toBeDefined();
      });
    }, 25000); // 25 second timeout for concurrent test

    it('should handle missing parameters', async () => {
      return new Promise<void>((resolve, reject) => {
        // Try to connect without required parameters
        const ws = new WebSocket(`${WS_URL}/api/orders/execute?tokenIn=SOL&tokenOut=USDC`);

        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Should have received error message'));
        }, 5000);

        ws.on('message', (data: WebSocket.Data) => {
          clearTimeout(timeout);
          const message = JSON.parse(data.toString());

          // Should receive error message
          expect(message).toHaveProperty('error');
          expect(message.error).toContain('Missing required parameters');

          ws.close();
          resolve();
        });

        ws.on('error', () => {
          clearTimeout(timeout);
          // Connection error is acceptable for invalid request
          resolve();
        });

        ws.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }, 10000);

    it('should retrieve order by ID', async () => {
      // First, create an order with a valid UUID
      const order = await prisma.order.create({
        data: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: 50,
          orderType: OrderType.LIMIT,
          status: OrderStatus.CONFIRMED,
          txHash: 'a'.repeat(64),
          executedPrice: 1.0,
          dex: 'Raydium',
        },
      });

      // Retrieve order via API
      const response = await fetch(`${BASE_URL}/api/orders/${order.id}`);
      const result: any = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(order.id);
      expect(result.data.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await fetch(`${BASE_URL}/api/orders/00000000-0000-0000-0000-000000000000`);
      const result: any = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe('Not Found');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/api/health`);
      const result: any = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe('healthy');
      expect(result).toHaveProperty('services');
      expect(result.services.database).toBe('connected');
      expect(result.services.queue).toBe('operational');
      expect(result).toHaveProperty('queueMetrics');
      expect(result).toHaveProperty('websocket');
    });
  });
});
