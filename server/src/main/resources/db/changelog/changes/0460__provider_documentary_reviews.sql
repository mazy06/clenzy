-- Baitly : preuve documentaire canonique et revue contextualisée, sans présumer de droit national.
-- Tables vérifiées dans les entités : marketplace_providers et provider_documents.
ALTER TABLE marketplace_providers ADD COLUMN professional_status VARCHAR(30);
CREATE TABLE provider_documentary_rules (
    country VARCHAR(2) NOT NULL,
    professional_status VARCHAR(30) NOT NULL,
    service_scope VARCHAR(140) NOT NULL,
    required_types VARCHAR(500) NOT NULL DEFAULT '',
    regulated BOOLEAN NOT NULL DEFAULT false,
    version BIGINT NOT NULL DEFAULT 1,
    reason VARCHAR(1000) NOT NULL,
    actor VARCHAR(120) NOT NULL,
    PRIMARY KEY(country,professional_status,service_scope)
);
CREATE TABLE provider_documentary_reviews (
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES marketplace_providers(id) ON DELETE CASCADE,
    country VARCHAR(2) NOT NULL,
    professional_status VARCHAR(30) NOT NULL,
    service_scope VARCHAR(140) NOT NULL,
    rule_version BIGINT NOT NULL,
    document_ids VARCHAR(1000) NOT NULL,
    regulated BOOLEAN NOT NULL,
    license_document_id BIGINT REFERENCES provider_documents(id) ON DELETE SET NULL,
    valid_until DATE NOT NULL,
    note VARCHAR(1000) NOT NULL,
    actor VARCHAR(120) NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_provider_documentary_scope ON provider_documentary_reviews(provider_id,country,service_scope,id DESC);

CREATE FUNCTION baitly_provider_document_eligible(pid BIGINT, country_code TEXT, scope_code TEXT, on_date DATE)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $body$
 SELECT EXISTS (
   SELECT 1 FROM marketplace_providers p
   JOIN LATERAL (SELECT * FROM provider_documentary_reviews v WHERE v.provider_id=p.id
       AND v.country=upper(country_code) AND v.service_scope=scope_code ORDER BY v.id DESC LIMIT 1) v ON true
   LEFT JOIN provider_documentary_rules r ON r.country=v.country AND r.professional_status=p.professional_status AND r.service_scope=v.service_scope
   WHERE p.id=pid AND p.email_confirmed_at IS NOT NULL AND v.professional_status=p.professional_status
     AND v.revoked_at IS NULL AND v.valid_until>=on_date AND v.rule_version=coalesce(r.version,0)
     AND NOT EXISTS (
       SELECT 1 FROM unnest(string_to_array(v.document_ids,',')::bigint[]) selected(id)
       LEFT JOIN provider_documents d ON d.id=selected.id
       WHERE d.id IS NULL OR d.status<>'APPROVED' OR (d.expires_at IS NOT NULL AND d.expires_at<on_date)
          OR (((p.user_id IS NOT NULL AND d.user_id=p.user_id) OR d.marketplace_provider_id=p.id) IS NOT TRUE)
     )
     AND EXISTS (SELECT 1 FROM provider_documents d WHERE d.id=ANY(string_to_array(v.document_ids,',')::bigint[])
         AND d.document_type IN ('COMPANY_REGISTRATION','OTHER'))
     AND (scope_code='*' OR EXISTS (SELECT 1 FROM provider_documents d WHERE d.id=ANY(string_to_array(v.document_ids,',')::bigint[])
         AND d.document_type='LIABILITY_INSURANCE'))
     AND (NOT (v.regulated OR coalesce(r.regulated,false)) OR v.license_document_id=ANY(string_to_array(v.document_ids,',')::bigint[]))
     AND NOT EXISTS (SELECT 1 FROM unnest(string_to_array(coalesce(r.required_types,''),',')) required(type)
       WHERE required.type<>'' AND NOT EXISTS(SELECT 1 FROM provider_documents d
           WHERE d.id=ANY(string_to_array(v.document_ids,',')::bigint[]) AND d.document_type=required.type))
 )
$body$;
