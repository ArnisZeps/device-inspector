import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { ProbeResult } from '../services/probe.service';

const PROTO_PATH = path.resolve(__dirname, '../../proto/device.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const grpcObject = grpc.loadPackageDefinition(packageDef) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DeviceDiagnostics: grpc.ServiceClientConstructor = grpcObject.device.DeviceDiagnostics;

interface GrpcDiagnosticsResponse {
  hw_version: string;
  sw_version: string;
  fw_version: string;
  status: string;
  checksum: string;
}

const MAX_PROBE_ATTEMPTS = 3;
const PROBE_TIMEOUT_MS = 15000;

export async function probeGrpc(deviceName: string, grpcAddress: string, deviceId: string): Promise<ProbeResult> {
  let lastError = '';
  const start = Date.now();

  for (let attempt = 1; attempt <= MAX_PROBE_ATTEMPTS; attempt++) {
    const client = new DeviceDiagnostics(grpcAddress, grpc.credentials.createInsecure());
    const deadline = new Date(Date.now() + PROBE_TIMEOUT_MS);

    try {
      const diag = await new Promise<GrpcDiagnosticsResponse>((resolve, reject) => {
        client.getDiagnostics({ device_id: deviceId }, { deadline }, (err: grpc.ServiceError | null, response: GrpcDiagnosticsResponse) => {
          client.close();
          if (err) reject(err);
          else resolve(response);
        });
      });

      return {
        reachable: true,
        diagnostics_status: diag.status,
        durationMs: Date.now() - start,
        attempts: attempt,
        adapter_used: 'grpc',
        device_checksum: diag.checksum,
        computed_checksum: null,
        hw_version: diag.hw_version,
        sw_version: diag.sw_version,
        fw_version: diag.fw_version,
        raw_response: diag,
      };
    } catch (err) {
      client.close();
      const grpcErr = err as grpc.ServiceError;
      const isTransportError = grpcErr.code === grpc.status.UNAVAILABLE || grpcErr.code === grpc.status.DEADLINE_EXCEEDED;

      if (!isTransportError) {
        return {
          reachable: true,
          diagnostics_status: 'ERROR',
          durationMs: Date.now() - start,
          attempts: attempt,
          adapter_used: 'grpc',
          device_checksum: '',
          computed_checksum: null,
          error: grpcErr.message,
        };
      }

      lastError = grpcErr.message ?? String(err);
      console.log(`${deviceName} gRPC probe attempt ${attempt}/${MAX_PROBE_ATTEMPTS} failed: ${lastError}`);
    }
  }

  return {
    reachable: false,
    diagnostics_status: null,
    durationMs: Date.now() - start,
    attempts: MAX_PROBE_ATTEMPTS,
    adapter_used: 'grpc',
    device_checksum: '',
    computed_checksum: null,
    error: lastError,
  };
}
