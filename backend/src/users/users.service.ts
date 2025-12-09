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
    return this.userModel.findOne({ email }).exec();
  }

  async findByGoogleId(googleId: string) {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findById(id: string) {
    return this.userModel
      .findById(id)
      .select('+googleAccessToken +googleRefreshToken +refreshToken')
      .exec();
  }

  // ---------- NORMAL REGISTER ----------
  async create(createUserDto: CreateUserDto) {
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
      const created = new this.userModel({ email, password: hashed });
      return created.save();
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
        provider: 'google', // Set provider to 'google' for OAuth users
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
            provider: 'google', // Ensure provider is set to 'google'
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
            provider: 'google', // Ensure provider is set to 'google'
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

  async countUnreadByLabel(userId: string, labelId: string): Promise<number> {
    // Special case: UNREAD label means emails that ONLY have UNREAD (not in other main folders)
    if (labelId === 'UNREAD') {
      return this.emailModel
        .countDocuments({
          userId,
          labelIds: { $all: ['UNREAD'], $nin: ['INBOX', 'SENT', 'SPAM', 'TRASH'] }
        })
        .exec();
    }

    // For other labels: count emails that have both the label AND UNREAD
    return this.emailModel
      .countDocuments({
        userId,
        labelIds: { $all: [labelId, 'UNREAD'] },
      })
      .exec();
  }

  async updateMailboxTotal(userId: string, mailboxId: string, total: number) {
    return this.mailboxModel.findOneAndUpdate(
      { userId, id: mailboxId },
      { $set: { messagesTotal: total } },
      { new: true, upsert: true }
    ).exec();
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
          // Use $setOnInsert to preserve status/snooze fields if they already exist
          $setOnInsert: {
            status: 'Inbox',
            snoozed: false,
            snoozedUntil: null,
            snoozedFromStatus: null,
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
        .select('userId messageId snippet labelIds payload internalDate status snoozed snoozedUntil snoozedFromStatus createdAt updatedAt')
        .sort({ internalDate: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
    }

    return this.emailModel
      .find({ userId, labelIds: { $in: [labelId] } })
      .select('userId messageId snippet labelIds payload internalDate status snoozed snoozedUntil snoozedFromStatus createdAt updatedAt')
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

  // ========== FEATURE II: KANBAN STATUS UPDATE ==========
  async updateEmailStatus(userId: string, messageId: string, status: string) {
    return this.emailModel
      .findOneAndUpdate(
        { userId, messageId },
        { $set: { status } },
        { new: true },
      )
      .exec();
  }

  // ========== FEATURE III: SNOOZE OPERATIONS ==========
  
  /**
   * Find email by messageId for snooze operations
   */
  async findEmailByMessageId(userId: string, messageId: string): Promise<EmailDocument | null> {
    return this.emailModel.findOne({ userId, messageId }).exec();
  }

  /**
   * Update email snooze metadata
   */
  async updateEmailSnooze(
    userId: string,
    messageId: string,
    snoozed: boolean,
    snoozedUntil: Date | null,
    snoozedFromStatus: string | null,
  ) {
    const updateData: any = {
      snoozed,
      snoozedUntil,
      snoozedFromStatus,
    };

    // If snoozing, also set status to 'Snoozed'
    if (snoozed) {
      updateData.status = 'Snoozed';
    }

    return this.emailModel
      .findOneAndUpdate(
        { userId, messageId },
        { $set: updateData },
        { new: true },
      )
      .exec();
  }

  /**
   * Find all snoozed emails for a user
   */
  async findSnoozedEmails(userId: string): Promise<EmailDocument[]> {
    return this.emailModel
      .find({ userId, snoozed: true })
      .sort({ snoozedUntil: 1 }) // Sort by wake time (earliest first)
      .exec();
  }

  /**
   * Find all expired snoozed emails (for scheduler)
   * Returns emails where snoozed=true AND snoozedUntil <= now
   */
  async findExpiredSnoozedEmails(): Promise<EmailDocument[]> {
    const now = new Date();
    return this.emailModel
      .find({
        snoozed: true,
        snoozedUntil: { $lte: now },
      })
      .exec();
  }

  /**
   * Get snoozed emails with full details for user
   */
  async getSnoozedEmailsWithDetails(userId: string) {
    return this.emailModel
      .find({ userId, snoozed: true })
      .select('messageId snippet labelIds payload internalDate snoozed snoozedUntil snoozedFromStatus status')
      .sort({ snoozedUntil: 1 })
      .exec();
  }

  /**
   * Update snooze time for an email
   */
  async updateSnoozeTime(userId: string, messageId: string, newSnoozedUntil: Date) {
    const email = await this.emailModel.findOne({ userId, messageId }).exec();
    
    if (!email) {
      throw new Error('Email not found');
    }

    if (!email.snoozed) {
      throw new Error('Email is not snoozed');
    }

    return this.emailModel
      .findOneAndUpdate(
        { userId, messageId },
        { $set: { snoozedUntil: newSnoozedUntil } },
        { new: true }
      )
      .exec();
  }

  /**
   * Generic email update helper
   */
  async updateEmail(userId: string, messageId: string, updates: any) {
    return this.emailModel
      .findOneAndUpdate(
        { userId, messageId },
        { $set: updates },
        { new: true }
      )
      .exec();
  }

  /**
   * Update IMAP configuration for a user
   */
  async updateImapConfig(
    userId: string,
    imapConfig: any,
    encryptedPassword: string,
    smtpConfig?: any,
    provider?: string,
  ) {
    const updateData: any = {
      imapConfig,
      imapPassword: encryptedPassword,
    };

    if (smtpConfig) {
      updateData.smtpConfig = smtpConfig;
    }

    if (provider) {
      updateData.provider = provider;
    }

    return this.userModel
      .findByIdAndUpdate(userId, { $set: updateData }, { new: true })
      .exec();
  }
}

