CREATE TABLE baitly_commerce_evidence (
 id BIGSERIAL PRIMARY KEY, organization_id BIGINT NOT NULL, source VARCHAR(24) NOT NULL CHECK(source IN ('UPSELL','AFFILIATE')),
 source_id BIGINT NOT NULL, request_id UUID NOT NULL, kind VARCHAR(24) NOT NULL,
 financial_reference VARCHAR(255) NOT NULL, document_number VARCHAR(100) NOT NULL,
 issuer VARCHAR(200) NOT NULL, issuer_reference VARCHAR(255) NOT NULL,
 amount NUMERIC(12,2) NOT NULL CHECK(amount>=0), currency VARCHAR(3) NOT NULL,
 sha256 VARCHAR(64) NOT NULL, mime VARCHAR(40) NOT NULL, content BYTEA NOT NULL CHECK(octet_length(content)<=5242880),
 actor VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(organization_id,request_id),UNIQUE(organization_id,source,source_id,kind,financial_reference)
);
CREATE FUNCTION baitly_keep_commerce_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Baitly commercial evidence is immutable' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER baitly_commerce_evidence_immutable BEFORE UPDATE OR DELETE ON baitly_commerce_evidence
 FOR EACH ROW EXECUTE FUNCTION baitly_keep_commerce_evidence();
ALTER TABLE baitly_commerce_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE baitly_commerce_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON baitly_commerce_evidence
 USING(current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint)
 WITH CHECK(current_setting('app.bypass_rls',true)='on' OR organization_id=NULLIF(current_setting('app.current_org',true),'')::bigint);
