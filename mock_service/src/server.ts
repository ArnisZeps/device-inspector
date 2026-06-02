import express, { Request, Response } from 'express';
import { profiles, DeviceProfile } from './profiles';
import { startGrpcServer } from './grpcServer';

function diagnosticsBody(profile: DeviceProfile) {
  return {
    hw_version: profile.hwVersion,
    sw_version: profile.swVersion,
    fw_version: profile.fwVersion,
    status: 'ok',
    checksum: profile.checksum,
  };
}

function createApp(profile: DeviceProfile): express.Express {
  const app = express();

  app.get('/health', (_req: Request, res: Response) => {
    console.log(`[${profile.name}] /health -> 200`);
    res.json({
      name: profile.name,
      protocols: profile.protocols,
      endpoints: { diagnostics: '/diagnostics' },
      ...(profile.grpcPort !== undefined && { grpc_port: profile.grpcPort }),
    });
  });

  app.get('/diagnostics', (_req: Request, res: Response) => {
    if (profile.behavior === 'healthy') {
      console.log(`[${profile.name}] /diagnostics -> 200`);
      res.json(diagnosticsBody(profile));
      return;
    }

    if (profile.behavior === 'down') {
      if (Math.random() < 0.2) {
        console.log(`[${profile.name}] /diagnostics -> HANG`);
        return;
      }
      console.log(`[${profile.name}] /diagnostics -> 500`);
      res.status(500).json({ error: 'service unavailable' });
      return;
    }

    if (profile.behavior === 'flaky') {
      const shouldFail = Math.random() < (profile.failRate ?? 0.4);
      if (!shouldFail) {
        console.log(`[${profile.name}] /diagnostics -> 200`);
        res.json(diagnosticsBody(profile));
        return;
      }
      const mode = Math.floor(Math.random() * 3);
      if (mode === 0) {
        console.log(`[${profile.name}] /diagnostics -> 500 (flaky)`);
        res.status(500).json({ error: 'service unavailable' });
      } else if (mode === 1) {
        const delay = Math.floor(Math.random() * (profile.maxLatencyMs ?? 3000)) + 1;
        console.log(`[${profile.name}] /diagnostics -> DELAY(${delay}ms)`);
        setTimeout(() => res.json(diagnosticsBody(profile)), delay);
      } else {
        console.log(`[${profile.name}] /diagnostics -> DROP`);
        res.socket?.destroy();
      }
    }
  });

  return app;
}

for (const profile of profiles) {
  const app = createApp(profile);
  app.listen(profile.port, () => {
    console.log(`[${profile.name}] REST started on port ${profile.port} (${profile.behavior})`);
  });

  if (profile.grpcPort !== undefined) {
    startGrpcServer(profile);
  }
}
