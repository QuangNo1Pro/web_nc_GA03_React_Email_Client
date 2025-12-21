import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UserSchema } from './schemas/user.schema';
import { MailboxSchema } from './schemas/mailbox.schema';
import { EmailSchema } from './schemas/email.schema';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Mailbox', schema: MailboxSchema },
      { name: 'Email', schema: EmailSchema },
    ]),
    AiModule,
  ],
  providers: [UsersService],
  controllers: [],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}