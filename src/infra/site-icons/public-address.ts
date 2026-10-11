import { BlockList, isIP } from 'node:net';

const IPV4 = 4;
const IPV6 = 6;
const MAPPED_IPV4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

const REFUSED_IPV4: readonly (readonly [string, number])[] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const REFUSED_IPV6: readonly (readonly [string, number])[] = [
  ['::', 127],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

const refused = new BlockList();
for (const [network, prefix] of REFUSED_IPV4) {
  refused.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of REFUSED_IPV6) {
  refused.addSubnet(network, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === IPV4) {
    return !refused.check(address, 'ipv4');
  }
  if (version !== IPV6) {
    return false;
  }
  const mapped = MAPPED_IPV4.exec(address)?.[1];
  return mapped === undefined ? !refused.check(address, 'ipv6') : isPublicAddress(mapped);
}
