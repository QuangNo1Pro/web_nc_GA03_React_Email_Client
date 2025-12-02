import { useMemo, useState } from 'react';

export function useEmailPagination(emails: any[], searchQuery: string, selectedMailbox: string, starredState: Record<string, boolean>, readFilter: 'all' | 'read' | 'unread', pageSize: number = 20) {
  const [currentPage, setCurrentPage] = useState(1);

  // Filter emails
  const filteredEmails = useMemo(() => {
    let result = emails || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((email: any) =>
        email.sender?.toLowerCase().includes(q) ||
        email.subject?.toLowerCase().includes(q) ||
        email.preview?.toLowerCase().includes(q)
      );
    }
    result = result.filter((email: any) => {
      if (
        (selectedMailbox === 'starred' || selectedMailbox === 'STARRED') &&
        !starredState[email.id]
      ) {
        return false;
      }
      if (readFilter === 'read' && !email.read) return false;
      if (readFilter === 'unread' && email.read) return false;
      return true;
    });
    return result;
  }, [emails, searchQuery, selectedMailbox, starredState, readFilter]);

  const totalPages = filteredEmails.length === 0 ? 1 : Math.ceil(filteredEmails.length / pageSize);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedEmails = filteredEmails.slice(startIndex, startIndex + pageSize);

  return {
    filteredEmails,
    paginatedEmails,
    currentPage,
    setCurrentPage,
    pageSize,
    startIndex,
    totalPages,
    safeCurrentPage,
  };
}
