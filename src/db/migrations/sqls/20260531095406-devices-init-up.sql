CREATE TYPE connectivity_status AS ENUM ('UNKNOWN', 'ONLINE', 'DEGRADED', 'DOWN');

CREATE TABLE
    devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        protocols TEXT[] NOT NULL DEFAULT '{}',
        protocols_discovered TIMESTAMPTZ,
        connectivity_status connectivity_status NOT NULL DEFAULT 'UNKNOWN',
        diagnostics_status TEXT,
        last_checked_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
        deleted_at TIMESTAMPTZ
    );