-- Add 'COMPLETED' status to table_reservations and table_waitlist
ALTER TABLE table_reservations DROP CONSTRAINT IF EXISTS table_reservations_status_check;
ALTER TABLE table_reservations ADD CONSTRAINT table_reservations_status_check
  CHECK (status IN ('PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'));

ALTER TABLE table_waitlist DROP CONSTRAINT IF EXISTS table_waitlist_status_check;
ALTER TABLE table_waitlist ADD CONSTRAINT table_waitlist_status_check
  CHECK (status IN ('WAITING', 'NOTIFIED', 'SEATED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'));
