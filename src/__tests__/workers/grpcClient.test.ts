import { probeGrpc } from '../../workers/grpcClient';

jest.mock('@grpc/proto-loader', () => ({
  loadSync: jest.fn().mockReturnValue({}),
}));

jest.mock('@grpc/grpc-js', () => {
  const getDiagnostics = jest.fn();
  const close = jest.fn();
  const clientConstructor = jest.fn(() => ({ getDiagnostics, close }));

  return {
    __mocks: { getDiagnostics, close, clientConstructor },
    loadPackageDefinition: jest.fn(() => ({ device: { DeviceDiagnostics: clientConstructor } })),
    credentials: { createInsecure: jest.fn(() => ({})) },
    status: { DEADLINE_EXCEEDED: 4, INTERNAL: 13, UNAVAILABLE: 14 },
  };
});

const { getDiagnostics: mockGetDiagnostics, close: mockClose, clientConstructor: mockClientConstructor } =
  (jest.requireMock('@grpc/grpc-js') as { __mocks: { getDiagnostics: jest.Mock; close: jest.Mock; clientConstructor: jest.Mock } }).__mocks;

const diagResponse = {
  hw_version: '1.0',
  sw_version: '2.0',
  fw_version: '3.0',
  status: 'ok',
  checksum: 'abc123',
};

describe('probeGrpc', () => {
  beforeEach(() => {
    mockGetDiagnostics.mockReset();
    mockClose.mockReset();
    mockClientConstructor.mockClear();
  });

  it('returns full diagnostics on success', async () => {
    mockGetDiagnostics.mockImplementation((_req: unknown, _opts: unknown, callback: Function) => {
      callback(null, diagResponse);
    });

    const result = await probeGrpc('Test Device', 'localhost:9102', 'device-1');

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ok');
    expect(result.hw_version).toBe('1.0');
    expect(result.sw_version).toBe('2.0');
    expect(result.fw_version).toBe('3.0');
    expect(result.device_checksum).toBe('abc123');
    expect(result.adapter_used).toBe('grpc');
    expect(result.attempts).toBe(1);
    expect(result.raw_response).toEqual(diagResponse);
    expect(mockClientConstructor).toHaveBeenCalledTimes(1);
  });

  it('returns reachable: true with ERROR status on INTERNAL error without retrying', async () => {
    mockGetDiagnostics.mockImplementation((_req: unknown, _opts: unknown, callback: Function) => {
      callback({ code: 13, message: 'internal server error' });
    });

    const result = await probeGrpc('Test Device', 'localhost:9102', 'device-1');

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ERROR');
    expect(result.error).toBe('internal server error');
    expect(result.adapter_used).toBe('grpc');
    expect(result.attempts).toBe(1);
    expect(mockClientConstructor).toHaveBeenCalledTimes(1);
  });

  it('retries 3 times on UNAVAILABLE and returns reachable: false', async () => {
    mockGetDiagnostics.mockImplementation((_req: unknown, _opts: unknown, callback: Function) => {
      callback({ code: 14, message: 'service unavailable' });
    });

    const result = await probeGrpc('Test Device', 'localhost:9102', 'device-1');

    expect(result.reachable).toBe(false);
    expect(result.diagnostics_status).toBeNull();
    expect(result.error).toBe('service unavailable');
    expect(result.adapter_used).toBe('grpc');
    expect(result.attempts).toBe(3);
    expect(mockClientConstructor).toHaveBeenCalledTimes(3);
  });

  it('retries 3 times on DEADLINE_EXCEEDED and returns reachable: false', async () => {
    mockGetDiagnostics.mockImplementation((_req: unknown, _opts: unknown, callback: Function) => {
      callback({ code: 4, message: 'deadline exceeded' });
    });

    const result = await probeGrpc('Test Device', 'localhost:9102', 'device-1');

    expect(result.reachable).toBe(false);
    expect(result.diagnostics_status).toBeNull();
    expect(result.attempts).toBe(3);
    expect(mockClientConstructor).toHaveBeenCalledTimes(3);
  });

  it('succeeds on retry after UNAVAILABLE', async () => {
    mockGetDiagnostics
      .mockImplementationOnce((_req: unknown, _opts: unknown, callback: Function) => {
        callback({ code: 14, message: 'service unavailable' });
      })
      .mockImplementationOnce((_req: unknown, _opts: unknown, callback: Function) => {
        callback(null, diagResponse);
      });

    const result = await probeGrpc('Test Device', 'localhost:9102', 'device-1');

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ok');
    expect(result.attempts).toBe(2);
    expect(mockClientConstructor).toHaveBeenCalledTimes(2);
  });
});
