import { probeDevice, checkHealth } from '../../workers/probeWorker';
import { ProbeDevice } from '../../services/probe.service';
import * as probeService from '../../services/probe.service';
import { ConnectivityStatus } from '../../services/devices.service';

jest.mock('../../services/probe.service');
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../db', () => ({ __esModule: true, default: { query: jest.fn() } }));

const mockUpdateDeviceProtocols = probeService.updateDeviceProtocols as jest.Mock;

const device: ProbeDevice = {
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

describe('checkHealth', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns unreachable after all 3 retries fail with network errors', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'));

    const result = await checkHealth(device);

    expect(result.outcome).toBe(ConnectivityStatus.DOWN);
    if (result.outcome === ConnectivityStatus.DOWN) {
      expect(result.error).toBe('Connection refused');
      expect(result.attempts).toBe(3);
    }
    expect(mockUpdateDeviceProtocols).not.toHaveBeenCalled();
  });

  it('returns error when health response status is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(503, 'Service Unavailable'));

    const result = await checkHealth(device);

    expect(result.outcome).toBe(ConnectivityStatus.ERROR);
    if (result.outcome === ConnectivityStatus.ERROR) {
      expect(result.error).toBe('HTTP 503');
      expect(result.attempts).toBe(1);
    }
  });

  it('returns error when health response body is invalid JSON', async () => {
    const response = mockResponse(200, null);
    response.json = jest.fn().mockRejectedValue(new SyntaxError('Parse error'));
    (global.fetch as jest.Mock).mockResolvedValue(response);

    const result = await checkHealth(device);

    expect(result.outcome).toBe(ConnectivityStatus.ERROR);
    if (result.outcome === ConnectivityStatus.ERROR) {
      expect(result.error).toBe('Invalid health response body');
      expect(result.attempts).toBe(1);
    }
  });

  it('returns ok with protocols and updates device on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, { protocols: ['grpc', 'rest'] }));

    const result = await checkHealth(device);

    expect(result.outcome).toBe(ConnectivityStatus.ONLINE);
    if (result.outcome === ConnectivityStatus.ONLINE) {
      expect(result.protocols).toEqual(['grpc', 'rest']);
    }
    expect(mockUpdateDeviceProtocols).toHaveBeenCalledWith('device-1', ['grpc', 'rest']);
  });

  it('returns ok with empty protocols when health response has no protocols field', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(200, {}));

    const result = await checkHealth(device);

    expect(result.outcome).toBe(ConnectivityStatus.ONLINE);
    if (result.outcome === ConnectivityStatus.ONLINE) {
      expect(result.protocols).toEqual([]);
    }
    expect(mockUpdateDeviceProtocols).toHaveBeenCalledWith('device-1', []);
  });
});

describe('probeDevice', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns unreachable when health check fails 3 times with network errors', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'));

    const result = await probeDevice(device);

    expect(result.reachable).toBe(false);
    expect(result.diagnostics_status).toBeNull();
    expect(result.attempts).toBe(3);
    expect(result.error).toBe('Connection refused');
    expect(result.adapter_used).toBe('rest');
    expect(typeof result.durationMs).toBe('number');
  });

  it('returns ERROR when health endpoint returns HTTP error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse(503, 'Service Unavailable'));

    const result = await probeDevice(device);

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ERROR');
    expect(result.error).toBe('HTTP 503');
    expect(result.attempts).toBe(1);
  });

  it('returns ERROR when health endpoint returns invalid JSON', async () => {
    const response = mockResponse(200, null);
    response.json = jest.fn().mockRejectedValue(new SyntaxError('Parse error'));
    (global.fetch as jest.Mock).mockResolvedValue(response);

    const result = await probeDevice(device);

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ERROR');
    expect(result.error).toBe('Invalid health response body');
  });

  it('returns full diagnostics data on successful probe', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200, { protocols: ['rest'] }))
      .mockResolvedValueOnce(mockResponse(200, diagResponse));

    const result = await probeDevice(device);

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('OPERATIONAL');
    expect(result.hw_version).toBe('1.0');
    expect(result.sw_version).toBe('2.0');
    expect(result.fw_version).toBe('3.0');
    expect(result.device_checksum).toBe('abc123');
    expect(result.adapter_used).toBe('rest');
    expect(result.raw_response).toEqual(diagResponse);
  });

  it('uses grpc adapter when health reports grpc protocol', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200, { protocols: ['grpc', 'rest'] }))
      .mockResolvedValueOnce(mockResponse(200, diagResponse));

    const result = await probeDevice(device);

    expect(result.adapter_used).toBe('grpc');
  });

  it('retries diagnostics on network failure and succeeds on second attempt', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200, { protocols: ['rest'] }))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce(mockResponse(200, diagResponse));

    const result = await probeDevice(device);

    expect(result.reachable).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.diagnostics_status).toBe('OPERATIONAL');
  });

  it('returns ERROR when diagnostics response status is not ok', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200, { protocols: ['rest'] }))
      .mockResolvedValueOnce(mockResponse(503, 'Service Unavailable'));

    const result = await probeDevice(device);

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ERROR');
    expect(result.error).toBe('HTTP 503');
    expect(result.attempts).toBe(1);
    expect(result.device_checksum).toBe('');
    expect(result.computed_checksum).toBeNull();
  });

  it('returns ERROR when diagnostics response body is invalid JSON', async () => {
    const diagBadResponse = mockResponse(200, null);
    diagBadResponse.json = jest.fn().mockRejectedValue(new SyntaxError('Unexpected token'));
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(200, { protocols: ['rest'] }))
      .mockResolvedValueOnce(diagBadResponse);

    const result = await probeDevice(device);

    expect(result.reachable).toBe(true);
    expect(result.diagnostics_status).toBe('ERROR');
    expect(result.error).toBe('Invalid response body');
  });
});
