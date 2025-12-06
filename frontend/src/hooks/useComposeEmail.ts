import { useState } from 'react';

export function useComposeEmail() {
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeErrors, setComposeErrors] = useState<{
    to?: string;
    cc?: string;
    bcc?: string;
  }>({});
  const [isSending, setIsSending] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  return {
    showComposeModal,
    setShowComposeModal,
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
    showCc,
    setShowCc,
    showBcc,
    setShowBcc,
    composeErrors,
    setComposeErrors,
    isSending,
    setIsSending,
    editingDraftId,
    setEditingDraftId,
  };
}
