-- Store template file content in database (BYTEA) instead of filesystem
ALTER TABLE document_templates ADD COLUMN file_content BYTEA;

-- Make file_path nullable (new templates won't have a file_path)
ALTER TABLE document_templates ALTER COLUMN file_path DROP NOT NULL;
