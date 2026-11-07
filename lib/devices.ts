import type { Device } from './types'

/** Mock inventory. Vendors are labels only; nothing here touches a real network. */
export const DEVICES: Device[] = [
  {
    hostname: 'core-rtr-01', role: 'router', vendor: 'Cisco IOS-XE', site: 'HQ',
    interfaces: ['Gi0/0/0', 'Gi0/0/1', 'Te0/1/0'],
    bgpPeers: [{ ip: '10.0.0.2', remoteAs: 65002 }, { ip: '10.0.0.6', remoteAs: 65003 }],
  },
  {
    hostname: 'edge-rtr-01', role: 'router', vendor: 'Juniper MX', site: 'HQ',
    interfaces: ['ge-0/0/0', 'ge-0/0/1', 'xe-0/1/0'],
    bgpPeers: [{ ip: '203.0.113.1', remoteAs: 64500 }],
  },
  {
    hostname: 'dist-sw-01', role: 'switch', vendor: 'Cisco Catalyst', site: 'HQ',
    interfaces: ['Te1/0/1', 'Te1/0/2', 'Gi1/0/10', 'Gi1/0/11'],
    bgpPeers: [],
  },
  {
    hostname: 'acc-sw-01', role: 'switch', vendor: 'Aruba CX', site: 'Branch-A',
    interfaces: ['1/1/1', '1/1/48'],
    bgpPeers: [],
  },
  {
    hostname: 'acc-sw-02', role: 'switch', vendor: 'Aruba CX', site: 'Branch-B',
    interfaces: ['1/1/1', '1/1/48'],
    bgpPeers: [],
  },
  {
    hostname: 'fw-01', role: 'firewall', vendor: 'Fortinet FortiGate', site: 'HQ',
    interfaces: ['port1', 'port2', 'wan1'],
    bgpPeers: [{ ip: '10.0.0.10', remoteAs: 65010 }],
  },
]

export const findDevice = (hostname: string) => DEVICES.find((d) => d.hostname === hostname)
