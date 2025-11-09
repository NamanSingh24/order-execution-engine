# API Documentation

## Overview

The Order Execution Engine API provides RESTful endpoints and WebSocket connections for executing trades across multiple decentralized exchanges (DEXs). The API enables real-time order tracking with status updates delivered via WebSocket connections.

**Version:** 1.0.0  
**Protocol:** HTTP/1.1, WebSocket  
**Data Format:** JSON

## Base URL

```
Development: http://localhost:3000
Production: [To be deployed]
```

## Authentication

Currently, the API does not require authentication. This is suitable for development and testing environments.

> **Note:** For production deployments, implement API key authentication or JWT-based authentication to secure endpoints.

---

## Endpoints

### 1. Execute Order (WebSocket)

Establishes a WebSocket connection to create and execute an order with real-time status updates.

**Endpoint:** `GET /api/orders/execute`

**Protocol:** WebSocket Upgrade

**Description:**  
Creates a new order, queues it for processing, and streams real-time status updates through the WebSocket connection. The connection remains open until the order reaches a terminal state (CONFIRMED or FAILED).

#### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `tokenIn` | string | Yes | Input token symbol | `SOL` |
| `tokenOut` | string | Yes | Output token symbol | `USDC` |
| `amount` | number | Yes | Amount of input token to trade | `100` |
| `orderType` | string | Yes | Order type: `MARKET`, `LIMIT`, or `SNIPER` | `MARKET` |

#### WebSocket Connection Example

```javascript
// JavaScript/Node.js
const WebSocket = require('ws');

const ws = new WebSocket(
  'ws://localhost:3000/api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=100&orderType=MARKET'
);

ws.on('open', () => {
  console.log('WebSocket connection established');
});

ws.on('message', (data) => {
  const update = JSON.parse(data.toString());
  console.log('Status update:', update);
  
  // Handle different statuses
  switch (update.status) {
    case 'PENDING':
      console.log('Order created:', update.orderId);
      break;
    case 'CONFIRMED':
      console.log('Order confirmed! TxHash:', update.txHash);
      break;
    case 'FAILED':
      console.error('Order failed:', update.error);
      break;
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Connection closed');
});
```

```bash
# Using wscat (npm install -g wscat)
wscat -c "ws://localhost:3000/api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=100&orderType=MARKET"
```

#### WebSocket Message Flow

**1. PENDING - Order Created**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "timestamp": "2025-11-09T12:00:00.000Z",
  "message": "Order created and queued for processing"
}
```

**2. ROUTING - Finding Best Price**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ROUTING",
  "timestamp": "2025-11-09T12:00:01.245Z"
}
```

**3. BUILDING - Constructing Transaction**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "BUILDING",
  "timestamp": "2025-11-09T12:00:02.150Z"
}
```

**4. SUBMITTED - Transaction Sent**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "SUBMITTED",
  "timestamp": "2025-11-09T12:00:05.320Z",
  "txHash": "f37ee69d4f7da869a507a3322850eb01d5bcf51f173a5338ffb82def291e4bd3",
  "dex": "Meteora",
  "executedPrice": 1.0076029696729025
}
```

**5. CONFIRMED - Transaction Confirmed**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "CONFIRMED",
  "timestamp": "2025-11-09T12:00:07.890Z",
  "txHash": "f37ee69d4f7da869a507a3322850eb01d5bcf51f173a5338ffb82def291e4bd3",
  "dex": "Meteora",
  "executedPrice": 1.0076029696729025
}
```

**6. FAILED - Order Failed (if error occurs)**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FAILED",
  "timestamp": "2025-11-09T12:00:03.500Z",
  "error": "Insufficient liquidity on all DEXs"
}
```

#### Error Responses

**400 Bad Request - Missing Parameters**
```json
{
  "error": "Missing required parameters: tokenIn, tokenOut, amount, orderType"
}
```

**400 Bad Request - Invalid Amount**
```json
{
  "error": "Invalid amount. Must be a positive number."
}
```

**400 Bad Request - Invalid Order Type**
```json
{
  "error": "Invalid order type. Must be one of: MARKET, LIMIT, SNIPER"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error",
  "message": "Failed to create order"
}
```

---

### 2. Get Order by ID

Retrieves the details of a specific order by its ID.

**Endpoint:** `GET /api/orders/:orderId`

**Protocol:** HTTP

**Description:**  
Fetches complete order information including execution details, transaction hash, and current status.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | string (UUID) | Yes | Unique identifier of the order |

#### Response Format

**Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": 100,
    "orderType": "MARKET",
    "status": "CONFIRMED",
    "executedPrice": 1.0076029696729025,
    "txHash": "f37ee69d4f7da869a507a3322850eb01d5bcf51f173a5338ffb82def291e4bd3",
    "dex": "Meteora",
    "createdAt": "2025-11-09T12:00:00.000Z",
    "updatedAt": "2025-11-09T12:00:07.890Z"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Indicates if the request was successful |
| `data.id` | string | Order UUID |
| `data.tokenIn` | string | Input token symbol |
| `data.tokenOut` | string | Output token symbol |
| `data.amount` | number | Amount of input token |
| `data.orderType` | string | Type of order (MARKET, LIMIT, SNIPER) |
| `data.status` | string | Current order status |
| `data.executedPrice` | number | Executed price (null if not executed) |
| `data.txHash` | string | Transaction hash (null if not submitted) |
| `data.dex` | string | DEX used for execution (null if not executed) |
| `data.createdAt` | string (ISO 8601) | Order creation timestamp |
| `data.updatedAt` | string (ISO 8601) | Last update timestamp |

#### Example Request

```bash
# cURL
curl -X GET http://localhost:3000/api/orders/550e8400-e29b-41d4-a716-446655440000

# HTTPie
http GET http://localhost:3000/api/orders/550e8400-e29b-41d4-a716-446655440000
```

```javascript
// JavaScript Fetch API
const orderId = '550e8400-e29b-41d4-a716-446655440000';

fetch(`http://localhost:3000/api/orders/${orderId}`)
  .then(response => response.json())
  .then(data => {
    console.log('Order details:', data.data);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

#### Error Responses

**400 Bad Request - Invalid UUID**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid order ID format"
}
```

**404 Not Found - Order Does Not Exist**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Order not found"
}
```

**500 Internal Server Error**
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Failed to retrieve order"
}
```

---

### 3. Health Check

Checks the health status of the service and its dependencies.

**Endpoint:** `GET /api/health`

**Protocol:** HTTP

**Description:**  
Returns the operational status of the application, database connection, queue system, and WebSocket manager. Useful for monitoring and alerting.

#### Response Format

**Status Code:** `200 OK`

```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T12:00:00.000Z",
  "uptime": 3600.25,
  "services": {
    "database": "connected",
    "queue": "operational"
  },
  "queueMetrics": {
    "waiting": 5,
    "active": 3,
    "completed": 1247,
    "failed": 12
  },
  "websocket": {
    "activeConnections": 8
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Overall health status: `healthy` or `unhealthy` |
| `timestamp` | string (ISO 8601) | Current server timestamp |
| `uptime` | number | Server uptime in seconds |
| `services.database` | string | Database connection status |
| `services.queue` | string | Queue system status |
| `queueMetrics.waiting` | number | Number of jobs waiting in queue |
| `queueMetrics.active` | number | Number of jobs currently processing |
| `queueMetrics.completed` | number | Total completed jobs |
| `queueMetrics.failed` | number | Total failed jobs |
| `websocket.activeConnections` | number | Number of active WebSocket connections |

#### Example Request

```bash
# cURL
curl -X GET http://localhost:3000/api/health

# HTTPie
http GET http://localhost:3000/api/health
```

```javascript
// JavaScript Fetch API
fetch('http://localhost:3000/api/health')
  .then(response => response.json())
  .then(data => {
    console.log('Service health:', data);
    
    if (data.status === 'healthy') {
      console.log('✓ All systems operational');
    } else {
      console.warn('⚠ System degraded');
    }
  });
```

#### Error Responses

**500 Internal Server Error - Service Unhealthy**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-11-09T12:00:00.000Z",
  "services": {
    "database": "disconnected",
    "queue": "error"
  },
  "error": "Database connection failed"
}
```

---

## WebSocket Events

### Connection Lifecycle

#### 1. Connection Establishment

The client initiates a WebSocket connection by sending an HTTP GET request with an `Upgrade` header:

```
GET /api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=100&orderType=MARKET HTTP/1.1
Host: localhost:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

Server responds with:

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

#### 2. Order Creation

Once the WebSocket connection is established, the server automatically:
1. Creates an order record in the database
2. Queues the order for processing
3. Sends the initial `PENDING` status message

#### 3. Status Updates

The server sends JSON-formatted status updates as the order progresses through the execution pipeline:

```
PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
```

Or in case of failure:

```
PENDING → ROUTING → FAILED
```

#### 4. Connection Closure

The WebSocket connection closes when:
- Order reaches `CONFIRMED` status
- Order reaches `FAILED` status
- Client explicitly closes the connection
- Connection timeout (default: 60 seconds)
- Server shutdown

### Status Update Message Format

All status update messages follow this structure:

```typescript
interface StatusUpdate {
  orderId: string;          // UUID of the order
  status: OrderStatus;      // Current status
  timestamp: string;        // ISO 8601 timestamp
  message?: string;         // Optional status message
  txHash?: string;          // Transaction hash (SUBMITTED, CONFIRMED)
  dex?: string;             // DEX name (SUBMITTED, CONFIRMED)
  executedPrice?: number;   // Executed price (SUBMITTED, CONFIRMED)
  error?: string;           // Error message (FAILED)
}
```

### Order Status Enum

| Status | Description | Terminal |
|--------|-------------|----------|
| `PENDING` | Order created and queued | No |
| `ROUTING` | Finding best execution route | No |
| `BUILDING` | Building transaction | No |
| `SUBMITTED` | Transaction submitted to blockchain | No |
| `CONFIRMED` | Transaction confirmed on-chain | Yes |
| `FAILED` | Order execution failed | Yes |

### Complete Status Progression Example

```json
// 1. PENDING (t=0ms)
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "timestamp": "2025-11-09T12:00:00.000Z",
  "message": "Order created and queued for processing"
}

// 2. ROUTING (t=250ms)
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ROUTING",
  "timestamp": "2025-11-09T12:00:00.250Z"
}

// 3. BUILDING (t=1200ms)
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "BUILDING",
  "timestamp": "2025-11-09T12:00:01.200Z"
}

// 4. SUBMITTED (t=3500ms)
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "SUBMITTED",
  "timestamp": "2025-11-09T12:00:03.500Z",
  "txHash": "f37ee69d4f7da869a507a3322850eb01d5bcf51f173a5338ffb82def291e4bd3",
  "dex": "Meteora",
  "executedPrice": 1.0076029696729025
}

// 5. CONFIRMED (t=5800ms)
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "CONFIRMED",
  "timestamp": "2025-11-09T12:00:05.800Z",
  "txHash": "f37ee69d4f7da869a507a3322850eb01d5bcf51f173a5338ffb82def291e4bd3",
  "dex": "Meteora",
  "executedPrice": 1.0076029696729025
}

// Connection closes automatically
```

---

## Error Handling

### HTTP Error Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid request parameters |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Common Error Scenarios

#### 1. Missing Required Parameters

**Request:**
```
GET /api/orders/execute?tokenIn=SOL&amount=100
```

**Response:**
```json
{
  "error": "Missing required parameters: tokenOut, orderType"
}
```

#### 2. Invalid Parameter Type

**Request:**
```
GET /api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=abc&orderType=MARKET
```

**Response:**
```json
{
  "error": "Invalid amount. Must be a positive number."
}
```

#### 3. Invalid Order Type

**Request:**
```
GET /api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=100&orderType=INVALID
```

**Response:**
```json
{
  "error": "Invalid order type. Must be one of: MARKET, LIMIT, SNIPER"
}
```

#### 4. Order Not Found

**Request:**
```bash
GET /api/orders/00000000-0000-0000-0000-000000000000
```

**Response:**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Order not found"
}
```

#### 5. Database Connection Error

**Response:**
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Database connection failed"
}
```

#### 6. Queue System Error

**WebSocket Message:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FAILED",
  "timestamp": "2025-11-09T12:00:01.500Z",
  "error": "Failed to queue order for processing"
}
```

#### 7. Execution Error

**WebSocket Message:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FAILED",
  "timestamp": "2025-11-09T12:00:04.200Z",
  "error": "Insufficient liquidity on all DEXs"
}
```

---

## Rate Limiting

**Current Implementation:**
- Order processing: 100 jobs per minute
- Concurrent processing: 10 orders simultaneously

**Future Implementation:**
- API rate limiting: 100 requests per minute per IP
- WebSocket connections: 10 concurrent connections per IP

---

## Best Practices

### 1. WebSocket Connection Management

```javascript
class OrderExecutor {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  connect(params) {
    const url = `ws://localhost:3000/api/orders/execute?${new URLSearchParams(params)}`;
    
    this.ws = new WebSocket(url);
    
    this.ws.on('open', () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
    });
    
    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    this.ws.on('close', () => {
      this.handleReconnect();
    });
  }
  
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    }
  }
  
  handleMessage(update) {
    console.log(`Status: ${update.status}`);
    
    if (update.status === 'CONFIRMED') {
      console.log('Order successful!');
      console.log('TxHash:', update.txHash);
      console.log('DEX:', update.dex);
      console.log('Price:', update.executedPrice);
    } else if (update.status === 'FAILED') {
      console.error('Order failed:', update.error);
    }
  }
}

// Usage
const executor = new OrderExecutor();
executor.connect({
  tokenIn: 'SOL',
  tokenOut: 'USDC',
  amount: 100,
  orderType: 'MARKET'
});
```

### 2. Error Handling

```javascript
async function getOrder(orderId) {
  try {
    const response = await fetch(`http://localhost:3000/api/orders/${orderId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Order not found');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Failed to fetch order:', error.message);
    throw error;
  }
}
```

### 3. Polling for Order Status (Alternative to WebSocket)

```javascript
async function pollOrderStatus(orderId, maxAttempts = 20, interval = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    const order = await getOrder(orderId);
    
    console.log(`Attempt ${i + 1}: Status = ${order.status}`);
    
    if (order.status === 'CONFIRMED' || order.status === 'FAILED') {
      return order;
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Order status polling timeout');
}
```

---

## Changelog

### Version 1.0.0 (2025-11-09)
- Initial API release
- WebSocket-based order execution
- REST endpoints for order retrieval and health checks
- Support for MARKET order type
- Multi-DEX routing (Raydium, Meteora)

---

## Support

For API issues or questions:
- GitHub Issues: https://github.com/NamanSingh24/order-execution-engine/issues
- Documentation: https://github.com/NamanSingh24/order-execution-engine/blob/main/README.md

---

**Last Updated:** November 9, 2025
