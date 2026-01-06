import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UserSchema } from './schemas/user.schema';
import { MailboxSchema } from './schemas/mailbox.schema';
import { EmailSchema } from './schemas/email.schema';
import { EmailVectorSchema } from './schemas/email-vector.schema';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Mailbox', schema: MailboxSchema },
      { name: 'Email', schema: EmailSchema },
      { name: 'EmailVector', schema: EmailVectorSchema },
    ]),
    AiModule,
  ],
  providers: [UsersService],
  controllers: [],
  exports: [UsersService, MongooseModule],
})
export class UsersModule { }