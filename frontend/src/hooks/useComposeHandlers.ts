import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';

export function useComposeHandlers({
  composeTo,
  setComposeTo,
  composeCc,
  setComposeCc,
  composeBcc,
  setComposeBcc,
  composeSubject,
  setComposeSubject,
  composeBody,
  setComposeBody,
  composeAttachments,
  setComposeAttachments,
  setShowCc,
  setShowBcc,
  setShowComposeModal,
  setComposeErrors,
  setIsSending,
  user,
  onSendSuccess,
}: {
  composeTo: string;
  setComposeTo: (v: string) => void;
  composeCc: string;
  setComposeCc: (v: string) => void;
  composeBcc: string;
  setComposeBcc: (v: string) => void;
  composeSubject: string;
  setComposeSubject: (v: string) => void;
  composeBody: string;
  setComposeBody: (v: string) => void;
  composeAttachments: File[];
  setComposeAttachments: (v: File[]) => void;
  setShowCc: (v: boolean) => void;
  setShowBcc: (v: boolean) => void;
  setShowComposeModal: (v: boolean) => void;
  setComposeErrors: (v: any) => void;
  setIsSending: (v: boolean) => void;
  user: any;
  onSendSuccess?: () => void | Promise<void>;
}) {
    const queryClient = useQueryClient();
    
    // Đọc file đính kèm thành base64
    const readFileAsBase64 = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

  // Gửi email với optimistic UI
  const handleSendEmail = async () => {
    if (
      !composeTo ||
      !composeSubject ||
      (!composeBody && composeAttachments.length === 0)
    ) {
      alert('Vui lòng điền đầy đủ thông tin hoặc thêm tệp đính kèm!');
      return;
    }
    setIsSending(true);
    
    // Create optimistic email object
    const optimisticEmail = {
      id: `temp_${Date.now()}`,
      from: user?.email || '',
      to: composeTo,
      cc: composeCc,
      bcc: composeBcc,
      subject: composeSubject,
      body: composeBody,
      snippet: composeBody?.slice(0, 100) || '',
      read: true,
      starred: false,
      labelIds: ['SENT'],
      internalDate: Date.now().toString(),
      received: new Date().toISOString(),
      sender: user?.email || '',
      payload: {
        to: composeTo,
        cc: composeCc,
        bcc: composeBcc,
        subject: composeSubject,
        body: composeBody,
      }
    };

    // ===== OPTIMISTIC UI: Add to SENT cache immediately =====
    queryClient.setQueryData(['emails', 'SENT'], (oldData: any) => {
      if (!Array.isArray(oldData)) return [optimisticEmail];
      return [optimisticEmail, ...oldData];
    });

    // Update mailboxes count optimistically
    queryClient.setQueryData(['mailboxes'], (oldMailboxes: any) => {
      if (!Array.isArray(oldMailboxes)) return oldMailboxes;
      return oldMailboxes.map((mb: any) => {
        if (mb.id === 'SENT') {
          return { ...mb, messagesTotal: mb.messagesTotal + 1 };
        }
        return mb;
      });
    });

    try {
      const processedAttachments = await Promise.all(
        composeAttachments.map(async (file) => {
          const base64Content = await readFileAsBase64(file);
          return {
            filename: file.name,
            mimeType: file.type,
            base64Content,
          };
        }),
      );
      
      await api.post('/gmail/send', {
        to: composeTo,
        cc: composeCc,
        bcc: composeBcc,
        subject: composeSubject,
        body: composeBody,
        attachments: processedAttachments,
      });
      
      // Clear form
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject('');
      setComposeBody('');
      setComposeAttachments([]);
      setShowCc(false);
      setShowBcc(false);
      setShowComposeModal(false);
      
      toast.success('Gửi email thành công!');
      
      // Only invalidate mailboxes for count sync, not emails
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      
      // Call refresh callback if provided
      if (onSendSuccess) {
        await onSendSuccess();
      }
    } catch (err) {
      toast.error('Lỗi khi gửi email!');
      
      // Rollback on error
      queryClient.setQueryData(['emails', 'SENT'], (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.filter((e: any) => e.id !== optimisticEmail.id);
      });
      queryClient.setQueryData(['mailboxes'], (oldMailboxes: any) => {
        if (!Array.isArray(oldMailboxes)) return oldMailboxes;
        return oldMailboxes.map((mb: any) => {
          if (mb.id === 'SENT') {
            return { ...mb, messagesTotal: Math.max(0, mb.messagesTotal - 1) };
          }
          return mb;
        });
      });
    } finally {
      setIsSending(false);
    }
  };

  return {
    handleSendEmail,
    readFileAsBase64,
  };
}
