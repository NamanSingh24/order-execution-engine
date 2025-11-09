/**
 * Order type enumeration
 */
export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  SNIPER = 'SNIPER',
}

/**
 * Order status enumeration
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  ROUTING = 'ROUTING',
  BUILDING = 'BUILDING',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

/**
 * Main order interface
 */
export interface Order {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  orderType: OrderType;
  status: OrderStatus;
  executedPrice?: number;
  txHash?: string;
  dex?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data Transfer Object for creating a new order
 */
export interface CreateOrderDTO {
  tokenIn: string;
  tokenOut: string;
  amount: number;
  orderType: OrderType;
  slippage?: number;
  limitPrice?: number;
}

/**
 * WebSocket message interface for order status updates
 */
export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  executedPrice?: number;
  txHash?: string;
  dex?: string;
  timestamp: Date;
  message?: string;
}

/**
 * DEX quote interface for comparing prices across exchanges
 */
export interface DexQuote {
  dex: string;
  price: number;
  fee: number;
  estimatedOutput: number;
  impact?: number;
}

/**
 * Extended order response with additional metadata
 */
export interface OrderResponse extends Order {
  estimatedGas?: number;
  route?: string[];
}
