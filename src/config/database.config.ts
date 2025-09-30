// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');
import { config } from './index';

// Create singleton instance
class DatabaseService {
  private static instance: any;
  
  private constructor() {}
  
  public static getInstance(): any {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new PrismaClient({
        log: config.NODE_ENV === 'development' 
          ? ['query', 'info', 'warn', 'error'] 
          : ['error'],
      });
      
      // Handle connection
      DatabaseService.instance.$connect()
        .then(() => {
          console.log('✅ Database connected successfully');
        })
        .catch((error: Error) => {
          console.error('❌ Database connection failed:', error);
          process.exit(1);
        });
    }
    
    return DatabaseService.instance;
  }
  
  public static async disconnect(): Promise<void> {
    if (DatabaseService.instance) {
      await DatabaseService.instance.$disconnect();
      console.log('👋 Database disconnected');
    }
  }
}

// Export prisma client instance
export const prisma = DatabaseService.getInstance();

// Handle shutdown
process.on('beforeExit', async () => {
  await DatabaseService.disconnect();
});