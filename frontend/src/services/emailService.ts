export const saveDraft = async (payload: any) => {
  return api.post('/gmail/draft', payload);
};

// ========== FEATURE II: UPDATE EMAIL STATUS FOR KANBAN WORKFLOW ==========
export const updateEmailStatus = async (emailId: string, status: string) => {
  const { data } = await api.patch(`/gmail/emails/${emailId}/status`, { status });
  return data;
};

// ========== FEATURE III: SNOOZE / DEFERRAL MECHANISM ==========

/**
 * Snooze an email until a specific time
 * @param emailId - Email message ID
 * @param snoozedUntil - ISO timestamp when to wake up
 * @param simulate - Enable simulation mode (30s auto-unsnooze)
 * @returns Updated email object with snooze metadata
 */
export const snoozeEmail = async (emailId: string, snoozedUntil: string, simulate = false) => {
  const { data } = await api.post(
    `/gmail/emails/${emailId}/snooze${simulate ? '?simulate=true' : ''}`,
    { snoozedUntil, simulate }
  );
  return data;
};

/**
 * Unsnooze an email immediately (restore to original status)
 * @param emailId - Email message ID
 * @returns Updated email object
 */
export const unsnoozeEmail = async (emailId: string) => {
  const { data } = await api.post(`/gmail/emails/${emailId}/unsnooze`);
  return data;
};

/**
 * Get all snoozed emails for current user
 * @returns Array of snoozed emails
 */
export const getSnoozedEmails = async () => {
  const { data } = await api.get('/gmail/emails/snoozed');
  return data;
};

/**
 * Update snooze time for an email
 * @param emailId - Email message ID
 * @param snoozedUntil - New ISO timestamp when to wake up
 * @returns Updated snooze info
 */
export const updateSnoozeTime = async (emailId: string, snoozedUntil: string) => {
  const { data } = await api.patch(`/gmail/emails/${emailId}/snooze-time`, { snoozedUntil });
  return data;
};

import { api } from './api';

export const fetchMailboxes = async () => {
  const { data } = await api.get('/gmail/mailboxes');
  return data;
};

export const fetchEmails = async (mailboxId: string) => {
  try {
    const { data } = await api.get(`/gmail/mailboxes/${mailboxId}/emails`);
    // Ensure we always return a valid structure
    return {
      messages: data?.messages || [],
      nextPageToken: data?.nextPageToken || undefined,
    };
  } catch (error: any) {
    console.error('Error fetching emails:', error?.response?.data || error.message);
    // Return empty array instead of throwing to prevent "Error loading emails"
    return {
      messages: [],
      nextPageToken: undefined,
    };
  }
};

export const fetchEmail = async (emailId: string) => {
  const { data } = await api.get(`/gmail/emails/${emailId}`);
  return data;
};

export const patchEmailStar = async (emailId: string, starred: boolean) => {
  return api.patch(`/gmail/emails/${emailId}/star`, { starred });
};

export const patchEmailRead = async (emailId: string, read: boolean) => {
  return api.patch(`/gmail/emails/${emailId}/read`, { read });
};

export const patchBulkRead = async (ids: string[], read: boolean) => {
  return api.patch('/gmail/emails/bulk-read', { ids, read });
};

export const patchEmailSpam = async (emailId: string) => {
  return api.patch(`/gmail/emails/${emailId}/spam`);
};

export const deleteEmail = async (emailId: string) => {
  return api.delete(`/gmail/emails/${emailId}`);
};

export const patchEmailArchive = async (emailId: string) => {
  return api.patch(`/gmail/emails/${emailId}/archive`, {});
};

export const postEmailMove = async (emailId: string, label: string) => {
  return api.post(`/gmail/emails/${emailId}/move`, { label });
};

export const postGmailRefresh = async () => {
  return api.post('/gmail/refresh');
};

export const postSendEmail = async (payload: any) => {
  return api.post('/gmail/send', payload);
};

export const getAttachment = async (messageId: string, attachmentId: string) => {
  return api.get(`/gmail/attachments/${messageId}/${attachmentId}`);
};

// ========== FEATURE IV: AI SUMMARIZATION ==========

/**
 * Generate AI summary for an email
 * @param emailId - Email message ID
 * @returns Email object with AI-generated summary
 */
export const summarizeEmail = async (emailId: string) => {
  const { data } = await api.post(`/gmail/emails/${emailId}/summarize`);
  return data;
};
