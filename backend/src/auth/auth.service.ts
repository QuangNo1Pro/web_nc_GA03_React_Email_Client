
import { Injectable, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  async googleLogin(user: any) {
    if (!user) {
      throw new ForbiddenException('No user from google');
    }

    let dbUser = await this.usersService.findByGoogleId(user.id);
    if (!dbUser) {
      dbUser = await this.usersService.createWithGoogle(
        user.email,
        user.id,
      );
    }

    return this.login(dbUser);
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user._id };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.sign(payload),
      this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    await this.usersService.setCurrentRefreshToken(user._id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async logout(userId: string) {
    return this.usersService.setCurrentRefreshToken(userId, null);
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.usersService.getUserIfRefreshTokenMatches(
      refreshToken,
      userId,
    );
    if (!user) {
      throw new ForbiddenException('Access Denied');
    }
    const payload = { email: user.email, sub: user._id };
    const accessToken = this.jwtService.sign(payload);
    return { access_token: accessToken };
  }
}

