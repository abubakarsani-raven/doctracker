import { resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  it('prefers the leftmost Express req.ips entry (trusted X-Forwarded-For)', () => {
    expect(
      resolveClientIp({
        ips: ['203.0.113.10', '10.0.0.1'],
        ip: '10.0.0.1',
      }),
    ).toBe('203.0.113.10');
  });

  it('falls back to req.ip when ips is empty', () => {
    expect(resolveClientIp({ ips: [], ip: '198.51.100.5' })).toBe(
      '198.51.100.5',
    );
  });

  it('parses X-Forwarded-For when trust proxy did not populate ips', () => {
    expect(
      resolveClientIp({
        headers: { 'x-forwarded-for': '203.0.113.44, 10.0.0.2' },
      }),
    ).toBe('203.0.113.44');
  });

  it('returns unknown when nothing is available', () => {
    expect(resolveClientIp({ headers: {} })).toBe('unknown');
  });
});
