import { api, getUserProvider } from './api';

export const fetchMailboxes = async () => {
  const provider = await getUserProvider();
  
  if (provider === 'imap') {
    const { data } = await api.get('/imap/mailboxes');
    return data;
  } else {
    const { data } = await api.get('/gmail/mailboxes');
    return data;
  }
};

export const fetchEmails = async (mailboxId: string) => {
  try {
    const provider = await getUserProvider();
    
    if (provider === 'imap') {
      console.log('[EmailService] 📧 Fetching IMAP emails for mailbox:', mailboxId);
      const { data } = await api.get(`/imap/emails/${mailboxId}`);
      console.log('[EmailService] ✅ IMAP response:', { dataType: Array.isArray(data) ? 'array' : typeof data, count: data?.length, sample: data?.[0] });
      return {
        messages: data || [],
        nextPageToken: undefined,
      };
    } else {
      const { data } = await api.get(`/gmail/mailboxes/${mailboxId}/emails`);
      return {
        messages: data?.messages || [],
        nextPageToken: data?.nextPageToken || undefined,
      };
    }
  } catch (error: any) {
    console.error('[EmailService] ❌ Error fetching emails:', error?.response?.data || error.message);
    return {
      messages: [],
      nextPageToken: undefined,
    };
  }
};

export const saveDraft = async (payload: any) => {
  const provider = await getUserProvider();
  
  if (provider === 'imap') {
    // IMAP doesn't have draft API, just return success
    // Drafts are saved locally in ComposeModal state
    return { data: { success: true } };
  } else {
    return api.post('/gmail/draft', payload);
  }
};

export const fetchEmail = async (emailId: string, mailbox: string = 'INBOX') => {
  try {
    const provider = await getUserProvider();
    
    if (provider === 'imap') {
      console.log('[EmailService] 📧 Fetching IMAP email detail:', emailId, 'from', mailbox);
      const { data } = await api.get(`/imap/email/${mailbox}/${emailId}`);
      console.log('[EmailService] ✅ IMAP email detail:', data);
      return data;
    } else {
      const { data } = await api.get(`/gmail/emails/${emailId}`);
      return data;
    }
  } catch (error: any) {
    console.error('[EmailService] ❌ Error fetching email detail:', error?.response?.data || error.message);
    throw error;
  }
};

export const patchEmailStar = async (emailId: string, starred: boolean, mailbox: string = 'INBOX') => {
  const provider = await getUserProvider();
  
  if (provider === 'imap') {
    return api.post(`/imap/emails/${mailbox}/${emailId}/star`, { starred });
  } else {
    return api.patch(`/gmail/emails/${emailId}/star`, { starred });
  }
};

export const patchEmailRead = async (emailId: string, read: boolean, mailbox: string = 'INBOX') => {
  const provider = await getUserProvider();
  
  if (provider === 'imap') {
    return api.post(`/imap/emails/${mailbox}/${emailId}/read`, { read });
  } else {
    return api.patch(`/gmail/emails/${emailId}/read`, { read });
  }
};

export const patchBulkRead = async (ids: string[], read: boolean) => {
  return api.patch('/gmail/emails/bulk-read', { ids, read });
};

export const patchEmailSpam = async (emailId: string) => {
  return api.patch(`/gmail/emails/${emailId}/spam`);
};

export const deleteEmail = async (emailId: string, mailbox: string = 'INBOX') => {
  const provider = await getUserProvider();
  
  if (provider === 'imap') {
    return api.post(`/imap/emails/${mailbox}/${emailId}/delete`);
  } else {
    return api.delete(`/gmail/emails/${emailId}`);
  }
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
  const provider = await getUserProvider();
  
  if (provider === 'imap') {
    return api.post('/imap/send', payload);
  } else {
    return api.post('/gmail/send', payload);
  }
};

export const getAttachment = async (messageId: string, attachmentId: string) => {
  return api.get(`/gmail/attachments/${messageId}/${attachmentId}`);
};
