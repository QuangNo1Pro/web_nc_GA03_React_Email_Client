import { Test, TestingModule } from '@nestjs/testing';
import { SearchService, SearchResult, SearchResponse } from './search.service';
import { getModelToken } from '@nestjs/mongoose';

describe('SearchService', () => {
  let service: SearchService;
  let mockEmailModel: any;

  const mockEmails = [
    {
      _id: { toString: () => '1' },
      userId: 'user-123',
      subject: 'Marketing Campaign Q4',
      snippet: 'Marketing campaign details...',
      summary: 'Q4 marketing strategy and budget allocation',
      payload: {
        headers: [
          { name: 'From', value: 'Nguyễn Văn A <nguyena@example.com>' },
        ],
      },
    },
    {
      _id: { toString: () => '2' },
      userId: 'user-123',
      subject: 'Meeting notes from marketing team',
      snippet: 'Team discussed campaign...',
      summary: 'Marketing team sync on Q4 plans',
      payload: {
        headers: [
          { name: 'From', value: 'Nguyễn Văn B <nguyenb@example.com>' },
        ],
      },
    },
    {
      _id: { toString: () => '3' },
      userId: 'user-123',
      subject: 'Invoice #1234',
      snippet: 'Invoice for services rendered...',
      summary: 'Monthly invoice for consulting services',
      payload: {
        headers: [
          { name: 'From', value: 'Finance Team <finance@company.com>' },
        ],
      },
    },
  ];

  beforeEach(async () => {
    mockEmailModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockEmails),
          }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getModelToken('Email'),
          useValue: mockEmailModel,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search()', () => {
    it('should return empty results for empty query', async () => {
      const result = await service.search('user-123', '', ['subject', 'sender']);
      expect(result.total).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should find exact matches in subject', async () => {
      const result = await service.search('user-123', 'Marketing', [
        'subject',
        'sender',
      ]);
      expect(result.total).toBeGreaterThan(0);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].matchedFields).toContain('subject');
    });

    it('should support typo tolerance', async () => {
      // "Markting" (missing 'e') should still match "Marketing"
      const result = await service.search('user-123', 'Markting', [
        'subject',
        'sender',
      ]);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should support partial matches in sender', async () => {
      // "Nguy" should match both Nguyễn Văn A and Nguyễn Văn B
      const result = await service.search('user-123', 'Nguy', [
        'subject',
        'sender',
      ]);
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.results.some((r) => r.sender.includes('Nguyễn'))).toBe(true);
    });

    it('should return results sorted by relevance (best matches first)', async () => {
      const result = await service.search('user-123', 'Marketing', [
        'subject',
        'sender',
      ]);
      expect(result.results.length).toBeGreaterThan(0);

      // Scores should be in ascending order (lower score = better match in Fuse)
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i].score).toBeGreaterThanOrEqual(
          result.results[i - 1].score,
        );
      }
    });

    it('should support pagination with limit and offset', async () => {
      const page1 = await service.search('user-123', 'Marketing', [
        'subject',
        'sender',
      ]);
      const page2 = await service.search(
        'user-123',
        'Marketing',
        ['subject', 'sender'],
        10,
        1,
      );

      if (page1.results.length > 1) {
        // If there are multiple results, page 2 starting at offset 1 should have different first result
        expect(page2.results[0]?.id).not.toBe(page1.results[0]?.id);
      }
    });

    it('should include snippet for matched results', async () => {
      const result = await service.search('user-123', 'Invoice', [
        'subject',
        'sender',
      ]);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].snippet).toBeDefined();
    });

    it('should return total count of all matches (not just paginated results)', async () => {
      const result = await service.search('user-123', 'Marketing', [
        'subject',
        'sender',
      ]);
      expect(result.total).toBeGreaterThan(0);
      expect(result.results.length).toBeLessThanOrEqual(result.total);
    });

    it('should return no results for non-matching query', async () => {
      const result = await service.search('user-123', 'xyz123nonexistent', [
        'subject',
        'sender',
      ]);
      expect(result.total).toBe(0);
      expect(result.results).toEqual([]);
    });
  });
});
