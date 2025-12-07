import { Schema, Document } from 'mongoose';

export interface UserDocument extends Document {
  email: string;
  password?: string;
  googleId?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  picture?: string;     // ✔ ADD
  name?: string;        // ✔ ADD
  refreshToken?: string;
  lastHistoryId?: string; // ✔ ADD for incremental sync
  provider?: string; // 'google' or 'imap' or 'local'
  imapConfig?: {
    host: string;
    port: number;
    tls?: boolean;
  };
  imapPassword?: string; // encrypted
  smtpConfig?: {
    host: string;
    port: number;
    tls?: boolean;
  };
  createdAt: Date;
}

export const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: false },

    googleId: { type: String, required: false, unique: true, sparse: true },

    googleAccessToken: { type: String, required: false },
    googleRefreshToken: { type: String, required: false },

    // -------------------------
    // NEW: GOOGLE PROFILE FIELDS
    // -------------------------
    picture: { type: String, required: false },
    name: { type: String, required: false },

    refreshToken: { type: String, required: false },
    lastHistoryId: { type: String, required: false }, // for incremental sync

    provider: { type: String, required: false, enum: ['google', 'imap', 'local'] },
    
    imapConfig: {
      host: { type: String, required: false },
      port: { type: Number, required: false },
      tls: { type: Boolean, default: true },
    },
    imapPassword: { type: String, required: false },
    
    smtpConfig: {
      host: { type: String, required: false },
      port: { type: Number, required: false },
      tls: { type: Boolean, default: true },
    },

    createdAt: { type: Date, default: Date.now },
  },
  { 
    timestamps: false,
    strict: false  // Allow fields not in schema to be saved
  },
);

// HIDE PASSWORD + REFRESH TOKEN
UserSchema.set('toJSON', {
  transform: function (doc, ret: any) {
    delete ret.password;
    delete ret.refreshToken;
    return ret;
  },
});
