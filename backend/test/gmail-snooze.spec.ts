import { Test, TestingModule } from '@nestjs/testing';
import { GmailService } from '../src/gmail/gmail.service';
import { GmailLabelService } from '../src/gmail/gmail-label.service';
import { UsersService } from '../src/users/users.service';
import { ConfigService } from '@nestjs/config';
import { SseService } from '../src/gmail/sse.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

/**
 * Integration Tests for Gmail Snooze Feature
 * Tests Gmail API synchronization with rollback behavior
 */
describe('Gmail Snooze Integration Tests', () => {
  let gmailService: GmailService;
  let gmailLabelService: GmailLabelService;
  let usersService: UsersService;

  // Mock data
  const mockUserId = 'user123';
  const mockMessageId = '18d4f5c2a3b1e6f7'; // Valid Gmail messageId format
  const mockInvalidId = '507f1f77bcf86cd799439011'; // MongoDB ObjectId format (invalid for Gmail)
  const mockSnoozedUntil = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

  const mockUser = {
    _id: mockUserId,
    email: 'test@example.com',
    googleAccessToken: 'mock_access_token',
    googleRefreshToken: 'mock_refresh_token',
  };

  const mockEmail = {
    userId: mockUserId,
    messageId: mockMessageId,
    snippet: 'Test email',
    labelIds: ['INBOX'],
    payload: { headers: [] },
    status: 'Inbox',
    snoozed: false,
    snoozedUntil: null,
    snoozedFromStatus: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailService,
        GmailLabelService,
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockUser),
            findEmailByMessageId: jest.fn().mockResolvedValue(mockEmail),
            updateEmailSnooze: jest.fn().mockResolvedValue(true),
            updateEmailStatus: jest.fn().mockResolvedValue(true),
            updateEmail: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                GOOGLE_CLIENT_ID: 'mock_client_id',
                GOOGLE_CLIENT_SECRET: 'mock_client_secret',
                GOOGLE_CALLBACK_URL: 'http://localhost:3000/callback',
              };
              return config[key];
            }),
          },
        },
        {
          provide: SseService,
          useValue: {
            sendEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    gmailService = module.get<GmailService>(GmailService);
    gmailLabelService = module.get<GmailLabelService>(GmailLabelService);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('GmailLabelService.validateMessageId', () => {
    it('should accept valid Gmail messageId', () => {
      expect(() => {
        gmailLabelService.validateMessageId(mockMessageId);
      }).not.toThrow();
    });

    it('should reject MongoDB ObjectId format', () => {
      expect(() => {
        gmailLabelService.validateMessageId(mockInvalidId);
      }).toThrow(BadRequestException);
    });

    it('should reject null or empty messageId', () => {
      expect(() => {
        gmailLabelService.validateMessageId('');
      }).toThrow(BadRequestException);

      expect(() => {
        gmailLabelService.validateMessageId(null as any);
      }).toThrow(BadRequestException);
    });

    it('should reject short messageIds', () => {
      expect(() => {
        gmailLabelService.validateMessageId('abc123');
      }).toThrow(BadRequestException);
    });
  });

  describe('GmailService.snoozeEmail - Gmail Sync', () => {
    beforeEach(() => {
      // Mock Gmail API calls
      jest.spyOn(gmailLabelService, 'applySnoozeLabels').mockResolvedValue(['SNOOZED', 'UNREAD']);
    });

    it('should validate messageId before calling Gmail API', async () => {
      // Mock invalid messageId
      jest.spyOn(gmailLabelService, 'validateMessageId').mockImplementation(() => {
        throw new BadRequestException('Invalid messageId format');
      });

      await expect(
        gmailService.snoozeEmail(mockUserId, mockInvalidId, mockSnoozedUntil)
      ).rejects.toThrow(BadRequestException);
    });

    it('should update local DB first (optimistic update)', async () => {
      const updateSpy = jest.spyOn(usersService, 'updateEmailSnooze');

      // Mock Gmail API to delay
      jest.spyOn(gmailLabelService, 'applySnoozeLabels').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(['SNOOZED']), 100))
      );

      await gmailService.snoozeEmail(mockUserId, mockMessageId, mockSnoozedUntil);

      // Verify local update was called first
      expect(updateSpy).toHaveBeenCalledWith(
        mockUserId,
        mockMessageId,
        true,
        expect.any(Date),
        'Inbox'
      );
    });

    it('should sync with Gmail API (add SNOOZED label, remove INBOX)', async () => {
      const applySpy = jest.spyOn(gmailLabelService, 'applySnoozeLabels');

      await gmailService.snoozeEmail(mockUserId, mockMessageId, mockSnoozedUntil);

      expect(applySpy).toHaveBeenCalledWith(mockUserId, mockMessageId);
    });

    it('should rollback on Gmail API failure', async () => {
      const updateSpy = jest.spyOn(usersService, 'updateEmailSnooze');
      const statusSpy = jest.spyOn(usersService, 'updateEmailStatus');

      // Mock Gmail API failure
      jest.spyOn(gmailLabelService, 'applySnoozeLabels').mockRejectedValue(
        new Error('Gmail API error: 429 Too Many Requests')
      );

      await expect(
        gmailService.snoozeEmail(mockUserId, mockMessageId, mockSnoozedUntil)
      ).rejects.toThrow(InternalServerErrorException);

      // Verify rollback: should call updateEmailSnooze twice (once for snooze, once for rollback)
      expect(updateSpy).toHaveBeenCalledTimes(2);
      
      // Second call should be rollback (snoozed=false)
      expect(updateSpy).toHaveBeenNthCalledWith(
        2,
        mockUserId,
        mockMessageId,
        false,
        null,
        null
      );

      // Should restore original status
      expect(statusSpy).toHaveBeenCalledWith(mockUserId, mockMessageId, 'Inbox');
    });
  });

  describe('GmailService.unsnoozeEmail - Gmail Sync', () => {
    beforeEach(() => {
      // Mock snoozed email
      jest.spyOn(usersService, 'findEmailByMessageId').mockResolvedValue({
        ...mockEmail,
        snoozed: true,
        snoozedUntil: new Date(mockSnoozedUntil),
        snoozedFromStatus: 'To Do',
        status: 'Snoozed',
      });

      // Mock Gmail API calls
      jest.spyOn(gmailLabelService, 'removeSnoozeLabels').mockResolvedValue(['INBOX', 'UNREAD']);
    });

    it('should restore to original status', async () => {
      const statusSpy = jest.spyOn(usersService, 'updateEmailStatus');

      await gmailService.unsnoozeEmail(mockUserId, mockMessageId);

      expect(statusSpy).toHaveBeenCalledWith(mockUserId, mockMessageId, 'To Do');
    });

    it('should sync with Gmail API (remove SNOOZED label, add INBOX)', async () => {
      const removeSpy = jest.spyOn(gmailLabelService, 'removeSnoozeLabels');

      await gmailService.unsnoozeEmail(mockUserId, mockMessageId);

      expect(removeSpy).toHaveBeenCalledWith(mockUserId, mockMessageId);
    });

    it('should rollback on Gmail API failure', async () => {
      const updateSpy = jest.spyOn(usersService, 'updateEmailSnooze');

      // Mock Gmail API failure
      jest.spyOn(gmailLabelService, 'removeSnoozeLabels').mockRejectedValue(
        new Error('Gmail API error: Network timeout')
      );

      await expect(
        gmailService.unsnoozeEmail(mockUserId, mockMessageId)
      ).rejects.toThrow(InternalServerErrorException);

      // Verify rollback: should re-apply snooze
      expect(updateSpy).toHaveBeenNthCalledWith(
        2, // Second call is rollback
        mockUserId,
        mockMessageId,
        true,
        expect.any(Date),
        'To Do'
      );
    });
  });

  describe('GmailLabelService.retryWithBackoff', () => {
    it('should retry on transient errors (429, 503)', async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          const error: any = new Error('Service unavailable');
          error.code = 503;
          throw error;
        }
        return Promise.resolve('success');
      });

      const result = await gmailLabelService.retryWithBackoff(operation, 3, 100);

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should NOT retry on client errors (400, 401, 404)', async () => {
      const operation = jest.fn().mockImplementation(() => {
        const error: any = new Error('Invalid id value');
        error.code = 400;
        throw error;
      });

      await expect(
        gmailLabelService.retryWithBackoff(operation, 3, 100)
      ).rejects.toThrow('Invalid id value');

      // Should only be called once (no retries)
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff delays', async () => {
      const delays: number[] = [];
      let attemptCount = 0;

      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 3) {
          const error: any = new Error('Rate limit');
          error.code = 429;
          throw error;
        }
        return Promise.resolve('success');
      });

      // Spy on setTimeout to capture delays
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay: number) => {
        delays.push(delay);
        callback();
        return 0 as any;
      });

      try {
        await gmailLabelService.retryWithBackoff(operation, 3, 1000);
      } catch (err) {
        // Expected to fail after retries
      }

      // Verify exponential backoff: 1000, 2000, 4000
      expect(delays).toEqual([1000, 2000, 4000]);
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error when using internal DB id instead of Gmail messageId', async () => {
      jest.spyOn(gmailLabelService, 'validateMessageId').mockImplementation(() => {
        throw new BadRequestException(
          'Invalid Gmail messageId format: "507f1f77bcf86cd799439011". ' +
          'This appears to be an internal database ID. ' +
          'Gmail API requires the actual Gmail messageId.'
        );
      });

      await expect(
        gmailService.snoozeEmail(mockUserId, mockInvalidId, mockSnoozedUntil)
      ).rejects.toThrow('internal database ID');
    });

    it('should indicate rollback in error message', async () => {
      jest.spyOn(gmailLabelService, 'applySnoozeLabels').mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        gmailService.snoozeEmail(mockUserId, mockMessageId, mockSnoozedUntil)
      ).rejects.toThrow('rolled back');
    });
  });
});
