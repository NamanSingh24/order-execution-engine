# Contributing to Order Execution Engine

🎉 **Thank you for your interest in contributing to the Order Execution Engine!** 🎉

We're thrilled that you want to help make this project better. Whether you're fixing a bug, adding a feature, improving documentation, or just asking questions, your contribution is valuable and appreciated.

This guide will help you get started with contributing to the project.

---

## 📜 Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. By participating, you are expected to uphold this code.

**Our Standards:**
- Be respectful and inclusive
- Welcome newcomers and help them learn
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

Please report unacceptable behavior by opening an issue on [GitHub Issues](https://github.com/NamanSingh24/order-execution-engine/issues).

---

## 🤝 How to Contribute

We welcome contributions of all kinds! Here are some ways you can help:

- 🐛 **Report bugs** - Found a bug? Let us know!
- 💡 **Suggest features** - Have an idea? We'd love to hear it!
- 📝 **Improve documentation** - Help make our docs clearer
- 🔧 **Fix issues** - Pick up an existing issue and solve it
- ✨ **Add features** - Implement new functionality
- 🧪 **Write tests** - Increase test coverage
- 🎨 **Improve UX** - Enhance the developer experience

### Getting Started

#### 1. Fork the Repository

Click the "Fork" button at the top right of the repository page to create your own copy.

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/order-execution-engine.git
cd order-execution-engine

# Add upstream remote
git remote add upstream https://github.com/NamanSingh24/order-execution-engine.git
```

#### 2. Create a Feature Branch

Always create a new branch for your work. Never commit directly to `main`.

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a new feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

**Branch Naming Conventions:**
- `feature/` - New features (e.g., `feature/add-limit-orders`)
- `fix/` - Bug fixes (e.g., `fix/websocket-connection-leak`)
- `docs/` - Documentation updates (e.g., `docs/update-api-guide`)
- `test/` - Test additions/updates (e.g., `test/add-integration-tests`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-dex-router`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

#### 3. Make Your Changes

Now you can make your changes! Here are some guidelines:

- **Write clean code** - Follow the existing code style
- **Keep changes focused** - One feature or fix per pull request
- **Comment your code** - Explain complex logic
- **Update documentation** - If you change functionality
- **Add JSDoc comments** - For public functions and classes

#### 4. Write Tests

All new features and bug fixes should include tests.

```bash
# Run tests to ensure nothing is broken
npm test

# Run specific test file
npm test -- tests/unit/dexRouter.test.ts

# Watch mode for development
npm run test:watch
```

**Testing Guidelines:**
- Write unit tests for individual functions/classes
- Write integration tests for API endpoints and workflows
- Aim for at least 70% code coverage (our threshold)
- Test both happy paths and error cases
- Use descriptive test names that explain what's being tested

**Example Test:**
```typescript
describe('OrderProcessor', () => {
  it('should update order status to CONFIRMED when execution succeeds', async () => {
    // Arrange
    const order = createTestOrder();
    
    // Act
    const result = await orderProcessor.process(order);
    
    // Assert
    expect(result.status).toBe(OrderStatus.CONFIRMED);
    expect(result.txHash).toBeDefined();
  });
});
```

#### 5. Run the Linter

Ensure your code follows our style guidelines.

```bash
# Run ESLint
npm run lint

# Auto-fix issues (where possible)
npm run lint -- --fix
```

**Common Linting Rules:**
- Use `const` instead of `let` when variables aren't reassigned
- Avoid using `any` type (use specific types)
- Console statements should be warnings (use logger instead)
- No unused variables
- Proper TypeScript types for all parameters

#### 6. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear and structured commit messages.

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or modifications
- `refactor:` - Code refactoring (no functional changes)
- `style:` - Code style changes (formatting, semicolons, etc.)
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks (dependencies, build, etc.)
- `ci:` - CI/CD changes
- `revert:` - Revert a previous commit

**Examples:**
```bash
# Good commit messages
git commit -m "feat: add support for LIMIT orders"
git commit -m "fix: resolve WebSocket connection leak on error"
git commit -m "docs: update API documentation with new endpoints"
git commit -m "test: add integration tests for order processor"
git commit -m "refactor: simplify DEX routing logic"

# Bad commit messages (avoid these)
git commit -m "fixed stuff"
git commit -m "updates"
git commit -m "WIP"
```

**Detailed Commit Example:**
```bash
git commit -m "feat: add LIMIT order support

- Implement price monitoring service
- Add price oracle integration
- Update database schema for limit price
- Add tests for limit order execution

Closes #123"
```

#### 7. Push Your Changes

```bash
# Push to your fork
git push origin feature/your-feature-name
```

#### 8. Create a Pull Request

1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Fill out the PR template with details about your changes
4. Link any related issues (e.g., "Fixes #123")
5. Submit the pull request

**Pull Request Checklist:**
- [ ] Tests pass locally (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code builds without errors (`npm run build`)
- [ ] Documentation is updated (if needed)
- [ ] Commit messages follow conventional commits
- [ ] Branch is up to date with `main`
- [ ] PR description clearly explains the changes

---

## 🛠️ Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** >= 24.0.0
- **Docker Compose** >= 2.20.0
- **Git**

### Local Development Environment

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Docker Services**
   ```bash
   docker-compose up -d
   ```

3. **Run Database Migrations**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:3000` with hot-reload enabled.

5. **Verify Setup**
   ```bash
   # Check health endpoint
   curl http://localhost:3000/api/health
   
   # Run tests
   npm test
   ```

### Development Workflow

```bash
# Terminal 1: Start services
docker-compose up

# Terminal 2: Run dev server with hot reload
npm run dev

# Terminal 3: Run tests in watch mode
npm run test:watch

# Terminal 4: Available for git commands, debugging, etc.
```

### Useful Commands

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build            # Build TypeScript to JavaScript
npm start                # Start production server

# Testing
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage report
npm run test:watch       # Run tests in watch mode

# Code Quality
npm run lint             # Run ESLint
npm run lint -- --fix    # Auto-fix linting issues

# Database
npx prisma studio        # Open Prisma Studio (database GUI)
npx prisma migrate dev   # Create and apply migrations
npx prisma generate      # Generate Prisma Client

# Docker
docker-compose up -d     # Start services in background
docker-compose down      # Stop services
docker-compose logs -f   # View logs
docker-compose ps        # List running containers
```

---

## 🧪 Testing Guidelines

### Test Structure

```
tests/
├── unit/              # Unit tests for individual modules
├── integration/       # Integration tests for API and workflows
├── setup.ts          # Test environment configuration
└── sample.test.ts    # Sample test file
```

### Writing Tests

**1. Unit Tests**

Test individual functions and classes in isolation.

```typescript
import { MockDexRouter } from '../../src/services/dexRouter';

describe('MockDexRouter', () => {
  let dexRouter: MockDexRouter;

  beforeEach(() => {
    dexRouter = new MockDexRouter();
  });

  it('should return Raydium quote with 0.3% fee', async () => {
    const quote = await dexRouter.getRaydiumQuote('SOL', 'USDC', 100);
    
    expect(quote.dex).toBe('Raydium');
    expect(quote.fee).toBe(0.003);
    expect(quote.estimatedOutput).toBeGreaterThan(0);
  });
});
```

**2. Integration Tests**

Test complete workflows with real services.

```typescript
describe('Order Execution Flow', () => {
  beforeAll(async () => {
    // Start test server, connect to test database
  });

  afterAll(async () => {
    // Clean up resources
  });

  it('should execute order and receive all status updates', async () => {
    const ws = new WebSocket('ws://localhost:3001/api/orders/execute?...');
    
    // Test complete order flow
  });
});
```

### Test Coverage

- Maintain minimum 70% coverage across:
  - Branches
  - Functions
  - Lines
  - Statements

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

---

## 🎨 Code Style Guidelines

### TypeScript Style

**1. Use TypeScript Types**

```typescript
// ✅ Good
interface Order {
  id: string;
  amount: number;
  status: OrderStatus;
}

function processOrder(order: Order): Promise<void> {
  // ...
}

// ❌ Avoid
function processOrder(order: any) {
  // ...
}
```

**2. Prefer `const` over `let`**

```typescript
// ✅ Good
const baseUrl = 'http://localhost:3000';
const orders = await getOrders();

// ❌ Avoid
let baseUrl = 'http://localhost:3000';
var orders = await getOrders();
```

**3. Use Async/Await**

```typescript
// ✅ Good
async function getOrder(id: string): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id } });
  return order;
}

// ❌ Avoid
function getOrder(id: string): Promise<Order> {
  return prisma.order.findUnique({ where: { id } })
    .then(order => order);
}
```

**4. Use Destructuring**

```typescript
// ✅ Good
const { tokenIn, tokenOut, amount } = orderData;

// ❌ Avoid
const tokenIn = orderData.tokenIn;
const tokenOut = orderData.tokenOut;
const amount = orderData.amount;
```

**5. Add JSDoc Comments for Public APIs**

```typescript
/**
 * Executes an order using the best available route
 * @param order - The order to execute
 * @returns Execution result with transaction hash and price
 * @throws {Error} If execution fails
 */
async function executeOrder(order: Order): Promise<ExecutionResult> {
  // ...
}
```

### Project Structure

- Keep files focused and modular
- Place related files in appropriate directories
- Follow existing naming conventions
- Use barrel exports (`index.ts`) for cleaner imports

### Error Handling

```typescript
// ✅ Good - Specific error handling
try {
  const result = await executeOrder(order);
  return result;
} catch (error) {
  if (error instanceof InsufficientLiquidityError) {
    logger.warn({ orderId: order.id }, 'Insufficient liquidity');
    throw new OrderExecutionError('No liquidity available');
  }
  throw error;
}

// ❌ Avoid - Silent failures
try {
  await executeOrder(order);
} catch (error) {
  // Silently ignored
}
```

### Logging

Use the Pino logger, not `console.log`:

```typescript
// ✅ Good
import { logger } from '../utils/logger';

logger.info({ orderId }, 'Order created successfully');
logger.error({ error, orderId }, 'Order execution failed');

// ❌ Avoid
console.log('Order created:', orderId);
console.error('Error:', error);
```

---

## 📥 Pull Request Process

### Before Submitting

1. **Update your branch** with the latest `main`
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/your-feature
   git rebase main
   ```

2. **Run all checks**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

3. **Write a clear PR description**
   - What changes did you make?
   - Why did you make them?
   - How can reviewers test the changes?
   - Link any related issues

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Related Issues
Fixes #(issue number)
```

### Review Process

1. **Automated checks** will run (tests, linting, build)
2. **Code review** by at least one maintainer
3. **Address feedback** if requested
4. **Approval** and merge by maintainer

### After Your PR is Merged

1. **Delete your branch** (both locally and on GitHub)
   ```bash
   git branch -d feature/your-feature
   git push origin --delete feature/your-feature
   ```

2. **Update your main branch**
   ```bash
   git checkout main
   git pull upstream main
   ```

3. **Celebrate!** 🎉 You've contributed to the project!

---

## 🐛 Issue Reporting Guidelines

### Before Creating an Issue

1. **Search existing issues** - Your issue might already be reported
2. **Check documentation** - The answer might be in the docs
3. **Try the latest version** - Bug might already be fixed

### Bug Reports

When reporting a bug, include:

**Template:**
```markdown
## Bug Description
A clear and concise description of what the bug is.

## To Reproduce
Steps to reproduce the behavior:
1. Start the server with '...'
2. Connect to '...'
3. Send request '...'
4. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- OS: [e.g., macOS 14.0]
- Node.js version: [e.g., 20.10.0]
- Docker version: [e.g., 24.0.0]
- Project version/commit: [e.g., v1.0.0 or commit hash]

## Logs
```
Paste relevant logs here
```

## Screenshots
If applicable, add screenshots to help explain your problem.

## Additional Context
Any other context about the problem.
```

### Feature Requests

When suggesting a feature, include:

**Template:**
```markdown
## Feature Description
A clear and concise description of the feature.

## Problem Statement
What problem does this solve? Why is it needed?

## Proposed Solution
How would you implement this feature?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Any other information, mockups, or examples.
```

---

## 📚 Additional Resources

- [Project README](README.md)
- [API Documentation](docs/API.md)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Fastify Documentation](https://fastify.dev/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [BullMQ Documentation](https://docs.bullmq.io/)

---

## 💬 Getting Help

- **Questions?** Open a [GitHub Discussion](https://github.com/NamanSingh24/order-execution-engine/discussions)
- **Found a bug?** Open an [Issue](https://github.com/NamanSingh24/order-execution-engine/issues)

---

## 🙏 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!

**Happy coding!** 💻✨

---

**Maintained with ❤️ by [Naman Singh](https://github.com/NamanSingh24)**
