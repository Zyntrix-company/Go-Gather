-- Allow 'drive' as a valid OAuth provider in email_oauth_tokens
ALTER TABLE email_oauth_tokens
  DROP CONSTRAINT email_oauth_tokens_provider_check;

ALTER TABLE email_oauth_tokens
  ADD CONSTRAINT email_oauth_tokens_provider_check
  CHECK (provider IN ('gmail', 'outlook', 'drive'));
