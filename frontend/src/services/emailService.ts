export const saveDraft = async (payload: any) => {
  return api.post('/gmail/draft', payload);
};
import { api } from './api';

export const fetchMailboxes = async () => {
  const { data } = await api.get('/gmail/mailboxes');
  return data;
};

export const fetchEmails = async (mailboxId: string) => {
  const { data } = await api.get(`/gmail/mailboxes/${mailboxId}/emails`);
  return data;
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
