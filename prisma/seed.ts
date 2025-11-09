import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Sample token pairs for generating test orders
 */
const TOKEN_PAIRS = [
  { tokenIn: 'SOL', tokenOut: 'USDC' },
  { tokenIn: 'SOL', tokenOut: 'USDT' },
  { tokenIn: 'USDC', tokenOut: 'SOL' },
  { tokenIn: 'RAY', tokenOut: 'USDC' },
  { tokenIn: 'USDT', tokenOut: 'SOL' },
  { tokenIn: 'SOL', tokenOut: 'RAY' },
];

/**
 * Order types to randomly select from
 */
const ORDER_TYPES = ['MARKET', 'LIMIT', 'SNIPER'] as const;

/**
 * Order statuses to randomly select from
 */
const ORDER_STATUSES = ['PENDING', 'ROUTING', 'BUILDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'] as const;

/**
 * DEX options for executed orders
 */
const DEX_OPTIONS = ['Raydium', 'Meteora'];

/**
 * Generates a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random float between min and max
 */
function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generates a random element from an array
 */
function randomElement<T>(array: readonly T[]): T {
  return array[randomInt(0, array.length - 1)];
}

/**
 * Generates a mock transaction hash (64 character hex string)
 */
function generateMockTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars[randomInt(0, chars.length - 1)];
  }
  return hash;
}

/**
 * Creates a sample order with realistic data
 */
function createSampleOrder(index: number) {
  const tokenPair = randomElement(TOKEN_PAIRS);
  const amount = randomFloat(1, 1000);
  const orderType = randomElement(ORDER_TYPES);
  const status = randomElement(ORDER_STATUSES);
  
  // Only add execution details for SUBMITTED, CONFIRMED, or some FAILED orders
  const hasExecutionDetails = 
    status === 'SUBMITTED' || 
    status === 'CONFIRMED' || 
    (status === 'FAILED' && Math.random() > 0.5);
  
  const txHash = hasExecutionDetails ? generateMockTxHash() : null;
  const dex = hasExecutionDetails ? randomElement(DEX_OPTIONS) : null;
  const executedPrice = hasExecutionDetails ? randomFloat(0.95, 1.05) : null;

  return {
    tokenIn: tokenPair.tokenIn,
    tokenOut: tokenPair.tokenOut,
    amount,
    orderType,
    status,
    txHash,
    dex,
    executedPrice,
  };
}

/**
 * Main seed function
 */
async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Clear existing orders (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing orders...');
    const deleteResult = await prisma.order.deleteMany({});
    console.log(`   Deleted ${deleteResult.count} existing orders`);

    // Create 10 sample orders
    console.log('📝 Creating sample orders...');
    const orders = [];

    for (let i = 0; i < 10; i++) {
      const orderData = createSampleOrder(i);
      const order = await prisma.order.create({
        data: orderData,
      });
      orders.push(order);
      console.log(`   ✓ Created order ${i + 1}/10: ${order.id} (${order.status})`);
    }

    console.log('\n✅ Seed completed successfully!');
    console.log(`   Total orders created: ${orders.length}`);
    console.log('\n📊 Order Status Distribution:');
    
    // Count orders by status
    const statusCounts: Record<string, number> = {};
    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n📈 Sample Order Details:');
    console.log('   First order:', {
      id: orders[0].id,
      tokenIn: orders[0].tokenIn,
      tokenOut: orders[0].tokenOut,
      amount: orders[0].amount,
      orderType: orders[0].orderType,
      status: orders[0].status,
    });

  } catch (error) {
    console.error('\n❌ Error seeding database:');
    console.error(error);
    throw error;
  } finally {
    // Disconnect Prisma client
    console.log('\n🔌 Disconnecting Prisma client...');
    await prisma.$disconnect();
    console.log('   Done!\n');
  }
}

// Execute main function
main()
  .catch((error) => {
    console.error('Fatal error during seed:', error);
    process.exit(1);
  });

export { main };
