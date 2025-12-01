import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { FixedSizeList } from 'react-window';
import EmailRow from './EmailRow';
import { ListChildComponentProps } from 'react-window';

interface EmailListProps {
  emails: any[];
  selectedEmail: string | null;
  selectedEmails: Set<string>;
  starredState: { [id: string]: boolean };
  readState: { [id: string]: boolean };
  showCheckboxes: boolean;
  handleToggleCheckbox: (emailId: string) => void;
  handleEmailSelect: (emailId: string) => void;
  handleToggleRead: (emailId: string) => void;
  handleToggleStar: (emailId: string) => void;
  focusedEmailIndex: number;
  user: any;
  listHeight: number;
}

export interface EmailListHandle {
  preserveScroll: () => number;
  restoreScroll: (offset: number) => void;
}

// Wrapper để truyền đúng kiểu cho EmailRow
const EmailRowWrapper = ({ index, style, data }: ListChildComponentProps) => (
  <EmailRow index={index} style={style} data={data} />
);

const EmailList = forwardRef<EmailListHandle, EmailListProps>(({
  emails,
  selectedEmail,
  selectedEmails,
  starredState,
  readState,
  showCheckboxes,
  handleToggleCheckbox,
  handleEmailSelect,
  handleToggleRead,
  handleToggleStar,
  focusedEmailIndex,
  user,
  listHeight,
}, ref) => {
  const listRef = useRef<FixedSizeList>(null);

  // Expose scroll preservation methods to parent
  useImperativeHandle(ref, () => ({
    preserveScroll: () => {
      const currentOffset = (listRef.current as any)?._outerRef?.scrollTop || 0;
      return currentOffset;
    },
    restoreScroll: (offset: number) => {
      if (listRef.current && (listRef.current as any)._outerRef) {
        (listRef.current as any)._outerRef.scrollTop = offset;
      }
    },
  }));

  return (
    <div className="h-full">
      <FixedSizeList
        ref={listRef}
        height={listHeight}
        itemCount={emails.length}
        itemSize={90}
        width="100%"
        itemData={{
          emails,
          selectedEmail,
          selectedEmails,
          starredState,
          readState,
          showCheckboxes,
          handleToggleCheckbox,
          handleEmailSelect,
          handleToggleRead,
          handleToggleStar,
          focusedEmailIndex,
          user,
        }}
      >
        {EmailRowWrapper}
      </FixedSizeList>
    </div>
  );
});

EmailList.displayName = 'EmailList';

export default EmailList;
