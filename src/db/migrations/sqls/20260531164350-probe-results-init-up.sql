CREATE TABLE
    device_probes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        device_id UUID NOT NULL REFERENCES devices (id),
        probed_at TIMESTAMPTZ NOT NULL DEFAULT now (),
        reachable BOOLEAN NOT NULL,
        status TEXT,
        adapter_used TEXT,
        hw_version TEXT,
        sw_version TEXT,
        fw_version TEXT,
        device_checksum TEXT,
        computed_checksum TEXT,
        checksum_valid BOOLEAN,
        latency_ms INT,
        attempts INT NOT NULL DEFAULT 1,
        error TEXT,
        raw_response JSONB
    );