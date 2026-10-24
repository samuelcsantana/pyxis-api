import { DATA_CENTER_NETWORKS, dataCenterNetworkOf } from './data-center-networks';

describe('dataCenterNetworkOf', () => {
  it.each(DATA_CENTER_NETWORKS.map((network) => [network.operator, network] as const))(
    'names %s from its network number',
    (_operator, network) => {
      expect(dataCenterNetworkOf(String(network.asn))).toEqual(network);
    },
  );

  it('reads a number with spaces around it', () => {
    expect(dataCenterNetworkOf(' 16509 ')).toEqual({ asn: 16509, operator: 'Amazon' });
  });

  it.each([
    ['a Brazilian carrier', '28573'],
    ['another Brazilian carrier', '26599'],
    ['a home broadband provider', '7922'],
    ['the network of a privacy relay', '13335'],
    ['another network of a privacy relay', '36183'],
    ['a third network of a privacy relay', '54113'],
  ])('lets %s through', (_label, asn) => {
    expect(dataCenterNetworkOf(asn)).toBeNull();
  });

  it.each([undefined, '', '   ', 'AS16509', '16509.5', '-16509', '1'.repeat(11)])(
    'reads nothing from %p',
    (asn) => {
      expect(dataCenterNetworkOf(asn)).toBeNull();
    },
  );
});
