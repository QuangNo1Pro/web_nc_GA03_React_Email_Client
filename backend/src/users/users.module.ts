import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UserSchema } from './schemas/user.schema';
import { MailboxSchema } from './schemas/mailbox.schema';
import { EmailSchema } from './schemas/email.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Mailbox', schema: MailboxSchema },
      { name: 'Email', schema: EmailSchema },
    ]),
  ],
  providers: [UsersService],
  controllers: [],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}