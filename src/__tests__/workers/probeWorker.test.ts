import { probeDevice, discoverProtocols } from '../../workers/probeWorker';
import { ProbeDevice } from '../../services/probe.service';
import * as probeService from '../../services/probe.service';

jest.mock('../../services/probe.service');
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../db', () => ({ __esModule: true, default: { query: jest.fn() } }));

const mockUpdateDeviceProtocols = probeService.updateDeviceProtocols as jest.Mock;

const freshDevice: ProbeDevice = {
  id: 'device-1',
  name: 'Test Device',
  base_url: 'http://192.168.1.10',
  protocols: ['rest'],
  protocols_discovered: new Date(),
};

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const diagResponse = {
  hw_version: '1.0',
  sw_version: '2.0',
  fw_version: '3.0',
  status: 'OPERATIONAL',
  checksum: 'abc123',
};

describe('probeDevice', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns unreachable after all 3 attempts fail with network errors', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'));

    const result = await probeDevice(freshDevice);

    expect(result.reachable).toBe(false);
    expect(result.diagnostics_status).toBeNull();
    expect(result.attempts).toBe(3);
    expect(result.error).toBe('Connection refused');
    expect(result.adapter_used).toBe('rest');
    expect(typeof result.durationMs).toBe('number');
  });

  it('retries on network failure and succeeds on second attempt', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce(mockResponse(200, diagResponse));

    const result = await probeDevice(freshDevice);

    expect(result.reachable).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.diagnostics_status).toBe('OPERATIONAL');
  });

  it('returns HTTP error result when response status is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(503, 'Service Unavailable'));

    const result = await probeDevice(freshDevice);

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ERROR');
    expect(result.error).toBe('HTTP 503');
    expect(result.attempts).toBe(1);
    expect(result.device_checksum).toBe('');
    expect(result.computed_checksum).toBeNull();
  });

  it('returns parse error result when response body is invalid JSON', async () => {
    const response = mockResponse(200, null);
    response.json = jest.fn().mockRejectedValue(new SyntaxError('Unexpected token'));
    (global.fetch as jest.Mock).mockResolvedValue(response);

    const result = await probeDevice(freshDevice);

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ERROR');
    expect(result.error).toBe('Invalid response body');
  });

  it('returns full diagnostics data on successful probe', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, diagResponse));

    const result = await probeDevice(freshDevice);

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('OPERATIONAL');
    expect(result.hw_version).toBe('1.0');
    expect(result.sw_version).toBe('2.0');
    expect(result.fw_version).toBe('3.0');
    expect(result.device_checksum).toBe('abc123');
    expect(result.adapter_used).toBe('rest');
    expect(result.raw_response).toEqual(diagResponse);
  });

  it('uses grpc adapter when protocols list includes grpc', async () => {
    const grpcDevice: ProbeDevice = { ...freshDevice, protocols: ['grpc', 'rest'] };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, diagResponse));

    const result = await probeDevice(grpcDevice);

    expect(result.adapter_used).toBe('grpc');
  });

  it('discovers protocols and uses them when protocols_discovered is null', async () => {
    const staleDevice: ProbeDevice = { ...freshDevice, protocols: [], protocols_discovered: null };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200, { protocols: ['grpc'] }))
      .mockResolvedValueOnce(mockResponse(200, diagResponse));

    const result = await probeDevice(staleDevice);

    expect(result.adapter_used).toBe('grpc');
  });
});

describe('discoverProtocols', () => {
  const device: ProbeDevice = {
    id: 'device-1',
    name: 'Test Device',
    base_url: 'http://192.168.1.10',
    protocols: ['rest'],
    protocols_discovered: null,
  };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns existing protocols when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await discoverProtocols(device);

    expect(result).toEqual(['rest']);
    expect(mockUpdateDeviceProtocols).not.toHaveBeenCalled();
  });

  it('returns existing protocols when response JSON is invalid', async () => {
    const response = mockResponse(200, null);
    response.json = jest.fn().mockRejectedValue(new SyntaxError('Parse error'));
    (global.fetch as jest.Mock).mockResolvedValue(response);

    const result = await discoverProtocols(device);

    expect(result).toEqual(['rest']);
  });

  it('returns discovered protocols and updates the device on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, { protocols: ['grpc', 'rest'] }));

    const result = await discoverProtocols(device);

    expect(result).toEqual(['grpc', 'rest']);
    expect(mockUpdateDeviceProtocols).toHaveBeenCalledWith('device-1', ['grpc', 'rest']);
  });

  it('returns empty array when health response has no protocols field', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, {}));

    const result = await discoverProtocols(device);

    expect(result).toEqual([]);
    expect(mockUpdateDeviceProtocols).toHaveBeenCalledWith('device-1', []);
  });
});
