import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 🔐 JWT Authentication Guard
 * - Extracts token from Authorization header (Bearer) or cookies
 * - Uses Passport JWT strategy for validation
 * - Sets request.user with validated user object
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: any, status: any) {
    // Log for debugging
    console.log(`[JwtAuthGuard] err=${err}, user=${user?.sub || 'UNDEFINED'}, info=${info?.message}`);
    
    if (err || !user) {
      const message = info?.message || 'Unauthorized';
      throw new UnauthorizedException(`JWT Auth failed: ${message}`);
    }
    return user;
  }
}
