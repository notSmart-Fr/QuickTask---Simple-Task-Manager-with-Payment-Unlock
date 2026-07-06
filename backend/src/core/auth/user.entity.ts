export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isPremium: boolean;
  createdAt: Date;
  updatedAt: Date;
}
