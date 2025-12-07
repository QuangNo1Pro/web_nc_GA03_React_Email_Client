import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from './schemas/user.schema';
import { MailboxDocument } from './schemas/mailbox.schema';
import { EmailDocument } from './schemas/email.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<UserDocument>,
    @InjectModel('Mailbox') private mailboxModel: Model<MailboxDocument>,
    @InjectModel('Email') private emailModel: Model<EmailDocument>,
    private readonly configService: ConfigService,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    const user = await this.userModel
      .findOne({ email })
      .select('+googleAccessToken +googleRefreshToken +refreshToken +provider')
      .exec();
    if (user) {
      console.log('[UsersService] findByEmail result - provider:', (user as any).provider);
    }
    return user;
  }

  async findByGoogleId(googleId: string) {
    const user = await this.userModel
      .findOne({ googleId })
      .select('+googleAccessToken +googleRefreshToken +refreshToken +provider')
      .exec();
    if (user) {
      console.log('[UsersService] findByGoogleId result - provider:', (user as any).provider);
    }
    return user;
  }

  async findById(id: string) {
    const user = await this.userModel
      .findById(id)
      .select('+googleAccessToken +googleRefreshToken +refreshToken +provider')
      .exec();
    if (user) {
      console.log('[UsersService] findById result - provider:', (user as any).provider);
    }
    return user;
  }

  // ---------- NORMAL REGISTER ----------
  async create(createUserDto: any): Promise<any> {
    const { email, password } = createUserDto;

    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    const saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '10',
      10,
    );

    try {
      const hashed = await bcrypt.hash(password, saltRounds);
      const created = new this.userModel({ 
        email, 
        password: hashed,
        provider: createUserDto.provider || 'local',
        imapConfig: createUserDto.imapConfig,
        imapPassword: createUserDto.imapPassword,
        smtpConfig: createUserDto.smtpConfig,
      });
      const saved = await created.save();
      // Re-fetch to ensure all fields including provider are returned
      return await this.findById(saved._id.toString());
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('Email này đã được đăng ký');
      }
      throw new InternalServerErrorException('Lỗi khi tạo user');
    }
  }

  // ---------- GOOGLE REGISTER ----------
  async createWithGoogle(
    email: string,
    googleId: string,
    googleAccessToken: string,
    googleRefreshToken: string,
    picture: string,
    name: string,
  ) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    try {
      const created = new this.userModel({
        email,
        googleId,
        googleAccessToken,
        googleRefreshToken,
        picture,
        name,
      });
      return created.save();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('Email này đã được đăng ký');
      }
      throw new InternalServerErrorException('Lỗi khi tạo user');
    }
  }

  // ---------- TOKENS ----------
  async setCurrentRefreshToken(userId: string, refreshToken: string | null) {
    if (refreshToken) {
      const saltRounds = parseInt(
        this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '10',
        10,
      );
      const hashedRefreshToken = await bcrypt.hash(refreshToken, saltRounds);

      return this.userModel
        .findByIdAndUpdate(userId, { refreshToken: hashedRefreshToken })
        .exec();
    }

    return this.userModel
      .findByIdAndUpdate(userId, { refreshToken: null })
      .exec();
  }

  async setGoogleTokens(
    userId: string,
    googleAccessToken: string,
    googleRefreshToken: string,
  ) {
    return this.userModel
      .findByIdAndUpdate(userId, {
        googleAccessToken,
        googleRefreshToken,
      })
      .exec();
  }

  async updateGoogleTokens(
    googleId: string,
    googleAccessToken: string,
    googleRefreshToken: string,
    picture: string,
    name: string,
  ) {
    return this.userModel
      .findOneAndUpdate(
        { googleId },
        {
          $set: {
            googleAccessToken,
            googleRefreshToken,
            picture,
            name,
          },
        },
      )
      .exec();
  }

  async updateGoogleAccessToken(
    googleId: string,
    googleAccessToken: string,
    picture: string,
    name: string,
  ) {
    return this.userModel
      .findOneAndUpdate(
        { googleId },
        {
          $set: {
            googleAccessToken,
            picture,
            name,
          },
        },
      )
      .exec();
  }

  async getUserIfRefreshTokenMatches(refreshToken: string, userId: string) {
    const user = await this.findById(userId);

    const isRefreshTokenMatching =
      user &&
      user.refreshToken &&
      (await bcrypt.compare(refreshToken, user.refreshToken));

    if (isRefreshTokenMatching) return user;
    return null;
  }

  // ---------- MAILBOX ----------
  async saveMailboxes(userId: string, mailboxes: any[]) {
    const ops = mailboxes.map((mailbox) => ({
      updateOne: {
        filter: { userId, id: mailbox.id },
        update: { $set: mailbox },
        upsert: true,
      },
    }));
    return this.mailboxModel.bulkWrite(ops);
  }

  async getMailboxes(userId: string) {
    return this.mailboxModel.find({ userId }).exec();
  }

  async countUnreadInboxEmails(userId: string): Promise<number> {
    return this.emailModel
      .countDocuments({
        userId,
        labelIds: { $all: ['INBOX', 'UNREAD'] },
      })
      .exec();
  }

  // ---------- EMAIL ----------
  async saveEmails(userId: string, emails: any[]) {
    const ops = emails.map((email) => ({
      updateOne: {
        filter: { userId, messageId: email.id },
        update: {
          $set: {
            userId,
            messageId: email.id,
            snippet: email.snippet,
            labelIds: email.labelIds || [],
            payload: email.payload,
            internalDate: email.internalDate,
          },
        },
        upsert: true,
      },
    }));
    return this.emailModel.bulkWrite(ops);
  }

  async getEmailsByLabel(userId: string, labelId: string, page = 1, limit = 200) {
    const skip = (page - 1) * limit;

    if (labelId === 'SENT') {
      return this.emailModel
        .find({
          userId,
          $and: [
            { labelIds: { $in: [labelId] } },
            { labelIds: { $nin: ['TRASH'] } },
          ],
        })
        .sort({ internalDate: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
    }

    return this.emailModel
      .find({ userId, labelIds: { $in: [labelId] } })
      .sort({ internalDate: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async getEmailById(userId: string, messageId: string) {
    return this.emailModel.findOne({ userId, messageId }).exec();
  }

  async deleteEmailById(userId: string, messageId: string) {
    return this.emailModel.deleteOne({ userId, messageId }).exec();
  }

  async updateEmailLabels(userId: string, messageId: string, labelIds: string[]) {
    return this.emailModel
      .findOneAndUpdate(
        { userId, messageId },
        { $set: { labelIds } },
        { new: true },
      )
      .exec();
  }

  async deleteAllMailboxes(userId: string) {
    return this.mailboxModel.deleteMany({ userId }).exec();
  }

  async deleteAllEmails(userId: string) {
    return this.emailModel.deleteMany({ userId }).exec();
  }

  async deleteEmailsNotInList(userId: string, messageIds: string[]) {
    return this.emailModel
      .deleteMany({
        userId,
        messageId: { $nin: messageIds },
      })
      .exec();
  }

  // ---------- INCREMENTAL SYNC SUPPORT ----------
  async getLastHistoryId(userId: string): Promise<string | null> {
    const user = await this.userModel.findById(userId).select('lastHistoryId').exec();
    return user?.lastHistoryId || null;
  }

  async setLastHistoryId(userId: string, historyId: string) {
    return this.userModel.findByIdAndUpdate(userId, { lastHistoryId: historyId }).exec();
  }

  // ---------- IMAP CONFIG ----------
  async updateImapConfig(
    userId: string,
    imapConfig: any,
    encryptedPassword: string,
    smtpConfig?: any,
    provider?: string,
  ) {
    // Fetch user first
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      console.log('[UsersService] User not found:', userId);
      return null;
    }

    // Update fields directly on document
    (user as any).imapConfig = imapConfig;
    (user as any).imapPassword = encryptedPassword;
    
    if (smtpConfig) {
      (user as any).smtpConfig = smtpConfig;
    }

    if (provider) {
      (user as any).provider = provider;
      console.log('[UsersService] Setting provider to:', provider);
    }

    // Save document
    const result = await user.save();
    
    console.log('[UsersService] Saved IMAP config - provider in DB:', (result as any)?.provider);
    return result;
  }

  async getImapConfig(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('imapConfig imapPassword smtpConfig')
      .exec();
    return user;
  }
}
