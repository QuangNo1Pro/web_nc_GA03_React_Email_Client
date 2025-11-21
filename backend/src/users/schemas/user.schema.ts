import { Schema, Document } from 'mongoose';

export interface UserDocument extends Document {
  email: string;
  password?: string;
  googleId?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  refreshToken?: string;
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
    refreshToken: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

UserSchema.set('toJSON', {
  transform: function (doc, ret: any) {
    delete ret.password;
    delete ret.refreshToken;
    return ret;
  },
});