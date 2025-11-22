import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtRefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        let token = null;
        if (req && req.cookies) {
          token = req.cookies['refresh_token'];
        }
        return token;
      },
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      return null;
    }
    return this.userService.getUserIfRefreshTokenMatches(
      refreshToken,
      payload.sub,
    );
  }
}