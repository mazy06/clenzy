package com.clenzy.tenant;

import jakarta.persistence.EntityManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * Pose les variables de session PostgreSQL (GUC) utilisées par la Row-Level Security
 * multi-tenant (audit sécurité 2026-07, F1-STRUCT).
 *
 * <ul>
 *   <li>{@code app.current_org} : l'organisation courante (vide si absente).</li>
 *   <li>{@code app.bypass_rls} : {@code on} pour le staff plateforme, les org SYSTEM,
 *       ET les threads background <b>sans</b> contexte tenant (exécution interne non
 *       tenant-scopée — même exemption qu'aujourd'hui où aucun filtre n'est actif).</li>
 * </ul>
 *
 * <p>Les GUC sont posées en <b>LOCAL</b> (transaction-scoped, {@code set_config(..., true)}) :
 * elles s'auto-réinitialisent au commit/rollback → aucune fuite entre connexions poolées.
 * Doit donc être appelé <b>à l'intérieur</b> d'une transaction (cf. {@link RlsTenantGucAspect}).</p>
 *
 * <p><b>Inerte tant que la RLS n'est pas activée</b> : les policies (changeset 0345) ne sont
 * pas câblées dans {@code db.changelog-master.yaml} et l'aspect est gardé par le flag
 * {@code clenzy.security.rls.enabled} (défaut {@code false}). Voir
 * {@code docs/security/RLS-ROLLOUT-RUNBOOK.md}.</p>
 */
public final class RlsGuc {

    /**
     * Mode strict : refuse le bypass <b>implicite</b> accordé à un thread sans contexte tenant.
     *
     * <p>Audit 2026-07, défaut R3 : la règle {@code bypass = … || org == null} exempte de RLS
     * <b>toute</b> exécution dépourvue de contexte tenant — soit l'intégralité de
     * {@code /api/public/**} (exclu du {@code TenantFilter}), les 18 consumers Kafka et les
     * schedulers financiers. Le filet ne couvrait donc précisément pas les surfaces où
     * l'audit a trouvé les fuites cross-tenant.</p>
     *
     * <p><b>Opt-in, défaut {@code false}</b> : activer ce mode avant d'avoir donné un contexte
     * tenant à ces chemins (REM-S1-05 — {@code TenantScopedExecutor} sur les consumers,
     * scoping de la surface publique) ne produirait pas une fuite mais un <b>outage</b> :
     * sans {@code app.current_org} ni bypass, la policy ne matche aucune ligne. Le mécanisme
     * de fermeture est ici, testé ; son activation attend que les chemins soient scopés.</p>
     *
     * <p>Le bypass <b>explicite</b> (staff plateforme, organisation SYSTEM) n'est jamais
     * affecté : le mode strict ne ferme que l'exemption accidentelle.</p>
     */
    private static volatile boolean strictContext = false;

    /**
     * Marqueur : les GUC ont-elles ete posees sur la transaction en cours ?
     *
     * <p>Sert exclusivement a l'instrumentation de mesure ({@code RlsMissingGucInspector}) :
     * une requete sur une table sous RLS qui s'execute SANS ces GUC renverra zero ligne le
     * jour ou la RLS sera activee. Le but est de recenser ces chemins pendant que la RLS est
     * encore inactive — donc sans aucun risque — plutot que de les decouvrir en production.
     *
     * <p>Le marqueur est efface a la fin de la transaction, pas laisse au thread : un thread
     * de pool reutilise donnerait sinon un faux negatif, exactement ce qu'on cherche a eviter.
     */
    private static final ThreadLocal<Boolean> GUC_POSEE = new ThreadLocal<>();

    /**
     * Les GUC sont-elles posees a la prise de connexion, pour toute connexion sans exception ?
     *
     * <p>Pose par {@code RlsConnectionProviderConfig} quand
     * {@link RlsTenantConnectionProvider} est installe. Ce provider ecrit les GUC sur
     * <b>chaque</b> connexion empruntee, sans condition : il n'existe alors plus de requete
     * JPA capable d'atteindre PostgreSQL sans contexte. Le marqueur par transaction devient
     * un raffinement, plus la seule couverture.</p>
     */
    private static volatile boolean poseeParConnexion = false;

    /** Voir {@link #poseeParConnexion}. Appele une fois, au montage du provider. */
    public static void setPoseeParConnexion(boolean pose) {
        poseeParConnexion = pose;
    }

    /**
     * @return vrai si les GUC sont posees pour la requete en cours — soit par la connexion
     *         elle-meme ({@link RlsTenantConnectionProvider}), soit par l'aspect sur la
     *         transaction courante.
     */
    public static boolean estGucPosee() {
        return poseeParConnexion || Boolean.TRUE.equals(GUC_POSEE.get());
    }

    private RlsGuc() {
    }

    /** Voir {@link #strictContext}. Piloté par {@code clenzy.security.rls.strict-context}. */
    public static void setStrictContext(boolean strict) {
        strictContext = strict;
    }

    public static boolean isStrictContext() {
        return strictContext;
    }

    /**
     * Valeurs a poser pour le thread courant.
     *
     * @param organisation identifiant d'organisation, chaine vide si aucune
     * @param bypass       exemption de RLS accordee a cette execution
     */
    public record Valeurs(String organisation, boolean bypass) {

        /** Representation attendue par la policy : {@code on} / {@code off}. */
        public String bypassSql() {
            return bypass ? "on" : "off";
        }
    }

    /**
     * Derive les valeurs de GUC du contexte tenant — <b>seul</b> endroit ou la regle de
     * bypass est ecrite, pour que l'aspect (transaction) et le provider (connexion) ne
     * puissent jamais diverger.
     */
    public static Valeurs valeursPour(TenantContext ctx) {
        final Long org = ctx.getOrganizationId();
        // Bypass EXPLICITE : décision métier assumée (staff plateforme, org SYSTEM).
        final boolean explicitBypass = ctx.isSuperAdmin() || ctx.isSystemOrg();
        // Bypass IMPLICITE : simple absence de contexte tenant — accordé par défaut pour ne pas
        // casser les exécutions internes, refusé en mode strict (défaut R3).
        final boolean implicitBypass = org == null && !strictContext;
        return new Valeurs(org == null ? "" : org.toString(), explicitBypass || implicitBypass);
    }

    public static void apply(EntityManager em, TenantContext ctx) {
        final Valeurs valeurs = valeursPour(ctx);
        try {
            em.createNativeQuery("select set_config('app.current_org', :org, true)")
                    .setParameter("org", valeurs.organisation())
                    .getSingleResult();
            em.createNativeQuery("select set_config('app.bypass_rls', :bypass, true)")
                    .setParameter("bypass", valeurs.bypassSql())
                    .getSingleResult();
            marquerGucPosee();
        } catch (RuntimeException e) {
            // Pas de transaction/connexion liée (ne devrait pas arriver sous @Transactional) :
            // on NE relance PAS — la pose de GUC ne doit jamais casser une opération métier.
            // NB : si la GUC n'est pas posée alors que la RLS est active, les requêtes
            // renverront 0 ligne (fail-closed visible en staging), pas une fuite.
        }
    }

    /**
     * Pose les memes GUC en portee <b>SESSION</b> sur une connexion fraichement empruntee.
     *
     * <h2>Pourquoi SESSION ici, LOCAL dans {@link #apply}</h2>
     * <p>A la prise de connexion, aucune transaction n'est garantie ouverte — et c'est
     * precisement le cas qu'il s'agit de couvrir : un repository appele hors service
     * {@code @Transactional} ouvre sa transaction dans {@code SimpleJpaRepository}, hors du
     * pointcut de l'aspect. Un {@code set_config(..., true)} LOCAL y serait sans effet.</p>
     *
     * <h2>Pourquoi aucune connexion n'emporte le contexte de la precedente</h2>
     * <p>Une GUC de session survit au retour de la connexion au pool. La seule protection
     * qui tienne est donc l'inconditionnalite : ces deux valeurs sont ecrites a
     * <b>chaque</b> emprunt, y compris quand il n'y a aucun tenant (chaine vide + bypass).
     * Il n'existe pas de chemin ou l'on « saute » l'ecriture, donc pas de valeur heritee.
     * Ne jamais rendre cet appel conditionnel.</p>
     *
     * <h2>Une valeur de session est annulee par un ROLLBACK</h2>
     * <p>PostgreSQL annule un {@code set_config(..., false)} si la transaction englobante
     * echoue. Hibernate acquerant la connexion a la premiere instruction de la transaction,
     * l'ecriture faite ici en fait partie : un rollback la remet a la valeur precedente.
     * Sans effet en pratique — la connexion est relachee dans la foulee et re-contextualisee
     * au prochain emprunt — mais c'est la raison pour laquelle {@link RlsTenantGucAspect}
     * n'est pas retire : ses GUC LOCAL sont reposees a chaque ouverture de transaction.</p>
     *
     * <h2>Pourquoi l'echec est relance, contrairement a {@link #apply}</h2>
     * <p>L'aspect avale l'echec : une GUC LOCAL manquante fait renvoyer zero ligne, une
     * panne visible, jamais une fuite. Ici l'enjeu est inverse — une connexion rendue sans
     * ecriture porterait le contexte de son emprunteur precedent. Echouer bruyamment est la
     * seule issue sure ; l'appelant referme la connexion.</p>
     */
    public static void applySession(Connection connection, TenantContext ctx) throws SQLException {
        final Valeurs valeurs = valeursPour(ctx);
        // Un seul aller-retour : les deux GUC dans la meme instruction.
        try (PreparedStatement statement = connection.prepareStatement(
                "select set_config('app.current_org', ?, false),"
                        + " set_config('app.bypass_rls', ?, false)")) {
            statement.setString(1, valeurs.organisation());
            statement.setString(2, valeurs.bypassSql());
            statement.execute();
        }
    }

    /**
     * Pose le marqueur et programme son effacement a la fin de la transaction.
     * Hors transaction synchronisee, le marqueur n'est pas pose : le laisser trainer
     * masquerait precisement les appels que l'instrumentation cherche a recenser.
     */
    private static void marquerGucPosee() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        GUC_POSEE.set(Boolean.TRUE);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                GUC_POSEE.remove();
            }
        });
    }
}
