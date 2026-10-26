-- Additional dashboard accounts can only receive read-only access.
CREATE TABLE IF NOT EXISTS admin_accounts (
 email text PRIMARY KEY CHECK(email=lower(trim(email))),
 password_hash text NOT NULL CHECK(password_hash LIKE '$2%'),
 role text NOT NULL DEFAULT 'read_only' CHECK(role='read_only'),
 active boolean NOT NULL DEFAULT true,
 credentials_updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
