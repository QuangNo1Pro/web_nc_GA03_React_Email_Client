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
    return this.userModel.findById(id).exec();
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

  async createWithGoogle(email: string, googleId: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    try {
      const created = new this.userModel({ email, googleId });
      return created.save();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('Email này đã được đăng ký');
      }
      throw new InternalServerErrorException('Lỗi khi tạo user');
    }
  }

  async setCurrentRefreshToken(userId: string, refreshToken: string | null) {
    return this.userModel.findByIdAndUpdate(userId, { refreshToken }).exec();
  }

  async getUserIfRefreshTokenMatches(refreshToken: string, userId: string) {
    const user = await this.findById(userId);

    if (user && user.refreshToken) {
      const isRefreshTokenMatching = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );
      if (isRefreshTokenMatching) {
        return user;
      }
    }
    return null;
  }
}