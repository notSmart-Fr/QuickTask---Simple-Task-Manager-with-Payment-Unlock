import { PrismaClient, Prisma, PaymentStatus } from '@prisma/client';
import type { Payment } from '../../core/payment/payment.entity.js';
import type { PaymentRepositoryPort } from '../../core/payment/payment.port.js';

type PrismaPayment = {
  id: string;
  userId: string;
  stripeSessionId: string;
  stripeEventId: string | null;
  amount: number;
  status: PaymentStatus;
  createdAt: Date;
  completedAt: Date | null;
};

export class PrismaPaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  // ── Private mapper: Prisma → Entity ──

  private toEntity(p: PrismaPayment): Payment {
    return {
      id: p.id,
      ownerId: p.userId,
      stripeSessionId: p.stripeSessionId,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.createdAt, // ponytail: Prisma Payment has no updatedAt, use createdAt
    };
  }

  // ── Transaction ──

  async transaction<T>(fn: (txRepo: PaymentRepositoryPort) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient;
    return client.$transaction(async (tx) => {
      const txRepo = new PrismaPaymentRepository(tx);
      return fn(txRepo);
    });
  }

  // ── CRUD ──

  async create(data: {
    ownerId: string;
    stripeSessionId: string;
    status: "PENDING" | "COMPLETED" | "FAILED";
  }): Promise<Payment> {
    const payment = await (this.prisma as PrismaClient).payment.create({
      data: {
        userId: data.ownerId,
        stripeSessionId: data.stripeSessionId,
        status: data.status,
      },
    });
    return this.toEntity(payment);
  }

  async findBySessionId(stripeSessionId: string): Promise<Payment | null> {
    const payment = await (this.prisma as PrismaClient).payment.findUnique({
      where: { stripeSessionId },
    });
    return payment ? this.toEntity(payment) : null;
  }

  async findByEventId(stripeEventId: string): Promise<Payment | null> {
    const payment = await (this.prisma as PrismaClient).payment.findFirst({
      where: { stripeEventId },
    });
    return payment ? this.toEntity(payment) : null;
  }

  async updateStatus(id: string, status: "PENDING" | "COMPLETED" | "FAILED", stripeEventId?: string): Promise<Payment | null> {
    const payment = await (this.prisma as PrismaClient).payment.update({
      where: { id },
      data: { status, stripeEventId },
    });
    return this.toEntity(payment);
  }

  async listByUser(ownerId: string): Promise<Payment[]> {
    const payments = await (this.prisma as PrismaClient).payment.findMany({
      where: { userId: ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.toEntity(p));
  }
}
