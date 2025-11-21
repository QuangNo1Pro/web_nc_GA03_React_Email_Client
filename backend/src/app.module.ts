import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI');

        console.log('--- DEBUG: ĐANG KẾT NỐI TỚI DB ---');
        console.log(uri);
        console.log('------------------------------------');

        // Trả về (return) đối tượng
        return {
          uri: uri,
          // options can be added here
        };
      },
    }),
    UsersModule,
    AuthModule,
    MailModule,
  ],
  controllers: [],
})
export class AppModule {}