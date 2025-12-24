import { Injectable, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { GmailService } from '../gmail/gmail.service';
import { EmbeddingsProcessorService } from '../search/embeddings-processor.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private gmailService: GmailService,
    private embeddingsProcessor: EmbeddingsProcessorService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  // ======================================
  // GOOGLE LOGIN
  // ======================================
  async googleLogin(user: any) {
    if (!user) {
      throw new ForbiddenException('No user from Google');
    }

    // user = { id, email, firstName, lastName, picture, accessToken, refreshToken }

    const fullName = `${user.firstName} ${user.lastName}`;

    let dbUser = await this.usersService.findByGoogleId(user.id);

    if (!dbUser) {
      // --- CREATE NEW USER ---
      dbUser = await this.usersService.createWithGoogle(
        user.email,
        user.id,
        user.accessToken,
        user.refreshToken,
        user.picture,
        fullName,
      );
    } else {
      // --- UPDATE EXISTING USER ---
      if (user.refreshToken) {
        await this.usersService.updateGoogleTokens(
          user.id,
          user.accessToken,
          user.refreshToken,
          user.picture,
          fullName,                        // <<--- FIX: thêm name
        );
      } else {
        await this.usersService.updateGoogleAccessToken(
          user.id,
          user.accessToken,
          user.picture,
          fullName,                        // <<--- FIX: thêm name
        );
      }

      dbUser = await this.usersService.findByGoogleId(user.id);
    }

    if (!dbUser) {
      throw new ForbiddenException('Failed to create or find Google user');
    }

    const userId = dbUser._id.toString();

    // ALWAYS generate embeddings for emails that don't have them
    // This runs in background and doesn't block login
    console.log(`🧠 Triggering embeddings generation for user ${userId}...`);
    this.embeddingsProcessor.processEmailEmbeddings(userId)
      .then(() => {
        console.log(`✅ Embeddings generation completed for user ${userId}`);
      })
      .catch((err: unknown) => {
        const e = err as Error;
        console.error(`❌ Embeddings generation failed for user ${userId}:`, e.message);
      });

    return this.login(dbUser);
  }

  // ======================================
  // LOGIN (GENERATE JWT)
  // ======================================
  async login(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      name: user.name ?? null,
      picture: user.picture ?? null,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    await this.usersService.setCurrentRefreshToken(user._id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  // ======================================
  // LOGOUT
  // ======================================
  async logout(userId: string) {
    await this.gmailService.revokeToken(userId);
    return this.usersService.setCurrentRefreshToken(userId, null);
  }

  // ======================================
  // REFRESH TOKEN
  // ======================================
  async refreshToken(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
