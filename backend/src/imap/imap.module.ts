import { Module } from '@nestjs/common';
import { ImapService } from './imap.service';
import { ImapController } from './imap.controller';
import { EncryptionService } from './encryption.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ImapService, EncryptionService],
  controllers: [ImapController],
  exports: [ImapService, EncryptionService],
})
export class ImapModule {}
