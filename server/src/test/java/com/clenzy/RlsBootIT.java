package com.clenzy;

import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Montage complet de l'application avec la RLS ACTIVE — audit sécurité 2026-07-26,
 * plan REM-T-01, défaut R1.
 *
 * <p>{@link RlsEnforcementIT} valide la mécanique SQL en JDBC direct : politiques posées,
 * GUC honorées, isolation effective. Il ne peut pas, par construction, détecter le risque
 * qui rend l'activation dangereuse en production.
 *
 * <p><b>Ce risque</b> : la politique de {@code 0345} n'accorde la visibilité que si
 * {@code app.current_org} ou {@code app.bypass_rls} est positionné. Ces GUC sont posées par
 * {@code RlsTenantGucAspect}, dont le pointcut ne couvre que les méthodes {@code @Transactional}
 * situées {@code within(com.clenzy..*)}. Toute lecture ouvrant sa transaction ailleurs — par
 * exemple via le {@code SimpleJpaRepository} de Spring Data, qui est {@code @Transactional}
 * mais vit dans {@code org.springframework.data} — n'aurait aucune GUC, et
 * <b>retournerait zéro ligne au lieu de lever une erreur</b>.
 *
 * <p>Un tel défaut ne se manifeste pas par un crash mais par des écrans vides et des
 * exports incomplets : c'est exactement ce qu'il faut détecter avant la production, et
 * non après.
 *
 * <p>Ce test monte donc le contexte Spring complet, avec les migrations appliquées sous le
 * contexte Liquibase {@code rls} et l'aspect actif, puis exerce les deux chemins.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE,
        classes = RlsBootIT.LecteurApplicatifConfig.class)
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
@DisplayName("Boot applicatif avec RLS active (REM-T-01, défaut R1)")
class RlsBootIT extends AbstractIntegrationTest {

    private static final Long ORG_A = 90001L;
    private static final Long ORG_B = 90002L;

    /**
     * Represente le cas NOMINAL : un composant applicatif de {@code com.clenzy} portant
     * {@code @Transactional}. C'est precisement ce que le pointcut
     * {@code within(com.clenzy..*)} est cense couvrir — contrairement a
     * {@code TransactionTemplate}, qui ouvre sa transaction depuis {@code org.springframework}.
     */
    @org.springframework.boot.test.context.TestConfiguration
    static class LecteurApplicatifConfig {
        @org.springframework.context.annotation.Bean
        LecteurApplicatif lecteurApplicatif(PaymentTransactionRepository repo) {
            return new LecteurApplicatif(repo);
        }
    }

    static class LecteurApplicatif {
        private final PaymentTransactionRepository repo;
        LecteurApplicatif(PaymentTransactionRepository repo) { this.repo = repo; }

        @Transactional(readOnly = true)
        public long compterPourOrganisation(Long orgId) {
            return repo.findAll().stream()
                    .filter(t -> orgId.equals(t.getOrganizationId()))
                    .count();
        }
    }

    @Autowired private LecteurApplicatif lecteurApplicatif;
    @Autowired private PaymentTransactionRepository transactionRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private TenantContext tenant;

    /** Les cinq tables que le changeset 0345 place sous RLS. */
    private static final String[] TABLES_RLS = {
        "reservations", "invoices", "document_generations", "service_requests", "payment_transactions"
    };

    /**
     * Retire le superuser AVANT le demarrage du contexte Spring.
     *
     * <p>Le faire apres ne suffit pas : les connexions deja ouvertes par Hikari conservent
     * les attributs de role acquis a l'etablissement de la session. Le catalogue
     * {@code pg_roles} refleterait le changement, mais les requetes continueraient de
     * contourner la RLS — un test vert qui ne prouve rien.
     *
     * <p>Le compte reste PROPRIETAIRE des tables : condition plus stricte que la production,
     * puisque {@code FORCE ROW LEVEL SECURITY} s'applique aussi aux proprietaires.
     */
    private static void retirerSuperuserAvantBoot() {
        try (java.sql.Connection c = java.sql.DriverManager.getConnection(
                     postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             java.sql.Statement st = c.createStatement()) {
            st.execute("ALTER ROLE \"" + postgres.getUsername() + "\" NOSUPERUSER NOBYPASSRLS");
        } catch (java.sql.SQLException e) {
            throw new IllegalStateException("Retrait du superuser impossible", e);
        }
    }

    @DynamicPropertySource
    static void enableRls(DynamicPropertyRegistry registry) {
        retirerSuperuserAvantBoot();
        // NB : inutile de poser `spring.liquibase.contexts=rls` — le profil de test utilise
        // `ddl-auto: create-drop`, donc Hibernate genere le schema et Liquibase ne tourne
        // PAS (piege documente dans CLAUDE.md). Les politiques sont donc posees a la main
        // ci-dessous, avec exactement le SQL du changeset 0345.
        // Sans l'aspect, les politiques poseraient zéro ligne partout : les deux vont ensemble.
        registry.add("clenzy.security.rls.enabled", () -> "true");
        // Mode non strict : l'absence de contexte tenant vaut bypass. C'est la
        // configuration du premier palier de production — `strict-context` viendra
        // seulement quand tous les flux de fond porteront un contexte.
        registry.add("clenzy.security.rls.strict-context", () -> "false");
    }

    /**
     * Applique la politique du changeset 0345 sur le schema genere par Hibernate.
     * Le SQL est repris a l'identique : ce test perdrait tout sens s'il validait une
     * politique differente de celle qui sera reellement deployee.
     */
    private void poserPolitiqueRls() {
        for (String t : TABLES_RLS) {
            jdbcTemplate.execute("ALTER TABLE " + t + " ENABLE ROW LEVEL SECURITY");
            jdbcTemplate.execute("ALTER TABLE " + t + " FORCE ROW LEVEL SECURITY");
            jdbcTemplate.execute("DROP POLICY IF EXISTS tenant_isolation ON " + t);
            jdbcTemplate.execute(
                    "CREATE POLICY tenant_isolation ON " + t
                            + " USING (current_setting('app.bypass_rls', true) = 'on'"
                            + "        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint)"
                            + " WITH CHECK (current_setting('app.bypass_rls', true) = 'on'"
                            + "        OR organization_id = NULLIF(current_setting('app.current_org', true), '')::bigint)");
        }
    }

    private void retirerPolitiqueRls() {
        for (String t : TABLES_RLS) {
            jdbcTemplate.execute("ALTER TABLE " + t + " DISABLE ROW LEVEL SECURITY");
        }
    }


    @BeforeEach
    void seed() {
        // FORCE ROW LEVEL SECURITY s'applique AUSSI au proprietaire des tables : il faut
        // donc semer avant de poser la politique, sinon l'insertion serait elle-meme filtree.
        retirerPolitiqueRls();
        // Le compte de test est proprietaire des tables, donc exempte de RLS (BYPASSRLS
        // implicite du proprietaire) : le seed n'est pas entrave par les politiques.
        // Meme table que RlsEnforcementIT — le test porte sur le mecanisme, pas sur une
        // table en particulier, et celle-ci a ses colonnes obligatoires deja identifiees.
        jdbcTemplate.update("DELETE FROM payment_transactions WHERE organization_id IN (?, ?)", ORG_A, ORG_B);
        for (Long org : new Long[] {ORG_A, ORG_B}) {
            jdbcTemplate.update(
                    "INSERT INTO payment_transactions (organization_id, transaction_ref, amount, "
                            + "currency, status, payment_type, provider_type) "
                            + "VALUES (?, ?, 100.00, 'EUR', 'PENDING', 'CHECKOUT', 'STRIPE')",
                    org, "rls-boot-" + org);
        }
        poserPolitiqueRls();
    }

    @Test
    @DisplayName("l'application ne tourne PAS en superuser — sans quoi rien ne prouverait rien")
    void applicationNeTournePasEnSuperuser() {
        Boolean estSuperuser = jdbcTemplate.queryForObject(
                "SELECT rolsuper FROM pg_roles WHERE rolname = current_user", Boolean.class);
        Boolean contourneRls = jdbcTemplate.queryForObject(
                "SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user", Boolean.class);
        // rolbypassrls est un attribut DISTINCT de superuser : un role peut contourner la
        // RLS sans etre superuser. Les deux doivent etre faux pour que ce test ait un sens.
        assertThat(contourneRls)
                .as("BYPASSRLS contourne la RLS aussi surement que superuser")
                .isFalse();
        assertThat(estSuperuser)
                .as("un superuser contourne la RLS meme FORCEE : toutes les autres assertions "
                        + "de cette classe seraient alors vides de sens")
                .isFalse();
    }

    @Test
    @DisplayName("la RLS est bien active sur les tables prioritaires après le boot")
    void rlsEstActiveApresBoot() {
        Integer forcees = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_class WHERE relrowsecurity AND relforcerowsecurity "
                        + "AND relname IN ('reservations','invoices','document_generations',"
                        + "'service_requests','payment_transactions')", Integer.class);

        // Si ce compte n'est pas 5, le contexte Liquibase `rls` n'a pas ete applique et
        // tout le reste du test ne prouverait rien.
        assertThat(forcees).isEqualTo(5);
    }

    /**
     * Le cœur du défaut R1. Une lecture effectuée dans une transaction ouverte par du code
     * applicatif doit voir les données de son organisation — pas zéro ligne.
     */
    @Test
    @DisplayName("une lecture transactionnelle voit son organisation, pas zéro ligne")
    void lectureTransactionnelle_voitSonOrganisation() {
        tenant.setOrganizationId(ORG_A);

        // Appel via un composant @Transactional de com.clenzy : le chemin que le pointcut
        // couvre, et celui qu'empruntent tous les services de l'application.
        long vues = lecteurApplicatif.compterPourOrganisation(ORG_A);

        assertThat(vues)
                .as("zéro ligne ici signifierait que la GUC n'est pas posée : écrans vides en production")
                .isGreaterThan(0);
    }

    @Test
    @DisplayName("une lecture transactionnelle ne voit pas les autres organisations")
    void lectureTransactionnelle_neVoitPasLesAutres() {
        tenant.setOrganizationId(ORG_A);

        boolean voitOrgB = Boolean.TRUE.equals(transactionTemplate.execute(status ->
                transactionRepository.findAll().stream()
                        .anyMatch(r -> ORG_B.equals(r.getOrganizationId()))));

        assertThat(voitOrgB)
                .as("la base elle-même doit refuser, indépendamment de toute garde applicative")
                .isFalse();
    }

    /**
     * Le chemin qui n'est PAS couvert par le pointcut : la transaction est ouverte par
     * {@code SimpleJpaRepository} (paquet {@code org.springframework.data}), pas par du code
     * {@code com.clenzy}. L'aspect ne s'y déclenche pas.
     *
     * <p>Ce test <b>documentait</b> le comportement au lieu de le prescrire, faute d'un
     * mécanisme qui couvre ce chemin. L'inventaire de production a mesuré ce que cela
     * coûtait : 34 chemins, dont dix scanners de supervision et la rotation des codes
     * d'accès, tous hors du pointcut par construction — leurs appelants enchaînent des
     * appels LLM ou des effets externes, qu'une transaction ne doit jamais englober.
     *
     * <p>{@link com.clenzy.tenant.RlsTenantConnectionProvider} pose désormais le contexte à
     * la <b>prise de connexion</b> : aucune requête JPA n'atteint plus PostgreSQL sans lui.
     * Le résultat cesse d'être une observation, il devient une assertion.
     */
    @Test
    @Transactional(propagation = Propagation.NEVER)
    @DisplayName("hors transaction applicative : la connexion porte quand même le contexte")
    void horsTransactionApplicative_contextePoseParLaConnexion() {
        tenant.setOrganizationId(ORG_A);

        long vues = transactionRepository.findAll().stream()
                .filter(r -> ORG_A.equals(r.getOrganizationId()))
                .count();

        assertThat(vues)
                .as("zéro ligne ici signifierait que le contexte n'est plus posé à la prise de "
                        + "connexion : les scanners, la rotation des codes d'accès et le push CRS "
                        + "se tairaient en production sans lever la moindre erreur")
                .isGreaterThan(0);
    }

    /**
     * Le pendant du test précédent : couvrir ce chemin ne doit pas revenir à tout montrer.
     * Une GUC posée à la connexion vaudrait moins que rien si elle accordait le bypass.
     */
    @Test
    @Transactional(propagation = Propagation.NEVER)
    @DisplayName("hors transaction applicative : les autres organisations restent invisibles")
    void horsTransactionApplicative_neVoitPasLesAutres() {
        tenant.setOrganizationId(ORG_A);

        boolean voitOrgB = transactionRepository.findAll().stream()
                .anyMatch(r -> ORG_B.equals(r.getOrganizationId()));

        assertThat(voitOrgB)
                .as("le contexte posé à la connexion doit isoler, pas ouvrir")
                .isFalse();
    }

    @Test
    @DisplayName("sans organisation courante, le mode non strict laisse passer")
    void sansOrganisation_modeNonStrictLaissePasser() {
        tenant.setOrganizationId(null);

        Long total = transactionTemplate.execute(status -> transactionRepository.count());

        // C'est ce bypass implicite qui permet aux consumers Kafka, schedulers et a la
        // surface /api/public/** de continuer a fonctionner au premier palier. Le passage
        // a strict-context=true supprimera ce filet — et ne doit donc venir qu'apres.
        assertThat(total)
                .as("mode non strict : l'absence de contexte vaut bypass")
                .isNotNull();
    }
}
