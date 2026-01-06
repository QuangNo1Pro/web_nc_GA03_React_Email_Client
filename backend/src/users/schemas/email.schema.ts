import { Schema, Document } from 'mongoose';

export interface EmailDocument extends Document {
  userId: string;
  messageId: string; // Gmail messageId (also accessible as gmailMessageId for clarity)
  snippet: string;
  labelIds: string[];
  payload: any;
  internalDate?: string;
  status?: string; // Kanban status: "Inbox" | "To Do" | "In Progress" | "Done" | "Snoozed"
  // FEATURE III: Snooze fields
  snoozed?: boolean; // Whether email is currently snoozed
  snoozedUntil?: Date; // When to wake up the email
  snoozedFromStatus?: string; // Original status before snooze (for restoration)
  // FEATURE IV: AI Summarization
  summary?: string; // AI-generated summary of email content
  summaryGenerated?: boolean; // Track if summary was already generated (avoid re-generation)
  summarizedAt?: Date; // Timestamp when summary was generated
  // Full text content extracted from HTML for easy reading
  textContent?: string;

  // Virtual field for clarity when calling Gmail API
  readonly gmailMessageId?: string; // Alias for messageId
  readonly gmailThreadId?: string; // Gmail thread ID if available
}

export const EmailSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    messageId: { type: String, required: true }, // This IS the Gmail messageId
    snippet: { type: String },
    labelIds: [{ type: String }],
    payload: { type: Schema.Types.Mixed },
    internalDate: { type: String },
    status: { type: String }, // Kanban status field
    // FEATURE III: Snooze fields
    snoozed: { type: Boolean, default: false },
    snoozedUntil: { type: Date, default: null },
    snoozedFromStatus: { type: String, default: null },
    // FEATURE IV: AI Summarization fields
    summary: { type: String, default: null },
    summarizedAt: { type: Date, default: null },
    // Full text content extracted from HTML/plain for easy reading
    textContent: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  },
);

// Virtual fields for clarity
EmailSchema.virtual('gmailMessageId').get(function () {
  return this.messageId;
});

EmailSchema.virtual('gmailThreadId').get(function () {
  return this.payload?.threadId || null;
});

EmailSchema.index({ userId: 1, messageId: 1 }, { unique: true });
EmailSchema.index({ userId: 1, labelIds: 1 });
EmailSchema.index({ userId: 1, status: 1 }); // Index for Kanban queries
// FEATURE III: Index for snooze queries (finding expired snoozes)
EmailSchema.index({ snoozed: 1, snoozedUntil: 1 }); // Composite index for scheduler
