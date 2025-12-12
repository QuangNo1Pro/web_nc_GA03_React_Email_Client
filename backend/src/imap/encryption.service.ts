import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long-for-aes';

  // Ensure key is exactly 32 bytes for AES-256
  private getKey(): Buffer {
    const key = Buffer.from(this.encryptionKey.padEnd(32).substring(0, 32), 'utf8');
    return key;
  }

  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.getKey(), iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine iv + authTag + encrypted data
      const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      return result;
    } catch (error) {
      const err = error as Error;
      throw new Error('Encryption failed: ' + err.message);
    }
  }

  decrypt(encrypted: string): string {
    try {
      const parts = encrypted.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.getKey(), iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      const err = error as Error;
      throw new Error('Decryption failed: ' + err.message);
    }
  }
}
