import { Schema, Document } from 'mongoose';

export interface MailboxDocument extends Document {
  userId: string;
  id: string;
  name: string;
  messagesTotal: number;
  messagesUnread: number;
}

export const MailboxSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    id: { type: String, required: true },
    name: { type: String, required: true },
    messagesTotal: { type: Number, default: 0 },
    messagesUnread: { type: Number, default: 0 },
  },
  { timestamps: true },
);

MailboxSchema.index({ userId: 1, id: 1 }, { unique: true });
