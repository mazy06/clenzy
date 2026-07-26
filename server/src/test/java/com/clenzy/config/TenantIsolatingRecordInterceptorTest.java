package com.clenzy.config;

import com.clenzy.tenant.TenantContext;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vérifie qu'aucun contexte tenant ne survit au traitement d'un message Kafka.
 *
 * <h2>Le scénario reproduit</h2>
 * <p>Audit 2026-07 (REM-S1-05) : {@link TenantContext} est un {@code ThreadLocal} et les
 * threads de consommation Kafka sont réutilisés d'un message à l'autre. Aucun des 18
 * {@code @KafkaListener} ne nettoyait ce contexte. Un message traité pour l'organisation A
 * pouvait donc laisser son contexte en place, et le message suivant — appartenant à
 * l'organisation B — être traité <b>sous l'identité de A</b>.</p>
 *
 * <p>Ces tests simulent exactement cette séquence : deux messages consécutifs sur le même
 * thread, le premier laissant un contexte derrière lui.</p>
 */
class TenantIsolatingRecordInterceptorTest {

    private TenantContext tenantContext;
    private TenantIsolatingRecordInterceptor interceptor;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        interceptor = new TenantIsolatingRecordInterceptor(tenantContext);
    }

    @AfterEach
    void tearDown() {
        tenantContext.clear();
    }

    private ConsumerRecord<String, Object> record() {
        return new ConsumerRecord<>("payment.events", 0, 0L, "k", "v");
    }

    @Test
    @DisplayName("un contexte laisse par le message precedent est purge avant le suivant")
    void leakedContextIsClearedBeforeNextRecord() {
        // Message n : un traitement a laisse l'organisation A sur le thread.
        tenantContext.setOrganizationId(111L);

        // Message n+1, meme thread.
        interceptor.intercept(record(), null);

        assertThat(tenantContext.getOrganizationId())
                .as("le message suivant ne doit jamais demarrer sous l'identite du precedent")
                .isNull();
    }

    @Test
    @DisplayName("le contexte est purge apres le traitement (pas de fuite sortante)")
    void contextIsClearedAfterRecord() {
        interceptor.intercept(record(), null);
        tenantContext.setOrganizationId(222L);   // pose pendant le traitement

        interceptor.afterRecord(record(), null);

        assertThat(tenantContext.getOrganizationId()).isNull();
    }

    @Test
    @DisplayName("le drapeau super-admin ne survit pas non plus")
    void superAdminFlagDoesNotSurvive() {
        tenantContext.setOrganizationId(111L);
        tenantContext.setSuperAdmin(true);

        interceptor.intercept(record(), null);

        assertThat(tenantContext.isSuperAdmin())
                .as("un bypass herite serait pire qu'une organisation heritee")
                .isFalse();
    }

    @Test
    @DisplayName("thread deja propre : aucun effet de bord")
    void cleanThreadStaysClean() {
        interceptor.intercept(record(), null);

        assertThat(tenantContext.getOrganizationId()).isNull();
        assertThat(tenantContext.isSuperAdmin()).isFalse();
    }
}
