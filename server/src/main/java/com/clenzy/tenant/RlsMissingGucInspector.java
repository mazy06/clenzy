package com.clenzy.tenant;

import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Locale;

/**
 * Recense les requêtes qui échapperaient à la Row-Level Security — audit sécurité
 * 2026-07-26, plan REM-T-01.
 *
 * <p><b>Le problème qu'il mesure.</b> La politique du changeset {@code 0345} n'accorde la
 * visibilité que si {@code app.current_org} ou {@code app.bypass_rls} est positionné. Ces
 * GUC sont posées par {@link RlsTenantGucAspect}, dont le pointcut ne couvre que les
 * méthodes {@code @Transactional} situées {@code within(com.clenzy..*)}. Toute requête
 * ouvrant sa transaction ailleurs — un {@code SimpleJpaRepository} appelé directement, un
 * {@code TransactionTemplate}, un flux de fond — n'aurait aucune GUC.
 *
 * <p>Le jour où la RLS sera active, ces requêtes ne lèveront pas d'erreur : elles
 * renverront <b>zéro ligne</b>. Des écrans vides, des exports incomplets, et rien dans les
 * logs. {@code RlsBootIT} a démontré ce comportement en conditions réelles.
 *
 * <p><b>Ce que fait cet inspecteur.</b> Il signale ces requêtes <i>pendant que la RLS est
 * encore inactive</i> — donc sans le moindre risque. Chaque avertissement désigne un
 * chemin à traiter avant l'activation. Le silence prolongé de ce journal est la condition
 * d'activation : il transforme un pari en constat.
 *
 * <p><b>Coût.</b> Inerte tant que {@code clenzy.security.rls.audit-missing-guc} vaut
 * {@code false} (défaut) : la méthode retourne immédiatement. Activé, il fait une recherche
 * de sous-chaîne sur cinq noms de table par requête. La pile d'appel — seule opération
 * réellement coûteuse — n'est capturée qu'au premier signalement de chaque chemin.
 */
public class RlsMissingGucInspector implements StatementInspector {

    private static final Logger log = LoggerFactory.getLogger(RlsMissingGucInspector.class);

    /** Les tables placées sous RLS par le changeset 0345. */
    private static final String[] TABLES_SOUS_RLS = {
        "reservations", "invoices", "document_generations", "service_requests", "payment_transactions"
    };

    private final boolean actif;

    public RlsMissingGucInspector(boolean actif) {
        this.actif = actif;
    }

    @Override
    public String inspect(String sql) {
        if (!actif || sql == null) {
            return sql;
        }
        if (RlsGuc.estGucPosee()) {
            return sql;
        }
        String table = tableSousRlsCitee(sql);
        if (table != null) {
            signaler(table, sql);
        }
        return sql;
    }

    private static String tableSousRlsCitee(String sql) {
        String minuscules = sql.toLowerCase(Locale.ROOT);
        for (String table : TABLES_SOUS_RLS) {
            if (minuscules.contains(table)) {
                return table;
            }
        }
        return null;
    }

    private static void signaler(String table, String sql) {
        String origine = premierAppelantApplicatif();
        String extrait = extraitSql(sql);

        // Le tampon agrege ; il dit si le chemin est inedit, ce qui evite d'inonder le
        // journal pour un appel qui se repete des milliers de fois par jour.
        boolean premiereFois = RlsAuditBuffer.enregistrer(origine, table, extrait);
        if (!premiereFois) {
            return;
        }
        if (RlsAuditBuffer.plafondAtteint()) {
            // Un plafond atteint n'est pas tronque en silence : c'est une information.
            log.warn("RLS/AUDIT : plafond de chemins distincts atteint, nouveaux constats "
                    + "ignores. Traiter les chemins deja remontes avant d'aller plus loin.");
            return;
        }
        log.warn("RLS/AUDIT : requete sur '{}' SANS contexte tenant pose. Une fois la RLS "
                + "active, elle renverra 0 ligne (pas une erreur). Origine : {} — SQL : {}",
                table, origine, extrait);
    }

    /**
     * Première frame applicative de la pile — c'est elle qui désigne le code à corriger.
     * Les frames Spring, Hibernate et JDBC sont sans intérêt ici.
     */
    private static String premierAppelantApplicatif() {
        for (StackTraceElement frame : Thread.currentThread().getStackTrace()) {
            String classe = frame.getClassName();
            if (classe.startsWith("com.clenzy.") && !classe.startsWith("com.clenzy.tenant.Rls")) {
                return classe + "." + frame.getMethodName() + ":" + frame.getLineNumber();
            }
        }
        return "origine applicative introuvable";
    }

    /** Le SQL complet noierait le journal ; le début suffit à identifier la requête. */
    private static String extraitSql(String sql) {
        String compact = sql.replaceAll("\\s+", " ").trim();
        return compact.length() <= 160 ? compact : compact.substring(0, 160) + "…";
    }
}
