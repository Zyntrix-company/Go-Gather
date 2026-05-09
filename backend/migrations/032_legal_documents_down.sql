ALTER TABLE users DROP COLUMN IF EXISTS privacy_policy_ack_version;
ALTER TABLE users DROP COLUMN IF EXISTS terms_ack_version;
ALTER TABLE users DROP COLUMN IF EXISTS privacy_policy_ack_at;
ALTER TABLE users DROP COLUMN IF EXISTS terms_ack_at;

DROP TABLE IF EXISTS legal_notification_jobs;
DROP TABLE IF EXISTS legal_document_versions;
