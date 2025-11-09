/**
 * Sample test file
 * Demonstrates the Jest testing setup
 */

describe('Sample Test Suite', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should perform arithmetic operations', () => {
    expect(1 + 1).toBe(2);
    expect(5 * 3).toBe(15);
  });

  it('should handle async operations', async () => {
    const promise = Promise.resolve('success');
    await expect(promise).resolves.toBe('success');
  });
});
