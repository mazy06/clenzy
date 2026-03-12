-- Fix unique constraint on document_number_sequences to include organization_id.
-- Without organization_id, multi-tenant isolation is broken and duplicate key
-- errors occur when different organizations generate the same document type/year.

-- 1. Fix existing rows with NULL organization_id (set to org 2 = only existing org)
UPDATE document_number_sequences
   SET organization_id = 2
 WHERE organization_id IS NULL;

-- 2. Make organization_id NOT NULL going forward
ALTER TABLE document_number_sequences
    ALTER COLUMN organization_id SET NOT NULL;

-- 3. Drop the old constraint (document_type, year) only
ALTER TABLE document_number_sequences
    DROP CONSTRAINT IF EXISTS uk5eedratyojkoux9vy3jiyxfqf;

-- Also drop by column definition in case Hibernate generated a different name
ALTER TABLE document_number_sequences
    DROP CONSTRAINT IF EXISTS uk_doc_num_seq_type_year;

-- 4. Create the correct constraint including organization_id
ALTER TABLE document_number_sequences
    ADD CONSTRAINT uk_doc_num_seq_type_year_org
        UNIQUE (document_type, year, organization_id);
