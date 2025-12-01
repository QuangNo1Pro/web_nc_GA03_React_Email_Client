import { Schema, Document } from 'mongoose';

export interface EmailDocument extends Document {
  userId: string;
  messageId: string;
  snippet: string;
  labelIds: string[];
  payload: any;
  internalDate?: string;
}

export const EmailSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    snippet: { type: String },
    labelIds: [{ type: String }],
    payload: { type: Schema.Types.Mixed },
    internalDate: { type: String },
  },
  { timestamps: true },
);

EmailSchema.index({ userId: 1, messageId: 1 }, { unique: true });
EmailSchema.index({ userId: 1, labelIds: 1 });
