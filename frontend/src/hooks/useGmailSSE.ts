import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

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
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isMounted = true;

    const connect = () => {
      // Abort any existing connection
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.warn('[SSE] No access token found');
        return;
      }

      const url = `${API_URL}/gmail/events`;

      console.log('[SSE] Connecting to:', url);

      fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
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
                    // Invalidate React Query caches
                    queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
                    queryClient.invalidateQueries({ queryKey: ['emails'] });
                    
                    toast.success('📬 New emails received', {
                      duration: 2000,
                      position: 'bottom-right',
                    });
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

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
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
  }, [enabled, queryClient, reconnectAttempts]);

  return {
    isConnected,
    reconnectAttempts,
  };
}
