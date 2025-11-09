# Order Execution Engine with DEX Routing

A high-performance, real-time order execution engine built with TypeScript that routes trades through multiple decentralized exchanges (DEXs) to find the best execution price. Features WebSocket-based status updates, distributed job processing with BullMQ, and PostgreSQL persistence.

![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)
![CI](https://github.com/NamanSingh24/order-execution-engine/workflows/CI/badge.svg)

## 📋 Overview

This project implements a sophisticated order execution system that:
- Routes orders through multiple DEX protocols (Raydium and Meteora)
- Provides real-time order status updates via WebSocket connections
- Uses a distributed job queue (BullMQ) for reliable order processing
- Persists order data and execution history in PostgreSQL
- Implements best-price routing with fee optimization
- Supports concurrent order processing with rate limiting

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20.x | JavaScript runtime environment |
| **Language** | TypeScript 5.6 | Type-safe development |
| **Web Framework** | Fastify 5.1 | High-performance HTTP server |
| **WebSocket** | @fastify/websocket | Real-time bidirectional communication |
| **Queue** | BullMQ 5.15 | Distributed job processing |
| **Cache/Queue Store** | Redis 7 | In-memory data store |
| **Database** | PostgreSQL 15 | Relational data persistence |
| **ORM** | Prisma 5.21 | Type-safe database client |
| **Logging** | Pino | High-performance logging |
| **Testing** | Jest 29.7 | Unit and integration testing |

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser/App)                     │
└────────────────┬────────────────────────────────┬────────────────┘
                 │                                │
                 │ WebSocket                      │ HTTP GET
                 │ Connection                     │ /api/orders/:id
                 ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Fastify Server (Port 3000)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WebSocket Manager    │    REST API Routes              │   │
│  │  - Connection tracking │    - Order retrieval            │   │
│  │  - Status broadcasting │    - Health checks              │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────┬────────────────┘
                 │                                │
                 │ Emit Updates                   │ Queue Job
                 │                                ▼
                 │                    ┌────────────────────────┐
                 │                    │   BullMQ Queue         │
                 │                    │   (Redis-backed)       │
                 │                    │   - Job persistence    │
                 │                    │   - Retry logic        │
                 │                    │   - Rate limiting      │
                 │                    └───────────┬────────────┘
                 │                                │
                 │                                │ Process Job
                 │                                ▼
                 │                    ┌────────────────────────┐
                 │◄───────────────────│   Order Processor      │
                 │   Status Updates   │   (BullMQ Worker)      │
                 │                    │   - 10 concurrent jobs │
                 │                    │   - 100 jobs/min limit │
                 │                    └───────────┬────────────┘
                 │                                │
                 │                                │ Get Best Route
                 │                                ▼
                 │                    ┌────────────────────────┐
                 │                    │   DEX Router Service   │
                 │                    │   - Query Raydium      │
                 │                    │   - Query Meteora      │
                 │                    │   - Select best price  │
                 │                    └───────────┬────────────┘
                 │                                │
                 │                                │ Persist Data
                 │                                ▼
                 │                    ┌────────────────────────┐
                 │                    │   PostgreSQL Database  │
                 │                    │   (via Prisma ORM)     │
                 │                    │   - Order records      │
                 │                    │   - Execution history  │
                 │                    └────────────────────────┘
                 │
                 ▼
         ┌──────────────────┐
         │  Client receives │
         │  real-time status│
         │  updates via WS  │
         └──────────────────┘
```

### Order Flow Lifecycle

```
1. Client connects via WebSocket → GET /api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=100&orderType=MARKET

2. Server creates order → Status: PENDING
   ├─ Saves to PostgreSQL
   ├─ Queues job in BullMQ
   └─ Sends WebSocket update

3. Worker picks up job → Status: ROUTING
   ├─ Queries Raydium DEX (0.3% fee)
   ├─ Queries Meteora DEX (0.2% fee)
   ├─ Selects best route by output amount
   └─ Sends WebSocket update

4. Build transaction → Status: BUILDING
   ├─ Constructs transaction
   └─ Sends WebSocket update

5. Submit transaction → Status: SUBMITTED
   ├─ Executes trade on selected DEX
   ├─ Records txHash and executedPrice
   └─ Sends WebSocket update

6. Confirm transaction → Status: CONFIRMED
   ├─ Updates database with final state
   ├─ Sends final WebSocket update
   └─ Closes connection
```

### Design Decisions & Rationale

**1. BullMQ for Job Processing**
- **Why:** Provides reliable distributed job processing with Redis-backed persistence
- **Benefits:** Automatic retry logic, job prioritization, rate limiting, and horizontal scaling
- **Alternative Considered:** Direct processing (rejected due to lack of retry/recovery)

**2. WebSocket for Real-Time Updates**
- **Why:** Bidirectional communication allows server to push status updates to clients
- **Benefits:** Lower latency than polling, reduced server load, better UX
- **Alternative Considered:** Server-Sent Events (rejected due to unidirectional limitation)

**3. Prisma ORM**
- **Why:** Type-safe database queries with automatic TypeScript type generation
- **Benefits:** Schema migrations, connection pooling, query optimization
- **Alternative Considered:** Raw SQL (rejected due to lack of type safety)

**4. Fastify over Express**
- **Why:** 2-3x faster than Express with built-in schema validation
- **Benefits:** TypeScript support, plugin ecosystem, low overhead
- **Performance:** Handles ~30,000 requests/sec vs Express ~15,000 req/sec

**5. Separate DEX Router Service**
- **Why:** Single Responsibility Principle - routing logic isolated from order processing
- **Benefits:** Easy to add new DEXs, testable, mockable for development
- **Extensibility:** Can integrate real DEX APIs (Jupiter, 1inch) without changing processor

## 🎯 Order Type Choice

### Chosen Order Type: MARKET

**Rationale:** MARKET orders were chosen as the primary implementation because they represent the most common use case in DEX trading and have the simplest execution logic. Market orders execute immediately at the best available price, which aligns perfectly with the "best route selection" architecture where the system queries multiple DEXs and selects the optimal execution venue. This provides users with instant liquidity and predictable execution flow.

**Extending to LIMIT Orders:** To support LIMIT orders, we would add a price monitoring service that continuously checks if the market price has reached the user's target limit price. When triggered, the order would be queued for execution similar to MARKET orders. This requires implementing a price oracle/feed integration and a background scheduler (using BullMQ's repeat functionality) to periodically check conditions. The database schema already supports this with the `orderType` field.

**Extending to SNIPER Orders:** SNIPER orders (for catching newly listed tokens) would require integration with blockchain event listeners (e.g., monitoring token creation events on Solana). We would use WebSocket connections to Solana RPC nodes to detect new liquidity pools, automatically create orders when conditions match, and execute within milliseconds. This would add a new `SniperService` that subscribes to program logs and triggers orders based on configured criteria (min liquidity, token metadata, etc.).

## ✨ Features

- ✅ **Multi-DEX Routing** - Automatically selects the best execution price between Raydium and Meteora
- ✅ **Real-Time Updates** - WebSocket-based status updates throughout order lifecycle
- ✅ **Distributed Processing** - BullMQ-powered job queue with automatic retry and rate limiting
- ✅ **Type Safety** - Full TypeScript implementation with strict type checking
- ✅ **Persistent Storage** - PostgreSQL database with Prisma ORM for order history
- ✅ **Concurrent Processing** - Handles up to 10 simultaneous orders with rate limiting (100/min)
- ✅ **Health Monitoring** - Built-in health check endpoints for database and queue status
- ✅ **Comprehensive Testing** - Unit and integration tests with 70% coverage threshold
- ✅ **Production Ready** - Docker Compose setup, graceful shutdown, error handling
- ✅ **CI/CD Pipeline** - GitHub Actions workflow for automated testing and deployment
- ✅ **Code Quality** - ESLint configuration with TypeScript rules

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **npm** >= 10.0.0 (comes with Node.js)
- **Docker** >= 24.0.0 ([Download](https://www.docker.com/))
- **Docker Compose** >= 2.20.0 (comes with Docker Desktop)
- **Git** ([Download](https://git-scm.com/))

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/NamanSingh24/order-execution-engine.git
cd order-execution-engine
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Default configuration (already set in `.env.example`):

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/orderengine?schema=public"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
```

### 4. Start Docker Services

Start PostgreSQL and Redis containers:

```bash
docker-compose up -d
```

Verify services are running:

```bash
docker-compose ps
```

Expected output:
```
NAME                                    STATUS              PORTS
order-execution-engine-postgres-1       Up (healthy)        0.0.0.0:5432->5432/tcp
order-execution-engine-redis-1          Up (healthy)        0.0.0.0:6379->6379/tcp
```

### 5. Run Database Migrations

Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

### 6. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

Expected output:
```
Server: Starting Order Execution Engine...
Server: CORS plugin registered
Server: WebSocket plugin registered
Server: Routes registered
Server listening on http://0.0.0.0:3000
Server: All services started successfully ✓
```

## 📡 API Documentation

### WebSocket Connection - Execute Order

**Endpoint:** `GET /api/orders/execute`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenIn` | string | Yes | Input token symbol (e.g., "SOL") |
| `tokenOut` | string | Yes | Output token symbol (e.g., "USDC") |
| `amount` | number | Yes | Amount of input token |
| `orderType` | string | Yes | Order type: "MARKET", "LIMIT", or "SNIPER" |

**Example WebSocket Connection:**

```javascript
const ws = new WebSocket(
  'ws://localhost:3000/api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=100&orderType=MARKET'
);

ws.onopen = () => {
  console.log('WebSocket connection established');
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Order update:', update);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket connection closed');
};
```

**Status Update Messages:**

1. **PENDING** - Order created and queued
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "timestamp": "2025-11-09T12:00:00.000Z",
  "message": "Order created and queued for processing"
}
```

2. **ROUTING** - Querying DEXs for best price
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ROUTING",
  "timestamp": "2025-11-09T12:00:01.000Z"
}
```

3. **BUILDING** - Constructing transaction
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "BUILDING",
  "timestamp": "2025-11-09T12:00:02.000Z"
}
```

4. **SUBMITTED** - Transaction submitted to DEX
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "SUBMITTED",
  "timestamp": "2025-11-09T12:00:05.000Z",
  "txHash": "f37ee69d4f7da869a507a3322850eb01d5bcf51f173a5338ffb82def291e4bd3",
  "dex": "Meteora",
  "executedPrice": 1.0076029696729025
}
```

5. **CONFIRMED** - Transaction confirmed on-chain
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "CONFIRMED",
  "timestamp": "2025-11-09T12:00:07.000Z",
  "txHash": "f37ee69d4f7da869a507a3322850eb01d5bcf51f173a5338ffb82def291e4bd3",
  "dex": "Meteora",
  "executedPrice": 1.0076029696729025
}
```

6. **FAILED** - Order execution failed
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FAILED",
  "timestamp": "2025-11-09T12:00:08.000Z",
  "error": "Insufficient liquidity"
}
```

### REST API - Get Order by ID

**Endpoint:** `GET /api/orders/:orderId`

**Parameters:**
- `orderId` (path parameter) - UUID of the order

**Request Example:**
```bash
curl http://localhost:3000/api/orders/550e8400-e29b-41d4-a716-446655440000
```

**Response Example (200 OK):**
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
    "updatedAt": "2025-11-09T12:00:07.000Z"
  }
}
```

**Response Example (404 Not Found):**
```json
{
  "error": "Not Found",
  "message": "Order not found",
  "statusCode": 404
}
```

### Health Check

**Endpoint:** `GET /api/health`

**Request Example:**
```bash
curl http://localhost:3000/api/health
```

**Response Example:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T12:00:00.000Z",
  "services": {
    "database": "connected",
    "queue": "operational"
  },
  "queueMetrics": {
    "waiting": 0,
    "active": 2,
    "completed": 147,
    "failed": 3
  },
  "websocket": {
    "activeConnections": 5
  }
}
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Test Coverage Thresholds

The project maintains a minimum coverage threshold of 70% across:
- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%
- **Statements:** 70%

### Test Structure

```
tests/
├── unit/
│   └── dexRouter.test.ts          # Unit tests for DEX routing logic
├── integration/
│   └── orderExecution.test.ts     # End-to-end order execution tests
├── setup.ts                        # Test environment configuration
└── sample.test.ts                  # Sample tests
```

**Test Results:**
- ✅ 19 tests passing
- ✅ 3 test suites
- ✅ Integration tests with Docker services (PostgreSQL, Redis)
- ✅ WebSocket connection testing
- ✅ Concurrent order processing validation

## 🌐 Deployment

### Production Deployment URL

🚀 **Live Application:** [Coming Soon]

### Deployment Options

#### Option 1: Docker Deployment

Build and run with Docker Compose:

```bash
# Build production image
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

#### Option 2: Platform Deployment

The application is ready to deploy on:
- **Railway** - Auto-deploy from GitHub
- **Render** - Web service + PostgreSQL + Redis
- **Fly.io** - Global edge deployment
- **AWS ECS** - Container orchestration
- **Google Cloud Run** - Serverless containers

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=<production_postgres_url>
REDIS_HOST=<production_redis_host>
REDIS_PORT=<production_redis_port>
LOG_LEVEL=warn
PORT=3000
```

## 🎥 Demo Video

📹 **Watch the Demo:** [YouTube Link - Coming Soon]

**Video Contents:**
1. Project overview and architecture explanation
2. Starting Docker services and running migrations
3. WebSocket connection demonstration
4. Order execution flow with real-time status updates
5. Multi-DEX routing decision making
6. Concurrent order processing
7. Database and queue monitoring
8. Test suite execution
9. Code walkthrough of key components

## 📁 Project Structure

```
order-execution-engine/
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions CI/CD pipeline
├── prisma/
│   ├── schema.prisma              # Database schema definition
│   └── migrations/                # Database migration files
├── src/
│   ├── config/
│   │   ├── database.ts            # Prisma client configuration
│   │   └── redis.ts               # Redis connection setup
│   ├── routes/
│   │   └── orders.ts              # API route handlers
│   ├── services/
│   │   ├── dexRouter.ts           # DEX routing logic
│   │   ├── orderQueue.ts          # BullMQ queue service
│   │   ├── orderProcessor.ts      # Order processing worker
│   │   └── websocketManager.ts    # WebSocket connection manager
│   ├── types/
│   │   └── order.types.ts         # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts              # Pino logger configuration
│   └── server.ts                  # Main application entry point
├── tests/
│   ├── integration/
│   │   └── orderExecution.test.ts # Integration tests
│   ├── unit/
│   │   └── dexRouter.test.ts      # Unit tests
│   ├── setup.ts                   # Test configuration
│   └── sample.test.ts             # Sample tests
├── .env.example                   # Environment variables template
├── .gitignore                     # Git ignore rules
├── docker-compose.yml             # Docker services configuration
├── eslint.config.mjs              # ESLint configuration
├── jest.config.js                 # Jest testing configuration
├── package.json                   # Project dependencies and scripts
├── tsconfig.json                  # TypeScript compiler options
└── README.md                      # Project documentation
```

## 🛠️ Technologies Used

### Core Framework & Runtime
- [Node.js](https://nodejs.org/) - JavaScript runtime built on V8 engine
- [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript
- [Fastify](https://fastify.dev/) - High-performance web framework

### Database & ORM
- [PostgreSQL](https://www.postgresql.org/) - Relational database
- [Prisma](https://www.prisma.io/) - Next-generation ORM

### Queue & Cache
- [BullMQ](https://docs.bullmq.io/) - Distributed job queue
- [Redis](https://redis.io/) - In-memory data store

### WebSocket & Real-Time
- [@fastify/websocket](https://github.com/fastify/fastify-websocket) - WebSocket plugin for Fastify
- [ws](https://github.com/websockets/ws) - WebSocket client & server

### Development & Testing
- [Jest](https://jestjs.io/) - Testing framework
- [ts-jest](https://github.com/kulshekhar/ts-jest) - TypeScript preprocessor for Jest
- [ESLint](https://eslint.org/) - Linting utility
- [tsx](https://github.com/esbuild-kit/tsx) - TypeScript execution

### Logging & Monitoring
- [Pino](https://getpino.io/) - Ultra-fast logging library

### DevOps & Deployment
- [Docker](https://www.docker.com/) - Containerization platform
- [GitHub Actions](https://github.com/features/actions) - CI/CD automation

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
   ```bash
   git clone https://github.com/YourUsername/order-execution-engine.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and commit them
   ```bash
   git commit -m "feat: add your feature description"
   ```

4. **Run tests and linting**
   ```bash
   npm test
   npm run lint
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** on GitHub

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or modifications
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

## 📄 License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2025 Naman Singh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 📞 Support

For questions or support, please:
- Open an issue on [GitHub Issues](https://github.com/NamanSingh24/order-execution-engine/issues)
- Contact: [Your Email]

---

**Built with ❤️ by Naman Singh**
