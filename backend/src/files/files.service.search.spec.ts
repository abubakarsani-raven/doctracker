jest.mock('../common/sanitize-html', () => ({
  sanitizeRichTextHtml: (html: string) => html,
}));
jest.mock('../object-storage', () => ({
  OBJECT_STORAGE: 'OBJECT_STORAGE',
}));

import { FilesService } from './files.service';

describe('FilesService.searchFiles', () => {
  function buildService(filterIds: string[]) {
    const prisma: any = {
      file: {
        findMany: jest.fn(),
      },
    };
    const permissionsService: any = {
      filterReadable: jest.fn(async (_userId: string, _type: string, rows: Array<{ id: string }>) =>
        rows.filter((row) => filterIds.includes(row.id)),
      ),
    };
    const service = new FilesService(
      prisma,
      {} as any,
      permissionsService,
      {} as any,
    );
    return { service, prisma, permissionsService };
  }

  it('does not search Restricted HTML for Staff and counts only readable files', async () => {
    const { service, prisma } = buildService(['open']);
    prisma.file.findMany
      .mockResolvedValueOnce([{ id: 'secret' }, { id: 'open' }])
      .mockResolvedValueOnce([{ id: 'open', fileName: 'open.pdf' }]);

    const result = await service.searchFiles(
      'company-a',
      { id: 'staff', permissions: { dataScope: 'own' } },
      'confidential-phrase',
      0,
      50,
    );

    const firstWhere = prisma.file.findMany.mock.calls[0][0].where;
    expect(firstWhere.OR).toHaveLength(1);
    expect(firstWhere.OR[0].fileName).toBeDefined();
    expect(result.total).toBe(1);
    expect(result.items.map((item: { id: string }) => item.id)).toEqual(['open']);
  });

  it('searches body text for company-scope users', async () => {
    const { service, prisma } = buildService(['open']);
    prisma.file.findMany
      .mockResolvedValueOnce([{ id: 'open' }])
      .mockResolvedValueOnce([{ id: 'open', fileName: 'open.pdf' }]);

    await service.searchFiles(
      'company-a',
      { id: 'admin', permissions: { dataScope: 'company' } },
      'phrase',
      0,
      50,
    );

    const firstWhere = prisma.file.findMany.mock.calls[0][0].where;
    expect(firstWhere.OR).toHaveLength(2);
    expect(firstWhere.OR[1].richTextDoc.htmlContent).toBeDefined();
  });
});
