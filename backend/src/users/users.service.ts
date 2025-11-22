import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string) {
    return this.userModel.findById(id).select('+googleAccessToken +googleRefreshToken +refreshToken').exec();
  }

  async findByGoogleId(googleId: string) {
    return this.userModel.findOne({ googleId }).exec();
  }

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

  async createWithGoogle(
    email: string,
    googleId: string,
    googleAccessToken: string,
    googleRefreshToken: string,
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
        googleRefreshToken, // Store plaintext token
      });
      return created.save();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('Email này đã được đăng ký');
      }
      throw new InternalServerErrorException('Lỗi khi tạo user');
    }
  }

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
    return this.userModel.findByIdAndUpdate(userId, { refreshToken: null }).exec();
  }

  async setGoogleTokens(
    userId: string,
    googleAccessToken: string,
    googleRefreshToken: string,
  ) {
    return this.userModel
      .findByIdAndUpdate(userId, {
        googleAccessToken,
        googleRefreshToken, // Store plaintext token
      })
      .exec();
  }

  async updateGoogleTokens(
    googleId: string,
    googleAccessToken: string,
    googleRefreshToken?: string,
  ) {
    const update: {
      googleAccessToken: string;
      googleRefreshToken?: string;
    } = { googleAccessToken };

    if (googleRefreshToken) {
      update.googleRefreshToken = googleRefreshToken; // Store plaintext token
    }

    return this.userModel
      .findOneAndUpdate({ googleId }, { $set: update })
      .exec();
  }

  async updateGoogleAccessToken(googleId: string, googleAccessToken: string) {
    return this.userModel
      .findOneAndUpdate({ googleId }, { googleAccessToken })
      .exec();
  }

  async getUserIfRefreshTokenMatches(refreshToken: string, userId: string) {
    const user = await this.findById(userId);
    const isRefreshTokenMatching =
      user &&
      user.refreshToken &&
      (await bcrypt.compare(refreshToken, user.refreshToken));

    if (isRefreshTokenMatching) {
      return user;
    }

    return null;
  }
}