-- Baitly : les règles documentaires explicites restent obligatoires, même à distance.
CREATE OR REPLACE FUNCTION baitly_provider_document_eligible(pid BIGINT, country_code TEXT, scope_code TEXT, on_date DATE)
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
     AND (scope_code='*' OR EXISTS (SELECT 1 FROM marketplace_service_items item
         WHERE scope_code='ITEM:'||item.code AND item.execution_mode='REMOTE') OR EXISTS (SELECT 1 FROM provider_documents d WHERE d.id=ANY(string_to_array(v.document_ids,',')::bigint[])
         AND d.document_type='LIABILITY_INSURANCE'))
     AND (NOT (v.regulated OR coalesce(r.regulated,false)) OR v.license_document_id=ANY(string_to_array(v.document_ids,',')::bigint[]))
     AND NOT EXISTS (SELECT 1 FROM unnest(string_to_array(coalesce(r.required_types,''),',')) required(type)
       WHERE required.type<>'' AND NOT EXISTS(SELECT 1 FROM provider_documents d
           WHERE d.id=ANY(string_to_array(v.document_ids,',')::bigint[]) AND d.document_type=required.type))
 )
$body$;
