import jwt from 'jsonwebtoken';
import config from '../../config.js';
import type { TokenPort } from '../../core/auth/auth.port.js';

export class JwtToken implements TokenPort {
  private readonly SECRET = config.JWT_SECRET;
  private readonly EXPIRY = '7d';

  sign(userId: string, name: string, email: string, isPremium: boolean): string {
    return jwt.sign({ userId, name, email, isPremium }, this.SECRET, {
      expiresIn: this.EXPIRY,
    });
  }

  verify(token: string): { userId: string; name: string; email: string; isPremium: boolean } {
    const decoded = jwt.verify(token, this.SECRET) as {
      userId: string;
      name: string;
      email: string;
      isPremium: boolean;
    };
    return {
      userId: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      isPremium: decoded.isPremium,
    };
  }
}
