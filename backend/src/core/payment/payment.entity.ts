export interface Payment {
  id: string;
  ownerId: string;
  stripeSessionId: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED";
