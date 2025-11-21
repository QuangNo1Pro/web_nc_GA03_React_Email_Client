
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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { Response } from 'express';

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
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.userId);
    return {
      status: 'success',
      message: 'Đăng xuất thành công',
    };
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req: any) {
    return this.authService.refreshToken(req.user.userId, req.user.refreshToken);
  }

  @UseGuards(AuthGuard('google'))
  @Get('google')
  async googleAuth(@Request() req: any) {}

  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleAuthRedirect(@Request() req: any, @Res() res: Response) {
    const tokens = await this.authService.googleLogin(req.user);
    res.redirect(
      `${process.env.FRONTEND_URL}/login?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
}

