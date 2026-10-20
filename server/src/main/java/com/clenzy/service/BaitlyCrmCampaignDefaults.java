package com.clenzy.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import java.io.IOException;
import java.util.List;

/** Organization-owned copies: deploying new defaults never replaces a user's edits. */
final class BaitlyCrmCampaignDefaults {
    record Entry(String key, String name, String contactType, String subject, String body) {}
    static final List<Entry> CATALOG = load();
    private BaitlyCrmCampaignDefaults() {}

    private static List<Entry> load() {
        try (var input = BaitlyCrmCampaignDefaults.class.getResourceAsStream("/crm/baitly-campaign-templates.fr.json")) {
            if (input == null) throw new IllegalStateException("Bibliothèque de modèles Baitly introuvable");
            List<Entry> entries = new ObjectMapper().readValue(input, new TypeReference<List<Entry>>() {});
            for (var entry : entries) BaitlyCrmCampaignText.validate(entry.subject(), entry.body());
            return List.copyOf(entries);
        } catch (IOException invalid) {
            throw new IllegalStateException("Bibliothèque de modèles Baitly invalide", invalid);
        }
    }

    static void ensure(JdbcTemplate db, long organization) {
        for (var entry : CATALOG) {
            db.update("""
                INSERT INTO baitly_crm_campaign_templates(organization_id,default_key,name,contact_type,subject,body)
                VALUES(?,?,?,?,?,?) ON CONFLICT(organization_id,default_key) DO NOTHING
                """, organization, entry.key(), entry.name(), entry.contactType(), entry.subject(), entry.body());
        }
    }
}
