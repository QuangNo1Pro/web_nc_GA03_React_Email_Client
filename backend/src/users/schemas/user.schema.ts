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

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// HIDE PASSWORD + REFRESH TOKEN
UserSchema.set('toJSON', {
  transform: function (doc, ret: any) {
    delete ret.password;
    delete ret.refreshToken;
    return ret;
  },
});
