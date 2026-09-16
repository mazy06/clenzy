package com.clenzy.marketplace.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceProviderOffer;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.ProviderDocument;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.ProviderDocumentRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.KeycloakService;
import com.clenzy.service.OrganizationService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * Ce qui se passe quand une candidature est acceptee.
 *
 * <p>Un prestataire accepte cesse d'etre un dossier : il lui faut un compte pour
 * se connecter, et une organisation a lui. Le modele valide par le produit est
 * clair — un independant <b>est sa propre organisation</b> et travaille pour qui
 * il veut ; il n'est rattache a un tiers que s'il le decide.</p>
 *
 * <h2>Trois choix qui meritent d'etre dits</h2>
 * <ul>
 *   <li><b>On ne fabrique jamais son mot de passe.</b> Le compte est cree sans,
 *       et Baitly envoie l'invitation a en definir un. Choisir un mot de passe
 *       pour quelqu'un, c'est le connaitre.</li>
 *   <li><b>Un compte existant est REPRIS, pas double.</b> Une femme de menage
 *       deja dans Baitly qui candidate ne doit pas se retrouver avec deux
 *       identites et deux boites de reception.</li>
 *   <li><b>Les pieces changent de proprietaire.</b> C'est ici que le choix d'une
 *       table unique paie : un simple transfert, pas une recopie entre deux
 *       tables qui divergeraient.</li>
 * </ul>
 */
@Service
public class MarketplaceOnboardingService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceOnboardingService.class);

    private final MarketplaceProviderRepository providerRepository;
    private final ProviderDocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final OrganizationService organizationService;
    private final KeycloakService keycloakService;
    private final MarketplaceActivationDeliveries deliveries;
    private final TransactionTemplate txTemplate;
    private final MarketplaceProvisioningJobs jobs;

    public MarketplaceOnboardingService(MarketplaceProviderRepository providerRepository,
                                        ProviderDocumentRepository documentRepository,
                                        UserRepository userRepository,
                                        OrganizationService organizationService,
                                        KeycloakService keycloakService,
                                        MarketplaceActivationDeliveries deliveries,
                                        PlatformTransactionManager transactionManager, MarketplaceProvisioningJobs jobs) {
        this.providerRepository = providerRepository;
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.organizationService = organizationService;
        this.keycloakService = keycloakService;
        this.deliveries = deliveries;
        this.jobs = jobs;
        // Gabarit explicite, et non @Transactional sur une methode privee :
        // appeler une methode @Transactional de la MEME classe ne passe pas par
        // le proxy Spring — la transaction serait silencieusement absente, et
        // un compte a moitie cree ne se verrait qu'en production.
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.txTemplate = template;
    }

    /** Ce qui a ete fait, pour que l'appelant puisse le journaliser sans deviner. */
    public enum Outcome {
        /** Un compte et une organisation viennent d'etre crees. */
        ACCOUNT_CREATED,
        /** La fiche a ete rattachee a un compte qui existait deja. */
        EXISTING_ACCOUNT_LINKED,
        /** Rien a faire : la fiche portait deja un compte. */
        ALREADY_LINKED,
        /** Impossible d'aller au bout. La fiche reste active, sans compte. */
        FAILED,
        /** Une autre tentative est en cours, différée ou nécessite une vérification. */
        DEFERRED
    }

    /**
     * Donne un compte au prestataire accepte.
     *
     * <p>Appelee HORS de la transaction de moderation : creer un compte Keycloak
     * est un appel reseau, et le faire dans la transaction la tiendrait ouverte
     * pendant l'aller-retour.</p>
     *
     * <p>Ne leve jamais : une fiche acceptee le reste meme si l'ouverture du
     * compte echoue. Le contraire annulerait une decision deja prise et deja
     * annoncee au candidat.</p>
     */
    public void enqueue(Long providerId) { jobs.enqueue(providerId); }

    /** Le demandeur prouve son compte par sa session et par une lecture Keycloak fraîche. */
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public Outcome reconcile(Long providerId, org.springframework.security.oauth2.jwt.Jwt jwt) {
        String email = jwt == null ? null : jwt.getClaimAsString("email");
        if (jwt == null || jwt.getSubject() == null || email == null || email.isBlank()
                || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) {
            throw new org.springframework.security.access.AccessDeniedException("Session et email vérifié requis");
        }
        MarketplaceProvider provider = txTemplate.execute(status -> {
            var loaded = providerRepository.findById(providerId).orElseThrow(() ->
                new org.springframework.security.access.AccessDeniedException("Candidature inaccessible"));
            if (!loaded.isEmailConfirmed() || !email.equalsIgnoreCase(loaded.getEmail())
                || loaded.getStatus() != com.clenzy.marketplace.model.ProviderStatus.ACTIVE) {
                throw new org.springframework.security.access.AccessDeniedException("Candidature inaccessible");
            }
            loaded.getOffers().forEach(offer -> { if (offer.getCategory() != null) offer.getCategory().getCode(); });
            return loaded;
        });
        String subject = jwt.getSubject();
        keycloakService.verifyMarketplaceAccountOwner(subject, email);
        User existing = userRepository.findByEmailHash(StringUtils.computeEmailHash(email)).orElse(null);
        User bySubject = userRepository.findByKeycloakId(subject).orElse(null);
        if ((existing != null && (!subject.equals(existing.getKeycloakId()) || existing.getStatus() != UserStatus.ACTIVE))
            || (bySubject != null && (existing == null || !bySubject.getId().equals(existing.getId())))) {
            throw new org.springframework.security.access.AccessDeniedException("Identités locales en conflit : vérification administrative requise");
        }
        if (provider.getUserId() != null) {
            if (existing != null && provider.getUserId().equals(existing.getId())) {
                if (existing.getOrganizationId() == null) {
                    repairOwnOrganization(providerId, existing.getId(), subject, email);
                }
                return Outcome.ALREADY_LINKED;
            }
            throw new org.springframework.security.access.AccessDeniedException("Candidature déjà rattachée");
        }
        jobs.enqueue(providerId);
        var claim = jobs.claimReconciliation(providerId, subject);
        if (claim == null) return Outcome.DEFERRED;
        Outcome outcome = Outcome.FAILED;
        try {
            if (existing == null) {
                UserRole role = ProviderCategoryMapper.roleForCategory(primaryCategory(provider));
                keycloakService.assignRoleToUser(subject, role.name());
                txTemplate.executeWithoutResult(status -> persistAccountInTransaction(provider, subject, role, claim, false));
                outcome = Outcome.ACCOUNT_CREATED;
            } else {
                txTemplate.executeWithoutResult(status -> {
                    jobs.requireClaim(providerId, claim.token());
                    var fresh = providerRepository.findForErasure(providerId).orElseThrow();
                    assertStillEligible(fresh, provider);
                    var account = userRepository.findForMarketplaceReconciliation(existing.getId()).orElseThrow();
                    if (!subject.equals(account.getKeycloakId()) || !email.equalsIgnoreCase(account.getEmail())
                        || account.getStatus() != UserStatus.ACTIVE) {
                        throw new org.springframework.security.access.AccessDeniedException("Le compte a changé pendant la réconciliation");
                    }
                    Long organizationId = account.getOrganizationId();
                    if (organizationId == null) {
                        organizationId = organizationService.createForUser(account, fresh.getDisplayName(), OrganizationType.INDIVIDUAL).getId();
                    }
                    fresh.setUserId(account.getId());
                    if (fresh.getHomeOrganizationId() == null) fresh.setHomeOrganizationId(organizationId);
                    providerRepository.save(fresh);
                    transferDocuments(providerId, account.getId(), organizationId);
                });
                outcome = Outcome.EXISTING_ACCOUNT_LINKED;
            }
            return outcome;
        } finally {
            jobs.finish(providerId, claim.token(), outcome);
        }
    }

    /** Répare un ancien rattachement incomplet sans déplacer un compte ou une pièce d'une autre organisation. */
    private void repairOwnOrganization(Long providerId, Long userId, String subject, String email) {
        txTemplate.executeWithoutResult(status -> {
            var fresh = providerRepository.findForErasure(providerId).orElseThrow();
            var account = userRepository.findForMarketplaceReconciliation(userId).orElseThrow();
            if (!userId.equals(fresh.getUserId()) || !subject.equals(account.getKeycloakId())
                || !email.equalsIgnoreCase(account.getEmail()) || !email.equalsIgnoreCase(fresh.getEmail())
                || account.getStatus() != UserStatus.ACTIVE || !fresh.isEmailConfirmed()
                || fresh.getStatus() != com.clenzy.marketplace.model.ProviderStatus.ACTIVE) {
                throw new org.springframework.security.access.AccessDeniedException("Le rattachement a changé");
            }
            if (account.getOrganizationId() != null) return;
            Long organizationId = organizationService.createForUser(account, fresh.getDisplayName(), OrganizationType.INDIVIDUAL).getId();
            if (fresh.getHomeOrganizationId() == null) fresh.setHomeOrganizationId(organizationId);
            providerRepository.save(fresh);
            var documents = documentRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(document -> document.getOrganizationId() == null).toList();
            documents.forEach(document -> document.setOrganizationId(organizationId));
            documentRepository.saveAll(documents);
        });
    }

    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public Outcome onboard(Long providerId) {
        try {
            jobs.enqueue(providerId);
            var claim = jobs.claim(providerId);
            if (claim == null) return Outcome.DEFERRED;
            Outcome outcome = provision(providerId, claim);
            jobs.finish(providerId, claim.token(), outcome);
            return outcome;
        } catch (RuntimeException failure) {
            // La modération est déjà validée. La file durable permet le diagnostic et la reprise.
            log.error("État du provisionnement indisponible pour la fiche {}", providerId);
            return Outcome.FAILED;
        }
    }

    private Outcome provision(Long providerId, MarketplaceProvisioningJobs.Claim claim) {
        try {
            MarketplaceProvider provider = txTemplate.execute(status -> {
                var loaded = providerRepository.findById(providerId).orElse(null);
                if (loaded != null) {
                    // Le scheduler n'a pas de session web : charger le métier avant l'appel externe.
                    loaded.getOffers().forEach(offer -> { if (offer.getCategory() != null) offer.getCategory().getCode(); });
                }
                return loaded;
            });
            if (provider == null) {
                return Outcome.FAILED;
            }
            if (provider.getStatus() != com.clenzy.marketplace.model.ProviderStatus.ACTIVE || !provider.isEmailConfirmed()) {
                return Outcome.FAILED;
            }
            if (provider.getUserId() != null) {
                return Outcome.ALREADY_LINKED;
            }
            if (provider.getEmail() == null || provider.getEmail().isBlank()) {
                log.warn("Fiche {} acceptee sans adresse : aucun compte ne peut etre ouvert", providerId);
                return Outcome.FAILED;
            }

            // La colonne `email` est chiffree : la comparaison porte sur
            // l'empreinte, comme partout ailleurs.
            String emailHash = StringUtils.computeEmailHash(provider.getEmail());
            User existing = userRepository.findByEmailHash(emailHash).orElse(null);
            if (existing != null) {
                if (existing.getKeycloakId() == null || existing.getKeycloakId().isBlank()
                    || existing.getStatus() != UserStatus.ACTIVE) {
                    throw new org.springframework.security.access.AccessDeniedException("Le compte local nécessite une réconciliation vérifiée");
                }
                keycloakService.verifyMarketplaceAccountOwner(existing.getKeycloakId(), provider.getEmail());
                linkExisting(provider, existing, claim);
                return Outcome.EXISTING_ACCOUNT_LINKED;
            }

            return createAccount(provider, claim);

        } catch (Exception e) {
            log.error("Ouverture de compte impossible pour la fiche {} : {}", providerId, e.getMessage(), e);
            return Outcome.FAILED;
        }
    }

    // ─── Reprise d'un compte existant ────────────────────────────────────────

    private void linkExisting(MarketplaceProvider provider, User existing, MarketplaceProvisioningJobs.Claim claim) {
        txTemplate.executeWithoutResult(status -> {
            // RELECTURE dans la transaction, et non sauvegarde de l'instance
            // recue. Voir persistAccountInTransaction : ecrire l'instance
            // chargee plus tot ecrase en silence ce que l'annonce de decision
            // vient d'inscrire.
            jobs.requireClaim(provider.getId(), claim.token());
            MarketplaceProvider fresh = providerRepository.findById(provider.getId()).orElseThrow();
            assertStillEligible(fresh, provider);
            User account = userRepository.findForMarketplaceReconciliation(existing.getId()).orElseThrow();
            if (!java.util.Objects.equals(account.getKeycloakId(), existing.getKeycloakId())
                || !fresh.getEmail().equalsIgnoreCase(account.getEmail()) || account.getStatus() != UserStatus.ACTIVE) {
                throw new org.springframework.security.access.AccessDeniedException("Le compte a changé pendant le rattachement");
            }
            Long organizationId = account.getOrganizationId();
            if (organizationId == null) {
                organizationId = organizationService.createForUser(account, fresh.getDisplayName(), OrganizationType.INDIVIDUAL).getId();
            }
            fresh.setUserId(account.getId());
            if (fresh.getHomeOrganizationId() == null) fresh.setHomeOrganizationId(organizationId);
            providerRepository.save(fresh);
            transferDocuments(fresh.getId(), account.getId(), organizationId);
        });
        log.info("Fiche {} rattachee au compte existant {}", provider.getId(), existing.getId());
    }

    // ─── Creation d'un compte ────────────────────────────────────────────────

    private Outcome createAccount(MarketplaceProvider provider, MarketplaceProvisioningJobs.Claim claim) {
        UserRole role = ProviderCategoryMapper.roleForCategory(primaryCategory(provider));

        CreateUserDto keycloakUser = new CreateUserDto();
        keycloakUser.setFirstName(firstNameOf(provider));
        keycloakUser.setLastName(lastNameOf(provider));
        keycloakUser.setEmail(provider.getEmail());
        keycloakUser.setRole(role.name());
        // Pas de mot de passe : l'invitation Baitly permettra d'en définir un.

        String keycloakId = keycloakService.createMarketplaceUser(keycloakUser, claim.operationKey());
        log.info("Compte Keycloak cree pour la fiche {} : {}", provider.getId(), keycloakId);

        try {
            persistAccount(provider, keycloakId, role, claim);
        } catch (RuntimeException e) {
            // Le compte distant porte notre preuve durable : une reprise peut le retrouver.
            // Le supprimer ici pourrait effacer une identité déjà reprise après un résultat réseau incertain.
            log.warn("Enregistrement local incomplet pour la fiche {} ; compte distant conservé pour reprise", provider.getId());
            throw e;
        }

        // L'invitation durable est déjà validée avec le compte. Son scheduler
        // la reprend même si le processus s'arrête avant de clore le provisionnement.
        return Outcome.ACCOUNT_CREATED;
    }

    private void persistAccount(MarketplaceProvider provider, String keycloakId, UserRole role, MarketplaceProvisioningJobs.Claim claim) {
        txTemplate.executeWithoutResult(status -> persistAccountInTransaction(provider, keycloakId, role, claim));
    }

    private void persistAccountInTransaction(MarketplaceProvider provider, String keycloakId, UserRole role, MarketplaceProvisioningJobs.Claim claim) {
        persistAccountInTransaction(provider, keycloakId, role, claim, true);
    }

    private void persistAccountInTransaction(MarketplaceProvider provider, String keycloakId, UserRole role,
                                            MarketplaceProvisioningJobs.Claim claim, boolean needsActivation) {
        jobs.requireClaim(provider.getId(), claim.token());
        MarketplaceProvider fresh = (needsActivation ? providerRepository.findById(provider.getId())
            : providerRepository.findForErasure(provider.getId())).orElseThrow();
        assertStillEligible(fresh, provider);
        User user = new User();
        user.setFirstName(firstNameOf(provider));
        user.setLastName(lastNameOf(provider));
        user.setEmail(provider.getEmail());
        user.setPhoneNumber(provider.getPhone());
        user.setKeycloakId(keycloakId);
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        // L'adresse a servi a echanger avec le candidat pendant l'instruction :
        // la marquer verifiee serait une affirmation que rien n'appuie.
        user.setEmailVerified(!needsActivation);
        user.setCompanyName(provider.getLegalName());
        user.setCity(provider.getBaseCity());
        user.setPostalCode(provider.getBasePostalCode());
        user.setAcceptedTermsAt(provider.getTermsAcceptedAt());
        user = userRepository.save(user);

        // Sa propre organisation : un independant travaille pour qui il veut, et
        // le rattachement a un tiers reste une decision separee.
        Organization organization = organizationService.createForUser(
            user,
            provider.getLegalName() != null && !provider.getLegalName().isBlank()
                ? provider.getLegalName()
                : provider.getDisplayName(),
            OrganizationType.INDIVIDUAL);

        // RELECTURE dans la transaction, et non sauvegarde de `provider`.
        //
        // Incident : cette methode s'execute dans un `afterCommit`, ou le
        // contexte de persistance d'origine est ENCORE lie au thread. L'instance
        // recue vient de ce contexte et date d'avant l'annonce de decision, qui
        // s'est executee juste avant dans sa propre transaction. La sauvegarder
        // telle quelle fait un merge de TOUS ses champs — et remet
        // `decision_sent_at` a NULL alors que le courriel est parti. La fiche
        // repartait donc pour une seconde annonce au changement d'etat suivant.
        fresh.setUserId(user.getId());
        if (fresh.getHomeOrganizationId() == null) {
            fresh.setHomeOrganizationId(organization.getId());
        }
        if (needsActivation) deliveries.enqueue(fresh);
        providerRepository.save(fresh);
        // L'appelant lit encore `provider` apres coup (adresse, nom) : on garde
        // les deux instances coherentes.
        provider.setUserId(user.getId());

        transferDocuments(fresh.getId(), user.getId(), organization.getId());
        log.info("Fiche {} : compte {} et organisation {} crees",
            fresh.getId(), user.getId(), organization.getId());
    }

    // ─── Reprise des pieces ──────────────────────────────────────────────────

    /**
     * Les justificatifs changent de proprietaire.
     *
     * <p>Les deux champs bougent ENSEMBLE : la contrainte
     * {@code ck_provider_documents_single_owner} impose un proprietaire et un
     * seul, et laisser les deux renseignes ferait compter la piece deux fois.</p>
     */
    private void transferDocuments(Long providerId, Long userId, Long organizationId) {
        List<ProviderDocument> documents =
            documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(providerId);
        for (ProviderDocument document : documents) {
            document.setUserId(userId);
            document.setMarketplaceProviderId(null);
            document.setOrganizationId(organizationId);
        }
        documentRepository.saveAll(documents);
        if (!documents.isEmpty()) {
            log.info("{} justificatif(s) transferes de la candidature {} vers le compte {}",
                documents.size(), providerId, userId);
        }
    }

    // ─── Details ─────────────────────────────────────────────────────────────

    private void assertStillEligible(MarketplaceProvider fresh, MarketplaceProvider original) {
        if (fresh.getUserId() != null || fresh.getStatus() != com.clenzy.marketplace.model.ProviderStatus.ACTIVE
                || !fresh.isEmailConfirmed() || !java.util.Objects.equals(fresh.getEmail(), original.getEmail())) {
            throw new IllegalStateException("La candidature a changé pendant l'ouverture du compte");
        }
    }

    private static String primaryCategory(MarketplaceProvider provider) {
        return provider.getOffers().stream()
            .findFirst()
            .map(MarketplaceProviderOffer::getCategory)
            .map(category -> category.getCode())
            .orElse(null);
    }

    /**
     * Prenom et nom du compte.
     *
     * <p>{@code User} impose {@code @NotBlank} ET {@code @Size(2..50)} sur les
     * deux. Un candidat qui n'a nomme aucun contact n'en a pourtant pas : poser
     * une chaine vide faisait echouer la persistance en bloc, apres la creation
     * du compte Keycloak — l'ouverture entiere etait perdue pour un nom absent.</p>
     *
     * <p>Repli : le nom AFFICHE est scinde sur son premier espace. C'est ce que
     * tout le monde lit de toute facon, et cela donne deux parts non vides. La
     * troncature a 50 est imposee par la contrainte, pas choisie : un nom
     * commercial peut aller jusqu'a 150.</p>
     */
    private static String firstNameOf(MarketplaceProvider provider) {
        String value = trimToNull(provider.getContactFirstName());
        if (value != null) return fit(value);

        String display = trimToNull(provider.getDisplayName());
        if (display == null) return "Contact";
        int space = display.indexOf(' ');
        return fit(space > 1 ? display.substring(0, space) : display);
    }

    private static String lastNameOf(MarketplaceProvider provider) {
        String value = trimToNull(provider.getContactLastName());
        if (value != null) return fit(value);

        String display = trimToNull(provider.getDisplayName());
        if (display == null) return "Baitly";
        int space = display.indexOf(' ');
        // Nom affiche d'un seul mot : il sert des deux cotes. Inelegant, mais
        // honnete — et preferable a une ouverture de compte perdue.
        return fit(space > 1 ? display.substring(space + 1) : display);
    }

    /** Ajuste aux bornes de {@code User} : au moins 2 caracteres, au plus 50. */
    private static String fit(String value) {
        String trimmed = value.trim();
        if (trimmed.length() > 50) {
            trimmed = trimmed.substring(0, 50).trim();
        }
        return trimmed.length() >= 2 ? trimmed : (trimmed + "..").substring(0, 2);
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
