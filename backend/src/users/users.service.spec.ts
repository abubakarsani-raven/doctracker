import { UsersService, normaliseEmail } from './users.service';

/**
 * Email casing. Postgres compares text case-sensitively, so a `@unique` email
 * column treats "Aisha@Example.com" and "aisha@example.com" as two people —
 * which locked a seeded admin out of their own account. These pin both halves
 * of the fix: lookups ignore case, and writes store a canonical form.
 */

function buildService(rows: Array<{ id: string; email: string }>) {
  const prisma: any = {
    user: {
      // Mirrors Prisma's `mode: 'insensitive'` well enough to assert intent.
      findFirst: async ({ where }: any) => {
        const wanted = where?.email?.equals;
        const insensitive = where?.email?.mode === 'insensitive';
        return (
          rows.find((r) =>
            insensitive
              ? r.email.toLowerCase() === String(wanted).toLowerCase()
              : r.email === wanted,
          ) ?? null
        );
      },
      create: jest.fn(async ({ data }: any) => ({ id: 'new', ...data })),
    },
  };

  return { service: new UsersService(prisma), prisma };
}

describe('normaliseEmail', () => {
  it('lowercases and trims', () => {
    expect(normaliseEmail('  Aisha@Example.COM ')).toBe('aisha@example.com');
  });

  it('tolerates empty input rather than throwing', () => {
    expect(normaliseEmail('')).toBe('');
    expect(normaliseEmail(undefined as unknown as string)).toBe('');
  });
});

describe('UsersService email lookup', () => {
  const rows = [{ id: 'u1', email: 'aisha@example.com' }];

  it.each([
    'aisha@example.com',
    'Aisha@Example.com',
    'AISHA@EXAMPLE.COM',
    '  aisha@example.com  ',
  ])('finds the account when signing in as %p', async (typed) => {
    const { service } = buildService(rows);
    const user = await service.findByEmailForAuth(typed);
    expect(user?.id).toBe('u1');
  });

  it('still returns null for a genuinely unknown address', async () => {
    const { service } = buildService(rows);
    expect(await service.findByEmailForAuth('someone@else.com')).toBeNull();
  });

  it('returns null for an empty email instead of matching the first row', async () => {
    const { service } = buildService(rows);
    expect(await service.findByEmailForAuth('   ')).toBeNull();
  });

  /**
   * Rows written before emails were normalised are stored however the creator
   * typed them. Lowercasing the input is not enough to reach those — the query
   * itself has to be case-insensitive. This is the case that actually locked
   * the seeded admin out.
   */
  it('finds an account stored with mixed case', async () => {
    const { service } = buildService([
      { id: 'legacy', email: 'Aisha@Example.COM' },
    ]);

    const user = await service.findByEmailForAuth('aisha@example.com');
    expect(user?.id).toBe('legacy');
  });
});

describe('UsersService email writes', () => {
  it('stores a canonical lowercase address', async () => {
    const { service, prisma } = buildService([]);

    await service.create({
      email: '  NewUser@Example.COM ',
      password: 'pw',
      name: 'New User',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'newuser@example.com' }),
      }),
    );
  });
});
