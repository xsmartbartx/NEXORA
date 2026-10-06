-- Proposed, not applied. Run each CREATE INDEX CONCURRENTLY outside a transaction.
create unique index concurrently if not exists api_keys_key_hash_idx on api_keys (key_hash);
create index concurrently if not exists api_keys_org_active_idx on api_keys (org_id) where revoked_at is null;
create index concurrently if not exists audit_events_org_action_created_idx on audit_events (org_id, action, created_at desc);
alter table audit_events add constraint audit_events_outcome_chk check (outcome in ('success','failure','denied')) not valid;
-- verify existing values before validating: select distinct outcome from audit_events;
