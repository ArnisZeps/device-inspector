CREATE TABLE
    devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        protocols TEXT[] NOT NULL DEFAULT '{}',
        protocols_discovered TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'UNKNOWN',
        consecutive_failures INT NOT NULL DEFAULT 0,
        consecutive_successes INT NOT NULL DEFAULT 0,
        last_checked_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
        deleted_at TIMESTAMPTZ
    );