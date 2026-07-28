package com.clenzy.config;

import com.clenzy.tenant.RlsMissingGucInspector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;

/**
 * Branche l'instrumentation de mesure de la RLS — audit sécurité 2026-07-26, plan REM-T-01.
 *
 * <p>Activer la Row-Level Security sans savoir quelles requêtes échappent au pointcut
 * reviendrait à parier : une requête sans GUC ne lève pas d'erreur, elle renvoie zéro ligne.
 * Cette configuration permet de faire l'inventaire <b>avant</b> l'activation, en production,
 * sans aucun risque — les politiques restent dormantes pendant la mesure.
 *
 * <p><b>Deux étages à ne pas confondre</b> — c'est la source d'erreur que ces messages
 * doivent éviter :</p>
 * <ol>
 *   <li>{@code clenzy.security.rls.enabled} : {@code RlsTenantGucAspect} <i>pose</i> les GUC
 *       {@code app.current_org} / {@code app.bypass_rls}. À {@code true}, rien ne change pour
 *       l'utilisateur tant que l'étage 2 est inactif — aucune politique ne lit ces GUC.</li>
 *   <li>Contexte Liquibase {@code rls} : le changeset {@code 0345} <i>applique</i> les
 *       politiques. C'est lui, et lui seul, qui fait qu'une requête sans GUC renvoie zéro
 *       ligne.</li>
 * </ol>
 *
 * <p><b>Utilisation</b> : poser {@code clenzy.security.rls.audit-missing-guc=true} et
 * laisser tourner le temps de couvrir un cycle d'usage complet — les écrans quotidiens,
 * mais aussi les traitements de fin de mois, les exports et les tâches planifiées, qui sont
 * précisément les plus susceptibles de s'exécuter hors contexte tenant.
 *
 * <p>Chaque {@code RLS/AUDIT} du journal désigne un chemin à traiter. Le journal reste
 * silencieux ⇒ l'activation devient un constat plutôt qu'un pari.
 *
 * <p><b>Après l'activation, l'instrumentation ne devient pas inutile : elle change de
 * rôle.</b> Avant, elle prévient une panne ; après, elle est le seul moyen de la voir, car
 * une requête non scopée ne lève toujours aucune erreur. Tout code ajouté plus tard qui
 * ouvrirait sa transaction hors du pointcut viderait un écran en silence. La couper, c'est
 * accepter de ne plus détecter ces régressions.
 */
@Configuration
public class RlsAuditConfig {

    private static final Logger log = LoggerFactory.getLogger(RlsAuditConfig.class);

    @Bean
    HibernatePropertiesCustomizer rlsMissingGucInspectorCustomizer(
            @Value("${clenzy.security.rls.audit-missing-guc:false}") boolean auditActif,
            @Value("${clenzy.security.rls.enabled:false}") boolean aspectGucActif,
            @Value("${spring.liquibase.contexts:}") String contextesLiquibase) {

        if (auditActif) {
            boolean politiquesAppliquees = contexteRlsActif(contextesLiquibase);

            if (!aspectGucActif) {
                // Sans l'aspect, AUCUNE GUC n'est posee : l'audit signalerait alors toutes
                // les requetes sur les cinq tables, pas seulement les chemins a risque.
                // L'inventaire serait ininterpretable — et son abondance pourrait meme
                // faire croire a un probleme massif inexistant.
                log.error("RLS/AUDIT : instrumentation activee mais clenzy.security.rls.enabled=false. "
                        + "L'aspect est INERTE, aucune GUC n'est posee, et TOUTES les requetes sur les "
                        + "tables sous RLS vont etre signalees : l'inventaire produit sera SANS VALEUR. "
                        + "Poser clenzy.security.rls.enabled=true — sans risque tant que le contexte "
                        + "Liquibase `rls` reste inactif, puisque aucune politique ne lit ces GUC.");
            }

            log.warn("RLS/AUDIT : instrumentation ACTIVE. Les requetes sur les tables sous RLS "
                    + "sans contexte tenant seront signalees (une fois par chemin distinct).");

            if (politiquesAppliquees) {
                // Post-bascule : le role change, il ne disparait pas. Une requete non scopee
                // ne leve toujours aucune erreur — sans cette instrumentation, l'ecran vide
                // est le seul symptome, et il n'atteint jamais les journaux.
                log.warn("RLS/AUDIT : les politiques du changeset 0345 sont APPLIQUEES "
                        + "(contexte Liquibase `rls` present dans spring.liquibase.contexts=\"{}\"). "
                        + "Un chemin signale ne risque plus de renvoyer zero ligne : il en renvoie "
                        + "deja zero. L'instrumentation reste le SEUL detecteur de ces pannes "
                        + "silencieuses (aucune exception n'est levee) — la couper revient a ne "
                        + "plus les voir.", contextesLiquibase);
            } else {
                // Phase pour laquelle l'outil a ete ecrit : mesure a risque nul.
                log.warn("RLS/AUDIT : phase INVENTAIRE — les politiques du changeset 0345 ne sont "
                        + "PAS appliquees (contexte Liquibase `rls` absent de "
                        + "spring.liquibase.contexts=\"{}\"). Aucune requete ne renvoie zero ligne "
                        + "a cause de la RLS : chaque constat designe un chemin a corriger AVANT le "
                        + "basculement. Laisser tourner jusqu'a couvrir un cycle d'usage complet "
                        + "(cf. docs/security/RLS-ROLLOUT-RUNBOOK.md).", contextesLiquibase);
            }
        }
        return props -> props.put("hibernate.session_factory.statement_inspector",
                new RlsMissingGucInspector(auditActif));
    }

    /**
     * Le contexte {@code rls} est-il demande ? Liquibase accepte une liste separee par des
     * virgules ou l'exclusion {@code !rls} — le defaut applicatif est precisement
     * {@code !rls}, qu'il ne faut surtout pas confondre avec une activation sous pretexte
     * que la chaine contient "rls".
     */
    private static boolean contexteRlsActif(String contextes) {
        if (contextes == null || contextes.isBlank()) {
            return false;
        }
        return Arrays.stream(contextes.split(","))
                .map(c -> c.trim().toLowerCase(java.util.Locale.ROOT))
                .anyMatch("rls"::equals);
    }
}
