-- Refund exactly once, including failures reported while the browser is closed.
CREATE OR REPLACE FUNCTION refund_failed_photo_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='failed' THEN
  UPDATE photo_item_tokens SET consumed_at=NULL,spent_job=NULL WHERE spent_job=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER refund_failed_photo_item AFTER UPDATE OF status ON avatar_jobs
 FOR EACH ROW EXECUTE FUNCTION refund_failed_photo_item();
UPDATE photo_item_tokens SET consumed_at=NULL,spent_job=NULL
 WHERE spent_job IN (SELECT id FROM avatar_jobs WHERE status='failed');
CREATE SEQUENCE IF NOT EXISTS demo_guest_number;
