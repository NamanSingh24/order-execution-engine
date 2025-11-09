import { WebSocket } from 'ws';
import { OrderStatus } from '../types/order.types';
import { logger } from '../utils/logger';

/**
 * WebSocket message interface for order status updates
 */
interface OrderUpdateMessage {
  orderId: string;
  status: OrderStatus;
  timestamp: string;
  [key: string]: any;
}

/**
 * WebSocket Manager for handling real-time order status updates
 * Maintains connections and broadcasts updates to clients
 */
export class WebSocketManager {
  private connections: Map<string, WebSocket>;

  constructor() {
    this.connections = new Map();
    logger.info('WebSocketManager: Initialized');
  }

  /**
   * Register a WebSocket connection for an order
   * @param orderId - Order ID to associate with the connection
   * @param socket - WebSocket connection
   */
  registerConnection(orderId: string, socket: WebSocket): void {
    try {
      // Close existing connection if any
      if (this.connections.has(orderId)) {
        logger.warn({ orderId }, 'WebSocketManager: Replacing existing connection');
        this.closeConnection(orderId);
      }

      this.connections.set(orderId, socket);

      // Set up close event handler
      socket.on('close', () => {
        logger.debug({ orderId }, 'WebSocketManager: Connection closed by client');
        this.connections.delete(orderId);
      });

      socket.on('error', (error: Error) => {
        logger.error({ err: error, orderId }, 'WebSocketManager: Socket error');
        this.connections.delete(orderId);
      });

      logger.info(
        { orderId, totalConnections: this.connections.size },
        'WebSocketManager: Connection registered'
      );
    } catch (error) {
      logger.error(
        { err: error, orderId },
        'WebSocketManager: Failed to register connection'
      );
      throw error;
    }
  }

  /**
   * Send status update to a specific order's WebSocket connection
   * @param orderId - Order ID
   * @param status - New order status
   * @param additionalData - Optional additional data to include
   */
  sendStatusUpdate(
    orderId: string,
    status: OrderStatus,
    additionalData?: Record<string, any>
  ): void {
    try {
      const socket = this.connections.get(orderId);

      if (!socket) {
        logger.debug(
          { orderId },
          'WebSocketManager: No WebSocket connection found for order'
        );
        return;
      }

      // Check if socket is open
      if (socket.readyState !== WebSocket.OPEN) {
        logger.warn(
          { orderId, readyState: socket.readyState },
          'WebSocketManager: WebSocket is not open'
        );
        this.connections.delete(orderId);
        return;
      }

      // Construct message
      const message: OrderUpdateMessage = {
        orderId,
        status,
        timestamp: new Date().toISOString(),
        ...additionalData,
      };

      // Send message
      socket.send(JSON.stringify(message), (error?: Error) => {
        if (error) {
          logger.error(
            { err: error, orderId },
            'WebSocketManager: Failed to send message'
          );
          this.connections.delete(orderId);
        } else {
          logger.debug(
            { orderId, status },
            'WebSocketManager: Status update sent'
          );
        }
      });
    } catch (error) {
      logger.error(
        { err: error, orderId, status },
        'WebSocketManager: Error sending status update'
      );
    }
  }

  /**
   * Close and remove a WebSocket connection
   * @param orderId - Order ID
   */
  closeConnection(orderId: string): void {
    try {
      const socket = this.connections.get(orderId);

      if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        this.connections.delete(orderId);
        logger.info(
          { orderId, remainingConnections: this.connections.size },
          'WebSocketManager: Connection closed'
        );
      }
    } catch (error) {
      logger.error(
        { err: error, orderId },
        'WebSocketManager: Error closing connection'
      );
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param message - Message to broadcast
   */
  broadcastToAll(message: Record<string, any>): void {
    try {
      const messageString = JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      });

      let successCount = 0;
      let failCount = 0;

      this.connections.forEach((socket, orderId) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(messageString, (error?: Error) => {
            if (error) {
              logger.error(
                { err: error, orderId },
                'WebSocketManager: Broadcast failed for connection'
              );
              this.connections.delete(orderId);
              failCount++;
            } else {
              successCount++;
            }
          });
        } else {
          this.connections.delete(orderId);
          failCount++;
        }
      });

      logger.info(
        { successCount, failCount, totalConnections: this.connections.size },
        'WebSocketManager: Broadcast completed'
      );
    } catch (error) {
      logger.error({ err: error }, 'WebSocketManager: Error broadcasting message');
    }
  }

  /**
   * Get the number of active connections
   * @returns Number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a connection exists for an order
   * @param orderId - Order ID
   * @returns Boolean indicating if connection exists
   */
  hasConnection(orderId: string): boolean {
    return this.connections.has(orderId);
  }

  /**
   * Close all connections and cleanup
   */
  closeAll(): void {
    try {
      logger.info(
        { connectionCount: this.connections.size },
        'WebSocketManager: Closing all connections'
      );

      this.connections.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      });

      this.connections.clear();
      logger.info('WebSocketManager: All connections closed');
    } catch (error) {
      logger.error({ err: error }, 'WebSocketManager: Error closing all connections');
    }
  }
}

/**
 * Singleton instance of WebSocketManager
 */
export default new WebSocketManager();
