package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.model.Guest;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SystemEmailTemplate;
import com.clenzy.model.User;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SystemEmailTemplateRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.NoiseAlertNotificationService;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.kb.EmbeddingOrgQuota;
import com.clenzy.service.agent.supervision.SupervisionScanQuota;
import com.clenzy.service.messaging.EmailWrapperService;
import com.clenzy.service.messaging.SystemEmailTemplateService;
import com.clenzy.service.messaging.TemplateInterpolationService;
import com.clenzy.service.messaging.whatsapp.WhatsAppProviderResolver;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pannes Redis — les DEUX semantiques VOULUES et opposees (strategie de tests,
 * vague T3, principe n°6) :
 * <ul>
 *   <li>(a) {@link SupervisionScanQuota#tryConsume} → <b>FAIL-CLOSED</b> : sans
 *       Redis on ne lance PAS de scan autonome (le scan consomme des tokens sans
 *       operateur — jamais de budget non compte) ;</li>
 *   <li>(b) {@link EmbeddingOrgQuota#tryConsume} → <b>FAIL-OPEN</b> : sans Redis
 *       le RAG continue (fonctionnalite utilisateur, quota = garde-fou de cout) ;</li>
 *   <li>(c) claim bruit {@link NoiseAlertNotificationService} → <b>repli base</b> :
 *       sans Redis, l'idempotence « 1 avertissement voyageur / sejour / 24 h »
 *       est arbitree par {@code NoiseAlertRepository.existsGuestNotifiedSince}.</li>
 * </ul>
 *
 * <p><b>Choix d'implementation documente</b> : on ne coupe PAS le container Redis
 * singleton du socle ({@link AbstractIntegrationTest}) — il est partage par tout
 * le contexte Spring (cache, autres tests de la JVM) et le stopper casserait des
 * classes voisines. A la place, un container Redis <b>DEDIE a cette classe</b> est
 * demarre, un {@link StringRedisTemplate} pointe dessus (timeouts courts), les
 * services testes sont instancies avec CE template (constructeurs publics — les
 * quotas sont autonomes, le service bruit recoit les beans REELS du contexte pour
 * exercer le vrai repli base sur le vrai Postgres Testcontainers). La panne est
 * simulee en STOPPANT le container dedie — connexion refusee, exception rapide.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class RedisOutageSemanticsIT extends AbstractIntegrationTest {

    /** Container Redis dedie a la classe (jamais le singleton du socle). */
    @SuppressWarnings("resource")
    private static final GenericContainer<?> dedicatedRedis =
            IT_ENABLED ? new GenericContainer<>("redis:7-alpine").withExposedPorts(6379) : null;

    private static StringRedisTemplate dedicatedTemplate;
    private static LettuceConnectionFactory dedicatedFactory;

    // Beans reels pour le repli base du claim bruit (chemin Postgres reel).
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private GuestRepository guestRepository;
    @Autowired private NoiseAlertRepository noiseAlertRepository;
    @Autowired private SystemEmailTemplateRepository systemEmailTemplateRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private SystemEmailTemplateService systemEmailTemplateService;
    @Autowired private TemplateInterpolationService templateInterpolationService;
    @Autowired private WhatsAppProviderResolver whatsAppProviderResolver;
    @Autowired private WhatsAppConfigRepository whatsAppConfigRepository;

    /** Frontiere SMTP mockee : l'envoi reel n'est pas l'objet du test. */
    @MockBean private EmailService emailService;

    @AfterAll
    static void tearDownDedicatedRedis() {
        if (dedicatedFactory != null) {
            dedicatedFactory.destroy();
        }
        if (dedicatedRedis != null && dedicatedRedis.isRunning()) {
            dedicatedRedis.stop();
        }
    }

    /**
     * Template pointe sur le container dedie, timeouts courts : une fois le
     * container stoppe, chaque commande echoue vite (connexion refusee) au lieu
     * d'attendre le timeout Lettuce par defaut (60 s).
     */
    private static synchronized StringRedisTemplate dedicatedRedisTemplate() {
        if (dedicatedTemplate != null) {
            return dedicatedTemplate;
        }
        if (!dedicatedRedis.isRunning()) {
            dedicatedRedis.start();
        }
        RedisStandaloneConfiguration standalone = new RedisStandaloneConfiguration(
                dedicatedRedis.getHost(), dedicatedRedis.getMappedPort(6379));
        LettuceClientConfiguration client = LettuceClientConfiguration.builder()
                .commandTimeout(Duration.ofSeconds(2))
                .shutdownTimeout(Duration.ZERO)
                .build();
        dedicatedFactory = new LettuceConnectionFactory(standalone, client);
        // Pas de connexion partagee : pas de file de reconnexion qui retiendrait
        // les commandes apres l'arret du container.
        dedicatedFactory.setShareNativeConnection(false);
        dedicatedFactory.afterPropertiesSet();
        dedicatedTemplate = new StringRedisTemplate(dedicatedFactory);
        dedicatedTemplate.afterPropertiesSet();
        return dedicatedTemplate;
    }

    private static void killDedicatedRedis() {
        if (dedicatedRedis.isRunning()) {
            dedicatedRedis.stop();
        }
    }

    // ─── (a) + (b) : quotas — fail-closed vs fail-open ──────────────────────

    @Test
    void redisOutage_scanQuotaFailsClosed_embeddingQuotaFailsOpen_noiseClaimFallsBackToDb() {
        StringRedisTemplate template = dedicatedRedisTemplate();
        SupervisionScanQuota scanQuota = new SupervisionScanQuota(template);
        EmbeddingOrgQuota embeddingQuota = new EmbeddingOrgQuota(template, 100);

        long orgKeySalt = System.nanoTime();
        Long quotaOrgId = orgKeySalt; // cle Redis distincte par run

        // Redis SAIN : les deux quotas accordent (etat de reference du test —
        // prouve que le refus/octroi ci-dessous vient bien de la PANNE).
        assertThat(scanQuota.tryConsume(quotaOrgId, 5))
                .as("Redis sain : le quota scan accorde sous le budget").isTrue();
        assertThat(embeddingQuota.tryConsume(quotaOrgId))
                .as("Redis sain : le quota embeddings accorde sous le quota").isTrue();

        // Seed du scenario bruit AVANT la panne (le seed utilise le Postgres du
        // socle, pas le Redis dedie — mais on garde tout le reel avant la coupure).
        NoiseFixture fixture = seedNoiseFixture();

        // ── PANNE : arret du container dedie. ──
        killDedicatedRedis();

        // (a) FAIL-CLOSED : plus de scan autonome sans quota verifiable.
        assertThat(scanQuota.tryConsume(quotaOrgId, 5))
                .as("Panne Redis : SupervisionScanQuota doit REFUSER (fail-closed)")
                .isFalse();

        // (b) FAIL-OPEN : le RAG continue, le quota reprendra avec Redis.
        assertThat(embeddingQuota.tryConsume(quotaOrgId))
                .as("Panne Redis : EmbeddingOrgQuota doit ACCORDER (fail-open)")
                .isTrue();

        // (c) claim bruit : service REEL construit avec le template mort +
        // les beans reels du contexte → le claim Redis echoue, le repli base
        // (existsGuestNotifiedSince, vrai Postgres) arbitre.
        NoiseAlertNotificationService noiseService = new NoiseAlertNotificationService(
                notificationService, emailService, propertyRepository, reservationRepository,
                systemEmailTemplateService, templateInterpolationService,
                new EmailWrapperService(), whatsAppProviderResolver, whatsAppConfigRepository,
                noiseAlertRepository, template);

        // c-1 : AUCUN message voyageur en base < 24 h → le repli base accorde,
        // l'avertissement part (email via le template seede, SMTP mocke).
        var firstOutcome = noiseService.sendGuestWarning(fixture.freshAlert());
        assertThat(firstOutcome.sent())
                .as("Panne Redis + base vierge : le repli base accorde le claim "
                        + "(raison=%s)", firstOutcome.skipReason())
                .isTrue();
        assertThat(firstOutcome.channel()).isEqualTo("email");

        // c-2 : l'envoi c-1 a trace notified_guest=true en base → une nouvelle
        // alerte < 24 h est REFUSEE par le repli base (une seule notification).
        var secondOutcome = noiseService.sendGuestWarning(fixture.secondAlert());
        assertThat(secondOutcome.sent())
                .as("Panne Redis + voyageur deja averti en base : repli base refuse")
                .isFalse();
        assertThat(secondOutcome.skipReason()).contains("deja averti");
    }

    // ─── Fixture bruit ───────────────────────────────────────────────────────

    private record NoiseFixture(NoiseAlert freshAlert, NoiseAlert secondAlert) {
    }

    private NoiseFixture seedNoiseFixture() {
        String salt = UUID.randomUUID().toString().substring(0, 8);
        Long orgId = organizationRepository.save(new Organization(
                "Redis Outage " + salt, OrganizationType.INDIVIDUAL, "redis-outage-" + salt)).getId();

        User owner = new User("Rita", "Redis", "rita." + salt + "@test.com", "password123");
        owner.setOrganizationId(orgId);
        owner.setKeycloakId("kc-redis-" + salt);
        owner = userRepository.save(owner);

        Property property = new Property("Loft Panne " + salt, "1 rue du Cache", 2, 1, owner);
        property.setOrganizationId(orgId);
        property.setNightlyPrice(new BigDecimal("80.00"));
        property = propertyRepository.save(property);

        Guest guest = new Guest("Gaston", "Guest", orgId);
        guest.setEmail("gaston." + salt + "@test.com");
        guest = guestRepository.save(guest);

        Reservation stay = new Reservation();
        stay.setOrganizationId(orgId);
        stay.setProperty(property);
        stay.setCheckIn(LocalDate.now().minusDays(1));
        stay.setCheckOut(LocalDate.now().plusDays(2));
        stay.setStatus("confirmed");
        stay.setGuest(guest);
        reservationRepository.save(stay);

        // Template email voyageur (schema create-drop : pas de seed Liquibase en test).
        if (systemEmailTemplateRepository.findAll().stream()
                .noneMatch(t -> "noise_alert_guest".equals(t.getTemplateKey()))) {
            SystemEmailTemplate template = new SystemEmailTemplate();
            template.setTemplateKey("noise_alert_guest");
            template.setLanguage("fr");
            template.setRecipientType("GUEST");
            template.setSubject("Un peu de calme a {propertyName}");
            template.setBody("Bonjour {guestName}, le niveau sonore est eleve.");
            template.setWrapperStyle("NOTIFICATION_OWNER");
            template.setSystem(true);
            systemEmailTemplateRepository.save(template);
        }

        return new NoiseFixture(
                savedAlert(orgId, property.getId(), 92.0),
                savedAlert(orgId, property.getId(), 95.0));
    }

    private NoiseAlert savedAlert(Long orgId, Long propertyId, double measuredDb) {
        NoiseAlert alert = new NoiseAlert();
        alert.setOrganizationId(orgId);
        alert.setPropertyId(propertyId);
        alert.setSeverity(NoiseAlert.AlertSeverity.CRITICAL);
        alert.setSource(NoiseAlert.AlertSource.WEBHOOK);
        alert.setMeasuredDb(measuredDb);
        alert.setThresholdDb(75);
        return noiseAlertRepository.save(alert);
    }
}
