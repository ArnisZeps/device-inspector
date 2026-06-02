export type Behavior = 'healthy' | 'flaky' | 'down';
export type Protocol = 'rest' | 'grpc';
export interface DeviceProfile {
  port: number;
  grpcPort?: number;
  name: string;
  protocols: Protocol[];
  behavior: Behavior;
  hwVersion: string;
  swVersion: string;
  fwVersion: string;
  checksum: string;
  failRate?: number;
  maxLatencyMs?: number;
}

export const profiles: DeviceProfile[] = [
  {
    port: 9001,
    name: 'UDM-Pro',
    protocols: ['rest'],
    behavior: 'healthy',
    hwVersion: '2.0',
    swVersion: '4.0',
    fwVersion: '4.0.6',
    checksum: 'a1b2c3d4e5f6',
  },
  {
    port: 9002,
    grpcPort: 9102,
    name: 'USW-Enterprise-48',
    protocols: ['rest', 'grpc'],
    behavior: 'healthy',
    hwVersion: '1.0',
    swVersion: '6.6',
    fwVersion: '6.6.55',
    checksum: 'b2c3d4e5f6a1',
  },
  {
    port: 9003,
    name: 'G4-Pro',
    protocols: ['rest'],
    behavior: 'flaky',
    failRate: 0.4,
    maxLatencyMs: 3000,
    hwVersion: '1.0',
    swVersion: '4.0',
    fwVersion: '4.69.55',
    checksum: 'c3d4e5f6a1b2',
  },
  {
    port: 9004,
    name: 'AC-Pro',
    protocols: ['rest'],
    behavior: 'down',
    hwVersion: '1.0',
    swVersion: '2.2',
    fwVersion: '2.2.17',
    checksum: 'd4e5f6a1b2c3',
  },
];
