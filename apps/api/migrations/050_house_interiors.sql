-- Independent identities deliberately have no foreign keys into the main database:
-- this exact schema also runs on the dedicated Tiger service.
CREATE TABLE IF NOT EXISTS house_rooms (
 house_id uuid PRIMARY KEY, seq bigint NOT NULL DEFAULT 0,
 editors uuid[] NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS house_items (
 house_id uuid NOT NULL REFERENCES house_rooms(house_id), item_id text NOT NULL,
 kind text NOT NULL, x double precision NOT NULL, z double precision NOT NULL,
 rot double precision NOT NULL DEFAULT 0, stashed boolean NOT NULL DEFAULT false,
 seq bigint NOT NULL DEFAULT 0, PRIMARY KEY(house_id,item_id)
);
CREATE TABLE IF NOT EXISTS house_item_moves (
 time timestamptz NOT NULL DEFAULT clock_timestamp(), house_id uuid NOT NULL,
 item_id text NOT NULL, user_id uuid NOT NULL, x double precision NOT NULL,
 z double precision NOT NULL, rot double precision NOT NULL, action text NOT NULL,
 seq bigint NOT NULL, before_state jsonb, after_state jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS house_moves_recent ON house_item_moves(house_id,time DESC);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='timescaledb') THEN
  PERFORM create_hypertable('house_item_moves','time',if_not_exists=>true,migrate_data=>true);
  ALTER TABLE house_item_moves SET (timescaledb.compress, timescaledb.compress_segmentby='house_id');
  PERFORM add_compression_policy('house_item_moves',INTERVAL '7 days',if_not_exists=>true);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS house_furniture_inventory (
 house_id uuid NOT NULL, kind text NOT NULL, PRIMARY KEY(house_id,kind)
);
