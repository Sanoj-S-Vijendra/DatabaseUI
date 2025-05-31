import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],
});
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});
