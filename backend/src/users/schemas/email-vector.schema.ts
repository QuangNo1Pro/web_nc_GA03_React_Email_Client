import { Schema, Document } from 'mongoose';

export interface EmailVectorDocument extends Document {
    userId: string;
    messageId: string;
    embedding: number[];
    createdAt: Date;
    updatedAt: Date;
}

export const EmailVectorSchema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        messageId: { type: String, required: true, index: true },
        embedding: { type: [Number], required: true },
    },
    {
        timestamps: true,
        collection: 'email_vectors'
    },
);

// Compound index for efficient lookups
EmailVectorSchema.index({ userId: 1, messageId: 1 }, { unique: true });
