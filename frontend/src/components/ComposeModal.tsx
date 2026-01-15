import React, { useEffect } from 'react';
import QuillEditor from './QuillEditor';
import MaterialIcon from './MaterialIcon';

interface ComposeModalProps {
  showComposeModal: boolean;
  setShowComposeModal: () => void;
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
  showCc: boolean;
  setShowCc: (v: boolean) => void;
  showBcc: boolean;
  setShowBcc: (v: boolean) => void;
  composeErrors: any;
  setComposeErrors: (v: any) => void;
  isSending: boolean;
  handleSendEmail: () => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({
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
  handleSendEmail,
}) => {
  // Ctrl+Enter to send email
  useEffect(() => {
    if (!showComposeModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isSending) {
          handleSendEmail();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showComposeModal, isSending, handleSendEmail]);

  if (!showComposeModal) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={() => setShowComposeModal()}
    >
      <div
        className="w-full max-w-3xl flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          maxHeight: '90vh',
          border: '1px solid var(--border-primary)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center px-4 py-3 border-b"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="font-semibold"
              style={{ color: 'var(--text-primary)', fontSize: '0.9375rem' }}
            >
              Thư mới
            </span>
          </div>
          <button
            onClick={() => setShowComposeModal()}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
        {/* BODY */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* TO */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                Tới
              </label>
              <div className="flex gap-3 text-xs">
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    style={{ color: 'var(--accent-primary)' }}
                    className="hover:underline font-medium"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    onClick={() => setShowBcc(true)}
                    style={{ color: 'var(--accent-primary)' }}
                    className="hover:underline font-medium"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>
            <input
              type="text"
              className="w-full rounded-lg px-4 py-2.5 text-sm transition-all"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: composeErrors.to ? '1.5px solid var(--error)' : '1.5px solid var(--border-primary)',
                color: 'var(--text-primary)',
              }}
              placeholder="email1@gmail.com, email2@gmail.com"
              value={composeTo}
              onChange={e => { setComposeTo(e.target.value); setComposeErrors((prev: any) => ({ ...prev, to: undefined })); }}
              onFocus={(e) => {
                if (!composeErrors.to) {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }
              }}
              onBlur={(e) => {
                if (!composeErrors.to) {
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                }
              }}
            />
            {composeErrors.to && <p className="text-xs mt-1.5" style={{ color: 'var(--error)' }}>{composeErrors.to}</p>}
          </div>
          {/* CC */}
          {showCc && (
            <div className="animate-slide-down">
              <label
                className="text-sm font-medium mb-2 block"
                style={{ color: 'var(--text-primary)' }}
              >
                Cc
              </label>
              <input
                type="text"
                className="w-full rounded-lg px-4 py-2.5 text-sm transition-all"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: composeErrors.cc ? '1.5px solid var(--error)' : '1.5px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
                placeholder="email1@gmail.com, email2@gmail.com"
                value={composeCc}
                onChange={e => { setComposeCc(e.target.value); setComposeErrors((prev: any) => ({ ...prev, cc: undefined })); }}
                onFocus={(e) => {
                  if (!composeErrors.cc) {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }
                }}
                onBlur={(e) => {
                  if (!composeErrors.cc) {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }
                }}
              />
              {composeErrors.cc && <p className="text-xs mt-1.5" style={{ color: 'var(--error)' }}>{composeErrors.cc}</p>}
            </div>
          )}
          {/* BCC */}
          {showBcc && (
            <div className="animate-slide-down">
              <label
                className="text-sm font-medium mb-2 block"
                style={{ color: 'var(--text-primary)' }}
              >
                Bcc
              </label>
              <input
                type="text"
                className="w-full rounded-lg px-4 py-2.5 text-sm transition-all"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: composeErrors.bcc ? '1.5px solid var(--error)' : '1.5px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
                placeholder="email1@gmail.com, email2@gmail.com"
                value={composeBcc}
                onChange={e => { setComposeBcc(e.target.value); setComposeErrors((prev: any) => ({ ...prev, bcc: undefined })); }}
                onFocus={(e) => {
                  if (!composeErrors.bcc) {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }
                }}
                onBlur={(e) => {
                  if (!composeErrors.bcc) {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }
                }}
              />
              {composeErrors.bcc && <p className="text-xs mt-1.5" style={{ color: 'var(--error)' }}>{composeErrors.bcc}</p>}
            </div>
          )}
          {/* SUBJECT */}
          <div>
            <label
              className="text-sm font-medium mb-2 block"
              style={{ color: 'var(--text-primary)' }}
            >
              Chủ đề
            </label>
            <input
              type="text"
              className="w-full rounded-lg px-4 py-2.5 text-sm transition-all"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1.5px solid var(--border-primary)',
                color: 'var(--text-primary)',
              }}
              placeholder="Nhập chủ đề..."
              value={composeSubject}
              onChange={e => setComposeSubject(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
              }}
            />
          </div>
          {/* RICH TEXT EDITOR */}
          <div>
            <label className="text-sm font-medium mb-1 block">Nội dung</label>
            <div className="border rounded-lg border-gray-300 overflow-hidden">
              <QuillEditor
                value={composeBody}
                onChange={setComposeBody}
                placeholder="Nhập nội dung... (Hỗ trợ dán ảnh)"
                style={{ height: 200 }}
              />
            </div>
          </div>
          {/* ATTACHMENTS */}
          <div>
            <label className="text-sm font-medium mb-1 block">Tệp đính kèm</label>
            <label className="inline-flex items-center px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer border border-dashed border-gray-300">
              📎 <span className="ml-2">Chọn tệp...</span>
              <input type="file" multiple className="hidden" onChange={e => { const files = e.target.files ? Array.from(e.target.files) : []; setComposeAttachments([...composeAttachments, ...files]); }} />
            </label>
            {/* Preview */}
            {composeAttachments.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto space-y-2">
                {composeAttachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded bg-gray-50 text-sm">
                    <div className="truncate">📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)</div>
                    <button onClick={() => setComposeAttachments(composeAttachments.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 ml-2 text-xs">X</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* FOOTER */}
        <div
          className="px-4 py-3 border-t flex justify-between items-center"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <button
            onClick={handleSendEmail}
            disabled={isSending}
            className="px-6 py-2.5 rounded-full font-medium shadow-sm transition-all flex items-center gap-2"
            style={{
              backgroundColor: isSending ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              if (!isSending) {
                e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSending) {
                e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }
            }}
          >
            {isSending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                <span>Gửi</span>
              </>
            )}
          </button>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ctrl + Enter để gửi</span>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
