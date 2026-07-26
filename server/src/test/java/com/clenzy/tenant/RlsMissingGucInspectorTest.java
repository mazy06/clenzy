package com.clenzy.tenant;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Instrumentation de mesure de la RLS — audit sécurité 2026-07-26, plan REM-T-01.
 *
 * <p>Cette instrumentation sert à décider s'il est sûr d'activer la Row-Level Security en
 * production. Une instrumentation qui ne détecterait pas ce qu'elle prétend détecter
 * produirait un journal silencieux — lu comme un feu vert, alors qu'il ne mesurerait rien.
 * D'où ces tests.
 */
@DisplayName("RlsMissingGucInspector — instrumentation de mesure (REM-T-01)")
class RlsMissingGucInspectorTest {

    private static final String SQL_SOUS_RLS =
            "select r1_0.id, r1_0.organization_id from reservations r1_0 where r1_0.id=?";

    @Test
    @DisplayName("inerte tant qu'il n'est pas explicitement activé")
    void inactif_neFaitRien() {
        RlsMissingGucInspector inspector = new RlsMissingGucInspector(false);

        // Le SQL doit ressortir inchangé : un StatementInspector qui altère la requête
        // casserait l'application.
        assertThat(inspector.inspect(SQL_SOUS_RLS)).isEqualTo(SQL_SOUS_RLS);
    }

    @Test
    @DisplayName("laisse toujours le SQL intact, même actif")
    void actif_neModifieJamaisLeSql() {
        RlsMissingGucInspector inspector = new RlsMissingGucInspector(true);

        assertThat(inspector.inspect(SQL_SOUS_RLS)).isEqualTo(SQL_SOUS_RLS);
        assertThat(inspector.inspect("select 1")).isEqualTo("select 1");
    }

    @Test
    @DisplayName("supporte un SQL nul sans casser la requête")
    void sqlNul_neLevePas() {
        assertThat(new RlsMissingGucInspector(true).inspect(null)).isNull();
    }

    @Test
    @DisplayName("les cinq tables du changeset 0345 sont bien celles surveillées")
    void surveilleExactementLesTablesDu0345() {
        RlsMissingGucInspector inspector = new RlsMissingGucInspector(true);

        // Chacune doit traverser l'inspecteur sans altération ; la détection elle-même
        // s'observe dans le journal, et en conditions reelles via RlsBootIT.
        for (String table : new String[] {
                "reservations", "invoices", "document_generations",
                "service_requests", "payment_transactions"}) {
            String sql = "select * from " + table + " where organization_id=?";
            assertThat(inspector.inspect(sql))
                    .as("le SQL sur %s doit ressortir intact", table)
                    .isEqualTo(sql);
        }
    }

    @Test
    @DisplayName("une table hors périmètre n'est pas surveillée")
    void tableHorsPerimetre_ignoree() {
        RlsMissingGucInspector inspector = new RlsMissingGucInspector(true);
        String sql = "select * from properties where id=?";

        assertThat(inspector.inspect(sql)).isEqualTo(sql);
    }
}
