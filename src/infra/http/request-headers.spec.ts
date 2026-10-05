import type { FastifyRequest } from 'fastify';
import {
  CLOUDFRONT_VIEWER_ADDRESS_HEADER,
  describeClientIpSources,
  getClientIp,
  singleHeader,
} from './request-headers';

function request(headers: Record<string, string | string[]>): FastifyRequest {
  return { headers, ip: '10.0.0.9' } as unknown as FastifyRequest;
}

describe('singleHeader', () => {
  it('reads a header sent once', () => {
    expect(singleHeader(request({ origin: 'https://shop.example.com' }), 'origin')).toBe(
      'https://shop.example.com',
    );
  });

  it.each([
    ['missing', {}],
    ['repeated', { origin: ['https://a.example.com', 'https://b.example.com'] }],
  ])('ignores a header that is %s', (_, headers) => {
    expect(singleHeader(request(headers), 'origin')).toBeUndefined();
  });
});

describe('getClientIp', () => {
  it('uses the socket address when no header is trusted, whatever X-Forwarded-For says', () => {
    expect(getClientIp(request({ 'x-forwarded-for': '203.0.113.7' }), undefined)).toBe('10.0.0.9');
  });

  it.each([
    ['an IPv4 address with its port', '198.51.100.10:46532', '198.51.100.10'],
    ['an IPv6 address with its port', '2001:db8::1:46532', '2001:db8::1'],
    ['an IPv4 address without a port', '198.51.100.10', '198.51.100.10'],
  ])('reads %s from CloudFront-Viewer-Address', (_, value, expected) => {
    expect(
      getClientIp(
        request({ [CLOUDFRONT_VIEWER_ADDRESS_HEADER]: value }),
        CLOUDFRONT_VIEWER_ADDRESS_HEADER,
      ),
    ).toBe(expected);
  });

  it('reads a bare address from another trusted header', () => {
    expect(getClientIp(request({ 'x-real-ip': ' 203.0.113.7 ' }), 'x-real-ip')).toBe('203.0.113.7');
  });

  it.each([
    ['missing', {}],
    ['not an address', { 'x-real-ip': 'forged' }],
    ['an address with a port where none is expected', { 'x-real-ip': '203.0.113.7:80' }],
  ])('falls back to the socket address when the trusted header is %s', (_, headers) => {
    expect(getClientIp(request(headers), 'x-real-ip')).toBe('10.0.0.9');
  });
});

describe('describeClientIpSources', () => {
  it('reports which address sources a request carried, never the addresses', () => {
    expect(
      describeClientIpSources(
        request({
          [CLOUDFRONT_VIEWER_ADDRESS_HEADER]: '198.51.100.10:46532',
          'x-forwarded-for': '203.0.113.7, 130.176.0.1',
        }),
        CLOUDFRONT_VIEWER_ADDRESS_HEADER,
      ),
    ).toEqual({
      trustedHeader: CLOUDFRONT_VIEWER_ADDRESS_HEADER,
      cloudfrontViewerAddress: true,
      xForwardedForHops: 2,
      resolvedFrom: 'header',
    });
  });

  it('reports the socket fallback when no header is trusted or present', () => {
    expect(describeClientIpSources(request({}), undefined)).toEqual({
      trustedHeader: null,
      cloudfrontViewerAddress: false,
      xForwardedForHops: 0,
      resolvedFrom: 'socket',
    });
    expect(describeClientIpSources(request({}), 'x-real-ip').resolvedFrom).toBe('socket');
  });
});
