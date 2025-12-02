
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      console.log('❌ [JWT] Token validation failed: User not found');
      return null;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = payload.exp - now;
    
    if (timeLeft < 10) {
      console.log('⚠️ [JWT] Token expiring soon for user:', user.email, `(${timeLeft}s left)`);
    }
    
    return {
      userId: user._id.toString(),
      email: user.email,
      picture: user.picture,
      name: user.name,
    };
  }
}