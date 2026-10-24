export interface DataCenterNetwork {
  readonly asn: number;
  readonly operator: string;
}

export const DATA_CENTER_NETWORKS: readonly DataCenterNetwork[] = [
  { asn: 16509, operator: 'Amazon' },
  { asn: 14618, operator: 'Amazon' },
  { asn: 15169, operator: 'Google' },
  { asn: 396982, operator: 'Google Cloud' },
  { asn: 8075, operator: 'Microsoft' },
  { asn: 31898, operator: 'Oracle Cloud' },
  { asn: 14061, operator: 'DigitalOcean' },
  { asn: 16276, operator: 'OVH' },
  { asn: 24940, operator: 'Hetzner' },
  { asn: 63949, operator: 'Akamai Connected Cloud (Linode)' },
  { asn: 20473, operator: 'Vultr' },
  { asn: 12876, operator: 'Scaleway' },
  { asn: 45102, operator: 'Alibaba Cloud' },
  { asn: 132203, operator: 'Tencent Cloud' },
  { asn: 51167, operator: 'Contabo' },
];

const ASN_PATTERN = /^\d{1,10}$/;

export function dataCenterNetworkOf(viewerAsn: string | undefined): DataCenterNetwork | null {
  const text = viewerAsn?.trim() ?? '';
  if (!ASN_PATTERN.test(text)) {
    return null;
  }
  const asn = Number(text);
  return DATA_CENTER_NETWORKS.find((network) => network.asn === asn) ?? null;
}
