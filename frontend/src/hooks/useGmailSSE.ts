import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { getAccessToken } from '../services/api';

const API_URL = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : ((window as any).env?.VITE_API_URL || 'http://localhost:3000');

interface SSEEvent {
  type: 'gmail-updated' | 'connected';
  userId?: string;
  data?: any;
}

/**
 * Hook for connecting to Gmail SSE real-time updates
 * Automatically reconnects on disconnect
 */
export function useGmailSSE(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Wait for auth loading to finish and user to be present
    if (!enabled || loading || !user) {
      if (!loading && !user) {
        console.log('[SSE] User not authenticated, skipping connection');
      }
      return;
    }

    console.log('[SSE] 🚀 Hook mounted and enabled, preparing to connect...');

    let isMounted = true;

    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);

      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isMounted) {
          setReconnectAttempts((prev) => prev + 1);
          connect();
        }
      }, delay);
    };

    const connect = () => {
      console.log('[SSE] 🔌 Connect function called');

      const token = getAccessToken();
      if (!token) {
        console.warn('[SSE] No access token available, skipping connection');
        setIsConnected(false);
        return;
      }

      // Abort any existing connection
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const url = `${API_URL}/gmail/events`;

      console.log('[SSE] 📡 Connecting to:', url);

      fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          console.log('[SSE] Connected successfully');
          setIsConnected(true);
          setReconnectAttempts(0);

          // Read stream
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('[SSE] Stream ended');
              setIsConnected(false);
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete messages (SSE format: event + data separated by \n\n)
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
              if (!message.trim() || !isMounted) continue;

              try {
                // Parse SSE message
                const lines = message.split('\n');
                let eventType = 'message';
                let eventData = '';

                for (const line of lines) {
                  if (line.startsWith('event:')) {
                    eventType = line.substring(6).trim();
                  } else if (line.startsWith('data:')) {
                    eventData = line.substring(5).trim();
                  }
                }

                if (eventData) {
                  const data: SSEEvent = JSON.parse(eventData);

                  console.log(`[SSE] Event received: ${eventType}`, data);

                  if (data.type === 'gmail-updated') {
                    // Invalidate AND refetch React Query caches immediately
                    queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
                    queryClient.invalidateQueries({ queryKey: ['emails'] });

                    // Force immediate refetch to get latest data from server
                    queryClient.refetchQueries({ queryKey: ['mailboxes'], type: 'active' });
                    queryClient.refetchQueries({ queryKey: ['emails'], type: 'active' });

                    // Special handling for unsnooze: Add email to Kanban cache immediately
                    if ((data as any).action === 'unsnooze' && (data as any).email) {
                      const email = (data as any).email;
                      console.log('[SSE] Adding unsnoozed email to Kanban cache:', email.id);

                      queryClient.setQueryData(['kanban-emails'], (oldEmails: any[] = []) => {
                        // Check if email already exists
                        const exists = oldEmails.some(e => e.id === email.id);
                        if (exists) {
                          // Update existing
                          return oldEmails.map(e => e.id === email.id ? { ...e, ...email } : e);
                        }
                        // Add new
                        return [...oldEmails, email];
                      });

                      // Also invalidate to refresh counts
                      queryClient.invalidateQueries({ queryKey: ['kanban-emails'] });
                    }

                    // Dispatch custom event for component listeners
                    window.dispatchEvent(new CustomEvent('email-update', { detail: data }));
                  }
                }
              } catch (err) {
                console.error('[SSE] Failed to parse event:', err);
              }
            }
          }

          // Stream ended, reconnect
          if (isMounted) {
            setIsConnected(false);
            scheduleReconnect();
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') {
            console.log('[SSE] Connection aborted');
            return;
          }

          console.error('[SSE] Connection error:', err);
          setIsConnected(false);

          if (isMounted) {
            scheduleReconnect();
          }
        });
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      console.log('[SSE] 🧹 Cleaning up...');
      isMounted = false;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setIsConnected(false);
    };
  }, [enabled, queryClient, user, loading]);

  return {
    isConnected,
    reconnectAttempts,
  };
}
