import { isPublicAddress } from './public-address';

describe('isPublicAddress', () => {
  it.each([
    '93.184.215.14',
    '8.8.8.8',
    '172.32.0.1',
    '100.128.0.1',
    '2606:4700:4700::1111',
    '::ffff:93.184.215.14',
  ])('lets %s through', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ['the unspecified IPv4 address', '0.0.0.0'],
    ['a private 10/8 address', '10.1.2.3'],
    ['a carrier-grade NAT address', '100.64.0.1'],
    ['loopback', '127.0.0.1'],
    ['the link-local range, cloud metadata included', '169.254.169.254'],
    ['a private 172.16/12 address', '172.31.255.255'],
    ['a private 192.168/16 address', '192.168.0.10'],
    ['a documentation address', '203.0.113.7'],
    ['a benchmarking address', '198.18.0.1'],
    ['multicast', '239.255.255.250'],
    ['a reserved address', '250.1.1.1'],
    ['the IPv6 loopback', '::1'],
    ['the IPv6 unspecified address', '::'],
    ['a unique-local IPv6 address', 'fd12:3456:789a::1'],
    ['a link-local IPv6 address', 'fe80::1'],
    ['IPv6 multicast', 'ff02::1'],
    ['an IPv6 documentation address', '2001:db8::1'],
    ['a mapped private IPv4 address', '::ffff:10.0.0.1'],
    ['a mapped loopback address', '::FFFF:127.0.0.1'],
    ['a name instead of an address', 'localhost'],
    ['nothing', ''],
  ])('refuses %s', (_, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
