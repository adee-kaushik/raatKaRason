-- Run once in the dedicated Neon project's SQL editor.
CREATE TABLE IF NOT EXISTS products (
 id text PRIMARY KEY,
 name text NOT NULL,
 brand text NOT NULL DEFAULT '',
 category text NOT NULL,
 size text NOT NULL,
 price integer NOT NULL CHECK (price >= 0),
 stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
 tag text,
 image text NOT NULL,
 active boolean NOT NULL DEFAULT true
);
