
import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { ImapService } from '../imap/imap.service';
import { EncryptionService } from '../imap/encryption.service';
import { Response, Request as ExpressRequest } from 'express';
import * as bcrypt from 'bcrypt';
import { ForbiddenException } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private authService: AuthService,
    @Inject(UsersService) private usersService: UsersService,
    @Inject(ImapService) private imapService: ImapService,
    @Inject(EncryptionService) private encryptionService: EncryptionService,
  ) { }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    const { email, password } = createUserDto;
    const user = await this.usersService.create({ email, password });
    return {
      status: 'success',
      message: 'Đăng ký thành công',
      data: user,
    };
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(req.user);
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      domain: isProduction ? undefined : undefined,
      path: '/',
      maxAge: 30 * 1000, // 🧪 TEST: 30 seconds (change back to 15 * 60 * 1000)
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      domain: isProduction ? undefined : undefined,
      path: '/',
      maxAge: 2 * 60 * 1000, // 🧪 TEST: 2 minutes (change back to 7 * 24 * 60 * 60 * 1000)
    });
    return {
      status: 'success',
      message: 'Đăng nhập thành công',
      access_token: tokens.access_token,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    const deviceId = req.body?.deviceId; // Optional: device identifier

    // Record logout for all other devices
    if (userId) {
      this.authService.recordMultiDeviceLogout(userId, deviceId);
    }

    await this.authService.logout(userId);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return {
      status: 'success',
      message: 'Đăng xuất thành công',
    };
  }

  /**
   * Check if user has been logged out on another device
   * Frontend polls this endpoint periodically
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('check-device-logout')
  async checkDeviceLogout(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    const lastCheckTime = new Date(req.query.lastCheck || 0);

    if (!userId) {
      return { loggedOut: false };
    }

    const hasLoggedOut = this.authService.hasMultiDeviceLogout(
      userId,
      lastCheckTime,
    );

    // Clear logout event after checking it to prevent re-triggering on next poll
    if (hasLoggedOut) {
      this.authService.clearMultiDeviceLogout(userId);
    }

    return {
      loggedOut: hasLoggedOut,
      currentTime: new Date().toISOString(),
    };
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    // The user object is attached by the jwt-refresh.strategy
    const tokens = await this.authService.refreshToken(req.user);
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      domain: isProduction ? undefined : undefined,
      path: '/',
      maxAge: 30 * 1000, // 🧪 TEST: 30 seconds (change back to 15 * 60 * 1000)
    });
    return {
      status: 'success',
      message: 'Token refreshed successfully',
      access_token: tokens.access_token,
    };
  }

  @UseGuards(AuthGuard('google'))
  @Get('google')
  async googleAuth(@Request() req: any) { }

  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleAuthRedirect(
    @Request() req: any,
    @Res() res: Response,
  ) {
    const tokens = await this.authService.googleLogin(req.user);
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      domain: isProduction ? undefined : undefined, // Let browser handle domain
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      domain: isProduction ? undefined : undefined, // Let browser handle domain
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend /auth-callback with token in URL
    // This ensures the token is passed even with cross-origin cookie restrictions
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth-callback?token=${tokens.access_token}`);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req: any) {
    // Lấy user từ database để đảm bảo có avatar
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      return { error: 'User not found' };
    }
    return {
      userId: user._id?.toString() || user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      provider: ((user as any).provider || 'google'), // Default to google for backward compatibility
    };
  }

  @Post('imap-login')
  @HttpCode(HttpStatus.OK)
  async imapLogin(
    @Body() data: {
      email: string;
      password: string;
      imapConfig: { host: string; port: number; tls?: boolean };
      smtpConfig?: { host: string; port: number; tls?: boolean };
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      // Validate IMAP connection
      const connection = await this.imapService.connectImap({
        user: data.email,
        password: data.password,
        host: data.imapConfig.host,
        port: data.imapConfig.port,
        tls: data.imapConfig.tls ?? true,
      });
      await this.imapService.closeConnection(connection);
    } catch (error) {
      const err = error as any;
      console.error('❌ [IMAP Login] Connection failed:', {
        email: data.email,
        host: data.imapConfig.host,
        port: data.imapConfig.port,
        tls: data.imapConfig.tls,
        error: err.message,
        code: err.code,
        source: err.source,
      });
      throw new ForbiddenException(`Invalid IMAP credentials or configuration: ${err.message || 'Unknown error'}`);
    }

    // Find or create user
    let dbUser = await this.usersService.findByEmail(data.email);

    if (!dbUser) {
      // Create new IMAP user
      dbUser = await this.usersService.create({
        email: data.email,
        password: await bcrypt.hash(data.password, 10),
        provider: 'imap',
        imapConfig: data.imapConfig,
        imapPassword: this.encryptionService.encrypt(data.password),
        smtpConfig: data.smtpConfig,
      } as any);
    } else {
      // Update existing user with IMAP config
      await this.usersService.updateImapConfig(
        dbUser._id.toString(),
        data.imapConfig,
        this.encryptionService.encrypt(data.password),
        data.smtpConfig,
        'imap',
      );
      dbUser = await this.usersService.findByEmail(data.email);
      if (dbUser) {
        // Ensure provider is set to 'imap'
        if ((dbUser as any).provider !== 'imap') {
          await this.usersService.updateImapConfig(
            dbUser._id.toString(),
            data.imapConfig,
            this.encryptionService.encrypt(data.password),
            data.smtpConfig,
            'imap',
          );
          dbUser = await this.usersService.findByEmail(data.email);
        }
      }
    }

    if (!dbUser) {
      throw new ForbiddenException('Failed to create or update IMAP user');
    }

    // Generate tokens
    const tokens = await this.authService.login(dbUser);
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      status: 'success',
      message: 'IMAP login successful',
      access_token: tokens.access_token,
    };
  }

  // @Post('enable-google-imap')
  // @UseGuards(AuthGuard('jwt'))
  // @HttpCode(HttpStatus.OK)
  // async enableGoogleImap(@Request() req: any) {
  //   const userId = req.user.sub;
  //   const dbUser = await this.usersService.findById(userId);
  //
  //   if (!dbUser || !(dbUser as any).googleAccessToken) {
  //     throw new ForbiddenException('User must login with Google first');
  //   }
  //
  //   await this.usersService.updateImapConfig(
  //     userId,
  //     { host: 'imap.gmail.com', port: 993, tls: true, user: dbUser.email },
  //     '',
  //     { host: 'smtp.gmail.com', port: 587, tls: true },
  //     'google',
  //   );
  //
  //   return {
  //     status: 'success',
  //     message: 'Google IMAP enabled successfully',
  //   };
  // }

}