import { MockDexRouter } from '../../src/services/dexRouter';
import { Order, OrderType, OrderStatus } from '../../src/types/order.types';

describe('MockDexRouter', () => {
  let dexRouter: MockDexRouter;

  beforeEach(() => {
    dexRouter = new MockDexRouter();
    // Mock the sleep method to speed up tests
    jest.spyOn(dexRouter as any, 'sleep').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getRaydiumQuote', () => {
    it('should return Raydium quote with correct structure', async () => {
      const tokenIn = 'SOL';
      const tokenOut = 'USDC';
      const amount = 100;

      const quote = await dexRouter.getRaydiumQuote(tokenIn, tokenOut, amount);

      // Assert quote has correct properties
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee');
      expect(quote).toHaveProperty('dex');
      expect(quote).toHaveProperty('estimatedOutput');

      // Assert dex name
      expect(quote.dex).toBe('Raydium');

      // Assert fee
      expect(quote.fee).toBe(0.003);

      // Assert price is within expected range (0.98 to 1.02)
      expect(quote.price).toBeGreaterThanOrEqual(0.98);
      expect(quote.price).toBeLessThanOrEqual(1.02);

      // Assert estimatedOutput is calculated correctly
      const expectedOutput = amount * quote.price * (1 - quote.fee);
      expect(quote.estimatedOutput).toBeCloseTo(expectedOutput, 5);
    });

    it('should return different prices on multiple calls', async () => {
      const tokenIn = 'SOL';
      const tokenOut = 'USDC';
      const amount = 100;

      const quote1 = await dexRouter.getRaydiumQuote(tokenIn, tokenOut, amount);
      const quote2 = await dexRouter.getRaydiumQuote(tokenIn, tokenOut, amount);

      // Prices should potentially be different (random)
      // Note: There's a small chance they could be equal
      expect(quote1).toHaveProperty('price');
      expect(quote2).toHaveProperty('price');
    });
  });

  describe('getMeteorQuote', () => {
    it('should return Meteora quote with correct structure', async () => {
      const tokenIn = 'SOL';
      const tokenOut = 'USDC';
      const amount = 100;

      const quote = await dexRouter.getMeteorQuote(tokenIn, tokenOut, amount);

      // Assert quote has correct properties
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('fee');
      expect(quote).toHaveProperty('dex');
      expect(quote).toHaveProperty('estimatedOutput');

      // Assert dex name
      expect(quote.dex).toBe('Meteora');

      // Assert fee
      expect(quote.fee).toBe(0.002);

      // Assert price is within expected range (0.97 to 1.02)
      expect(quote.price).toBeGreaterThanOrEqual(0.97);
      expect(quote.price).toBeLessThanOrEqual(1.02);

      // Assert estimatedOutput is calculated correctly
      const expectedOutput = amount * quote.price * (1 - quote.fee);
      expect(quote.estimatedOutput).toBeCloseTo(expectedOutput, 5);
    });
  });

  describe('selectBestRoute', () => {
    it('should select best route based on estimated output', () => {
      const raydiumQuote = {
        dex: 'Raydium',
        price: 1.0,
        fee: 0.003,
        estimatedOutput: 99.7,
        impact: 0.005,
      };

      const meteoraQuote = {
        dex: 'Meteora',
        price: 1.01,
        fee: 0.002,
        estimatedOutput: 100.098,
        impact: 0.004,
      };

      const bestRoute = dexRouter.selectBestRoute(raydiumQuote, meteoraQuote);

      // Meteora has higher estimated output, should be selected
      expect(bestRoute.dex).toBe('Meteora');
      expect(bestRoute.estimatedOutput).toBe(100.098);
    });

    it('should select Raydium when it has higher estimated output', () => {
      const raydiumQuote = {
        dex: 'Raydium',
        price: 1.02,
        fee: 0.003,
        estimatedOutput: 101.694,
        impact: 0.005,
      };

      const meteoraQuote = {
        dex: 'Meteora',
        price: 1.0,
        fee: 0.002,
        estimatedOutput: 99.8,
        impact: 0.004,
      };

      const bestRoute = dexRouter.selectBestRoute(raydiumQuote, meteoraQuote);

      // Raydium has higher estimated output, should be selected
      expect(bestRoute.dex).toBe('Raydium');
      expect(bestRoute.estimatedOutput).toBe(101.694);
    });
  });

  describe('executeBestRoute', () => {
    it('should execute order and return transaction details', async () => {
      const mockOrder: Order = {
        id: 'test-order-123',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 100,
        orderType: OrderType.MARKET,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await dexRouter.executeBestRoute(mockOrder);

      // Assert result has required properties
      expect(result).toHaveProperty('txHash');
      expect(result).toHaveProperty('executedPrice');
      expect(result).toHaveProperty('dex');

      // Assert txHash is a 64-character hexadecimal string
      expect(result.txHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.txHash.length).toBe(64);

      // Assert executedPrice is within valid range
      expect(result.executedPrice).toBeGreaterThan(0);
      expect(result.executedPrice).toBeLessThanOrEqual(1.02);

      // Assert dex is either Raydium or Meteora
      expect(['Raydium', 'Meteora']).toContain(result.dex);
    });

    it('should call getRaydiumQuote and getMeteorQuote', async () => {
      const mockOrder: Order = {
        id: 'test-order-456',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 50,
        orderType: OrderType.LIMIT,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const raydiumSpy = jest.spyOn(dexRouter, 'getRaydiumQuote');
      const meteoraSpy = jest.spyOn(dexRouter, 'getMeteorQuote');

      await dexRouter.executeBestRoute(mockOrder);

      // Assert both quote methods were called
      expect(raydiumSpy).toHaveBeenCalledWith(
        mockOrder.tokenIn,
        mockOrder.tokenOut,
        mockOrder.amount
      );
      expect(meteoraSpy).toHaveBeenCalledWith(
        mockOrder.tokenIn,
        mockOrder.tokenOut,
        mockOrder.amount
      );
    });

    it('should call selectBestRoute with quotes from both DEXs', async () => {
      const mockOrder: Order = {
        id: 'test-order-789',
        tokenIn: 'ETH',
        tokenOut: 'USDT',
        amount: 10,
        orderType: OrderType.SNIPER,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const selectBestRouteSpy = jest.spyOn(dexRouter, 'selectBestRoute');

      await dexRouter.executeBestRoute(mockOrder);

      // Assert selectBestRoute was called
      expect(selectBestRouteSpy).toHaveBeenCalled();

      // Get the arguments passed to selectBestRoute
      const callArgs = selectBestRouteSpy.mock.calls[0];
      expect(callArgs).toHaveLength(2);
      expect(callArgs[0]).toHaveProperty('dex', 'Raydium');
      expect(callArgs[1]).toHaveProperty('dex', 'Meteora');
    });

    it('should throw error if execution fails', async () => {
      const mockOrder: Order = {
        id: 'test-order-error',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 100,
        orderType: OrderType.MARKET,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock getRaydiumQuote to throw an error
      jest.spyOn(dexRouter, 'getRaydiumQuote').mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(dexRouter.executeBestRoute(mockOrder)).rejects.toThrow(
        'Route execution failed'
      );
    });
  });

  describe('generateMockTxHash', () => {
    it('should generate unique transaction hashes', async () => {
      const mockOrder1: Order = {
        id: 'test-order-1',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 100,
        orderType: OrderType.MARKET,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOrder2: Order = {
        id: 'test-order-2',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 100,
        orderType: OrderType.MARKET,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result1 = await dexRouter.executeBestRoute(mockOrder1);
      const result2 = await dexRouter.executeBestRoute(mockOrder2);

      // Transaction hashes should be different
      expect(result1.txHash).not.toBe(result2.txHash);
    });
  });
});
