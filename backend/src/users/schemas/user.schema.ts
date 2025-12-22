import { Schema, Document } from 'mongoose';

// ========== KANBAN CONFIGURATION TYPES ==========
export interface GmailLabelMapping {
  matchLabels: string[];
  addLabels: string[];
  removeLabels: string[];
}

export interface KanbanColumnConfig {
  id: string;
  title: string;
  color: string;
  order: number;
  gmailLabelMapping: GmailLabelMapping;
  isDefault?: boolean;
}

export interface UserDocument extends Document {
  email: string;
  password?: string;
  googleId?: string;
  googleAccessToken?: string; // Used for XOAUTH2 IMAP/SMTP if provider='google'
  googleRefreshToken?: string;
  picture?: string;
  name?: string;
  refreshToken?: string;
  lastHistoryId?: string; // for incremental sync
  provider?: string; // 'google' (OAuth + optionally IMAP), 'imap' (password-based), or 'local'
  imapConfig?: {
    host: string;
    port: number;
    tls?: boolean;
    user?: string;
  };
  imapPassword?: string; // encrypted password for IMAP (only if provider='imap')
  smtpConfig?: {
    host: string;
    port: number;
    tls?: boolean;
  };
  // ========== KANBAN CONFIGURATION ==========
  kanbanConfig?: KanbanColumnConfig[];
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

    googleAccessToken: { type: String, required: false }, // Also used for XOAUTH2
    googleRefreshToken: { type: String, required: false },

    // -------------------------
    // PROFILE FIELDS
    // -------------------------
    picture: { type: String, required: false },
    name: { type: String, required: false },

    refreshToken: { type: String, required: false },
    lastHistoryId: { type: String, required: false }, // for incremental sync

    // -------------------------
    // PROVIDER & IMAP CONFIG
    // -------------------------
    // provider can be:
    // - 'google': OAuth2 login, can use googleAccessToken for XOAUTH2 IMAP/SMTP
    // - 'imap': Traditional IMAP with username/password
    // - 'local': Email+password only (no mail access)
    provider: { type: String, required: false, enum: ['google', 'imap', 'local'] },
    
    imapConfig: {
      host: { type: String, required: false },
      port: { type: Number, required: false },
      tls: { type: Boolean, default: true },
      user: { type: String, required: false },
    },
    imapPassword: { type: String, required: false }, // encrypted, only for provider='imap'
    
    smtpConfig: {
      host: { type: String, required: false },
      port: { type: Number, required: false },
      tls: { type: Boolean, default: true },
    },

    // ========== KANBAN CONFIGURATION ==========
    kanbanConfig: {
      type: [{
        id: { type: String, required: true },
        title: { type: String, required: true },
        color: { type: String, required: true },
        order: { type: Number, required: true },
        gmailLabelMapping: {
          matchLabels: [{ type: String }],
          addLabels: [{ type: String }],
          removeLabels: [{ type: String }],
        },
        isDefault: { type: Boolean, default: false },
      }],
      default: undefined,
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
