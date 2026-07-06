import { PrismaClient, Prisma } from '@prisma/client';
import type { Payment } from '../../core/payment/payment.entity.js';
import type { PaymentRepositoryPort } from '../../core/payment/payment.port.js';

export class PrismaPaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async transaction<T>(fn: (txRepo: PaymentRepositoryPort) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient;
    return client.$transaction(async (tx) => {
      const txRepo = new PrismaPaymentRepository(tx);
      return fn(txRepo);
    });
  }

  async create(data: {
    ownerId: string;
    stripeSessionId: string;
    status: "PENDING" | "COMPLETED" | "FAILED";
  }): Promise<Payment> {
    const payment = await this.prisma.payment.create({
      data,
    });
    return payment;
  }

  async findBySessionId(stripeSessionId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripeSessionId },
    });
    return payment;
  }

  async findByEventId(stripeEventId: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { stripeEventId },
    });
    return payment;
  }

  async updateStatus(id: string, status: "PENDING" | "COMPLETED" | "FAILED", stripeEventId?: string): Promise<Payment | null> {
    const payment = await this.prisma.payment.update({
      where: { id },
      data: { status, stripeEventId },
    });
    return payment;
  }

  async listByUser(ownerId: string): Promise<Payment[]> {
    const payments = await this.prisma.payment.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return payments;
  }
}
