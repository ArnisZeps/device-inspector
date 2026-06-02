import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { DeviceProfile } from './profiles';

const PROTO_PATH = path.join(__dirname, 'device.proto');

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
const DeviceDiagnosticsService = grpcObject.device.DeviceDiagnostics.service as grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;

function diagnosticsBody(profile: DeviceProfile) {
  return {
    hw_version: profile.hwVersion,
    sw_version: profile.swVersion,
    fw_version: profile.fwVersion,
    status: 'ok',
    checksum: profile.checksum,
  };
}

function makeDiagnosticsHandler(profile: DeviceProfile): grpc.handleUnaryCall<unknown, unknown> {
  return (_call, callback) => {
    if (profile.behavior === 'healthy') {
      console.log(`[${profile.name}] gRPC GetDiagnostics -> OK`);
      callback(null, diagnosticsBody(profile));
      return;
    }

    if (profile.behavior === 'down') {
      if (Math.random() < 0.2) {
        console.log(`[${profile.name}] gRPC GetDiagnostics -> HANG`);
        return;
      }
      console.log(`[${profile.name}] gRPC GetDiagnostics -> UNAVAILABLE`);
      callback({ code: grpc.status.UNAVAILABLE, message: 'service unavailable' } as grpc.ServiceError);
      return;
    }

    if (profile.behavior === 'flaky') {
      const shouldFail = Math.random() < (profile.failRate ?? 0.4);
      if (!shouldFail) {
        console.log(`[${profile.name}] gRPC GetDiagnostics -> OK`);
        callback(null, diagnosticsBody(profile));
        return;
      }
      const mode = Math.floor(Math.random() * 3);
      if (mode === 0) {
        console.log(`[${profile.name}] gRPC GetDiagnostics -> INTERNAL (flaky)`);
        callback({ code: grpc.status.INTERNAL, message: 'internal error' } as grpc.ServiceError);
      } else if (mode === 1) {
        const delay = Math.floor(Math.random() * (profile.maxLatencyMs ?? 3000)) + 1;
        console.log(`[${profile.name}] gRPC GetDiagnostics -> DELAY(${delay}ms)`);
        setTimeout(() => callback(null, diagnosticsBody(profile)), delay);
      } else {
        console.log(`[${profile.name}] gRPC GetDiagnostics -> HANG (flaky)`);
      }
    }
  };
}

export function startGrpcServer(profile: DeviceProfile): void {
  if (!profile.grpcPort) return;

  const server = new grpc.Server();
  server.addService(DeviceDiagnosticsService, {
    getDiagnostics: makeDiagnosticsHandler(profile),
  });

  server.bindAsync(
    `0.0.0.0:${profile.grpcPort}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error(`[${profile.name}] gRPC server failed: ${err.message}`);
        return;
      }
      console.log(`[${profile.name}] gRPC server started on port ${port} (${profile.behavior})`);
    },
  );
}
