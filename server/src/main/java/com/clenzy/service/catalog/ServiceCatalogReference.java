package com.clenzy.service.catalog;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Objects;

/** Résolution de référence uniquement ; aucune capacité ni habilitation n'est déduite d'un ancien type. */
@Service
@Transactional(readOnly = true)
public class ServiceCatalogReference {
    private final JdbcTemplate db;

    public ServiceCatalogReference(JdbcTemplate db) { this.db = db; }

    /** Adaptateur d'entrée historique, y compris pour relire un tarif archivé. */
    public String legacyCode(String type) {
        if (type == null) return null;
        var codes = db.queryForList("SELECT service_item_code FROM service_catalog_legacy_aliases WHERE legacy_type=?",
            String.class, type.toUpperCase(Locale.ROOT));
        return codes.isEmpty() ? null : codes.getFirst();
    }

    /** Projection pour les clients historiques ; elle ne décide jamais d'une capacité. */
    public String legacyType(String code) {
        if (code == null) return "OTHER";
        var types = db.queryForList("SELECT legacy_type FROM service_catalog_legacy_aliases WHERE service_item_code=? ORDER BY legacy_type",
            String.class, code);
        return types.isEmpty() ? "OTHER" : types.getFirst();
    }

    /** Une référence existante inactive reste lisible ; seule une nouvelle sélection exige une entrée active. */
    public String resolve(String explicitCode, String legacyType, String existingCode, String previousType) {
        if (explicitCode != null) {
            String code = explicitCode.trim();
            if (code.isEmpty() || code.length() > 60) throw new IllegalArgumentException("Prestation du catalogue requise");
            if (!Objects.equals(code, existingCode)) requireActive(code);
            boolean unchanged = Objects.equals(code, existingCode)
                    && (legacyType == null || Objects.equals(legacyType, previousType));
            if (!unchanged && legacyType != null && !"OTHER".equalsIgnoreCase(legacyType)) {
                var aliases = db.queryForList("SELECT service_item_code FROM service_catalog_legacy_aliases WHERE legacy_type=?",
                        String.class, legacyType.toUpperCase(Locale.ROOT));
                if (aliases.isEmpty() || !code.equals(aliases.getFirst()))
                    throw new IllegalArgumentException("Le type historique et la prestation sélectionnée sont contradictoires");
            }
            return code;
        }
        // Un formulaire ancien qui renvoie le même type ne peut effacer la spécialité précise.
        if (existingCode != null && (legacyType == null || Objects.equals(legacyType, previousType))) return existingCode;
        if (legacyType == null) return null;
        var codes = db.queryForList("""
                SELECT a.service_item_code FROM service_catalog_legacy_aliases a
                JOIN marketplace_service_items i ON i.code=a.service_item_code
                JOIN marketplace_service_categories c ON c.id=i.category_id
                WHERE a.legacy_type=? AND i.active AND c.active
                """, String.class, legacyType.toUpperCase(Locale.ROOT));
        return codes.isEmpty() ? null : codes.getFirst();
    }

    public record Item(String code, String labelFr, String labelEn, String legacyType, String executionMode,
                       boolean propertyRequired, boolean slotRequired, String domain, String categoryCode, String payer) {}
    public java.util.List<Item> items() {
        return db.query("""
            SELECT i.code,i.label_fr,i.label_en,coalesce(a.legacy_type,'OTHER') legacy_type,
                   i.execution_mode,i.property_required,i.slot_required,c.professional_domain,c.code category_code,i.payer
            FROM marketplace_service_items i JOIN marketplace_service_categories c ON c.id=i.category_id
            LEFT JOIN service_catalog_legacy_aliases a ON a.service_item_code=i.code
            WHERE i.active AND c.active ORDER BY c.sort_order,i.sort_order,i.code
            """, (r,n) -> new Item(r.getString("code"),r.getString("label_fr"),r.getString("label_en"),
                r.getString("legacy_type"),r.getString("execution_mode"),r.getBoolean("property_required"),
                r.getBoolean("slot_required"),r.getString("professional_domain"),r.getString("category_code"),r.getString("payer")));
    }

    public boolean isRemote(String code) {
        return flag(code, "execution_mode='REMOTE'");
    }
    public boolean doesNotReserveSlot(String code) {
        return flag(code, "NOT slot_required");
    }
    public boolean propertyOptional(String code) {
        return flag(code, "NOT property_required");
    }
    private boolean flag(String code, String condition) {
        if (code == null) return false;
        // condition is an internal constant, never a request value.
        return Boolean.TRUE.equals(db.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM marketplace_service_items WHERE code=? AND "+condition+")", Boolean.class, code));
    }
    public void requireLocation(String code, Object property) {
        if (property == null && !propertyOptional(code)) throw new IllegalArgumentException("Logement requis pour cette prestation");
    }

    private void requireActive(String code) {
        Boolean active = db.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM marketplace_service_items i
                  JOIN marketplace_service_categories c ON c.id=i.category_id
                  WHERE i.code=? AND i.active AND c.active)
                """, Boolean.class, code);
        if (!Boolean.TRUE.equals(active)) throw new IllegalArgumentException("Prestation inconnue ou inactive");
    }
}
