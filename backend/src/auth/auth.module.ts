
import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { JwtRefreshTokenStrategy } from './jwt-refresh.strategy';
import { GoogleStrategy } from './google.strategy';
import { GmailModule } from '../gmail/gmail.module';
import { ImapModule } from '../imap/imap.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    GmailModule,
    ImapModule,
    forwardRef(() => SearchModule), // Use forwardRef to avoid circular dependency
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' }, // Access token expires in 15 minutes
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshTokenStrategy,
    GoogleStrategy,
  ],
  controllers: [AuthController],
  exports: [JwtModule, AuthService],
})
export class AuthModule { }