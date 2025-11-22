
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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { Response, Request as ExpressRequest } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

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
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      path: '/',
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      path: '/',
    });
    return {
      status: 'success',
      message: 'Đăng nhập thành công',
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.userId);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return {
      status: 'success',
      message: 'Đăng xuất thành công',
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
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      path: '/',
    });
    return {
      status: 'success',
      message: 'Token refreshed successfully',
    };
  }

  @UseGuards(AuthGuard('google'))
  @Get('google')
  async googleAuth(@Request() req: any) {}

  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleAuthRedirect(
    @Request() req: any,
    @Res() res: Response,
  ) {
    const tokens = await this.authService.googleLogin(req.user);
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development', // use secure cookies in production
      sameSite: 'strict',
      path: '/',
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      path: '/',
    });
    res.redirect(`${process.env.FRONTEND_URL}/inbox`);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
}

