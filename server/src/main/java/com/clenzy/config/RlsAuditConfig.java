package com.clenzy.config;

import com.clenzy.tenant.RlsMissingGucInspector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Branche l'instrumentation de mesure de la RLS — audit sécurité 2026-07-26, plan REM-T-01.
 *
 * <p>Activer la Row-Level Security sans savoir quelles requêtes échappent au pointcut
 * reviendrait à parier : une requête sans GUC ne lève pas d'erreur, elle renvoie zéro ligne.
 * Cette configuration permet de faire l'inventaire <b>avant</b> l'activation, en production,
 * sans aucun risque — la RLS reste inactive pendant la mesure.
 *
 * <p><b>Utilisation</b> : poser {@code clenzy.security.rls.audit-missing-guc=true} et
 * laisser tourner le temps de couvrir un cycle d'usage complet — les écrans quotidiens,
 * mais aussi les traitements de fin de mois, les exports et les tâches planifiées, qui sont
 * précisément les plus susceptibles de s'exécuter hors contexte tenant.
 *
 * <p>Chaque {@code RLS/AUDIT} du journal désigne un chemin à traiter. Le journal reste
 * silencieux ⇒ l'activation devient un constat plutôt qu'un pari.
 */
@Configuration
public class RlsAuditConfig {

    private static final Logger log = LoggerFactory.getLogger(RlsAuditConfig.class);

    @Bean
    HibernatePropertiesCustomizer rlsMissingGucInspectorCustomizer(
            @Value("${clenzy.security.rls.audit-missing-guc:false}") boolean auditActif,
            @Value("${clenzy.security.rls.enabled:false}") boolean rlsActive) {

        if (auditActif) {
            log.warn("RLS/AUDIT : instrumentation ACTIVE. Les requetes sur les tables sous RLS "
                    + "sans contexte tenant seront signalees (une fois par chemin distinct). "
                    + "A desactiver une fois l'inventaire termine.");
            if (rlsActive) {
                // La mesure a du sens AVANT l'activation. Apres, les requetes concernees
                // renvoient deja zero ligne : on ne mesure plus un risque, on constate une panne.
                log.warn("RLS/AUDIT : la RLS est DEJA active. L'instrumentation ne previent plus "
                        + "rien — elle ne fait qu'accompagner des requetes qui renvoient deja "
                        + "zero ligne.");
            }
        }
        return props -> props.put("hibernate.session_factory.statement_inspector",
                new RlsMissingGucInspector(auditActif));
    }
}
