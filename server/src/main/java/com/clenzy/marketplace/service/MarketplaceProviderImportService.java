package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.*;
import com.clenzy.util.PiiMasker;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Reprise des comptes prestataires existants dans le catalogue.
 *
 * <h2>Le probleme</h2>
 * <p>Les intervenants inscrits avant la place de marche vivent dans
 * {@code users}, avec leurs prix dans {@code provider_tariffs}.
 * Les calendriers et les zones restent portés par l'identité individuelle, jamais par leur équipe
 * PERSONNELLE, et leurs pieces dans {@code provider_documents}. Rien de tout
 * cela n'atteint le catalogue : sans reprise, l'ecran reste vide alors que la
 * plateforme compte deja des professionnels.</p>
 *
 * <h2>Deux regles qui gouvernent tout</h2>
 * <ol>
 *   <li><b>On n'ecrase jamais.</b> Un champ deja renseigne sur la fiche est
 *       laisse tel quel : l'import comble les trous, il ne rejoue pas par-dessus
 *       le travail de l'equipe. C'est ce qui le rend rejouable sans degat.</li>
 *   <li><b>On ne fabrique pas de credit.</b> La fiche reprise n'est pas
 *       « verifiee » : personne n'a controle ses pieces au titre du catalogue.
 *       {@code verifiedAt} reste vide, et le mode d'engagement par defaut la
 *       garde rattachee a son organisation plutot que de l'offrir aux
 *       autres — un intervenant recrute par une conciergerie n'a jamais
 *       consenti a etre propose a ses concurrentes.</li>
 * </ol>
 */
@Service
public class MarketplaceProviderImportService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceProviderImportService.class);

    private final MarketplaceImportRepository importRepository;
    private final MarketplaceProviderRepository providerRepository;
    private final MarketplaceServiceCategoryRepository categoryRepository;
    private final MarketplaceServiceItemRepository serviceItemRepository;
    private final Clock clock;

    public MarketplaceProviderImportService(MarketplaceImportRepository importRepository,
                                            MarketplaceProviderRepository providerRepository,
                                            MarketplaceServiceCategoryRepository categoryRepository,
                                            MarketplaceServiceItemRepository serviceItemRepository,
                                            Clock clock) {
        this.importRepository = importRepository;
        this.providerRepository = providerRepository;
        this.categoryRepository = categoryRepository;
        this.serviceItemRepository = serviceItemRepository;
        this.clock = clock;
    }

    /**
     * Bilan d'un import.
     *
     * @param created   fiches creees
     * @param enriched  fiches existantes dont des champs vides ont ete combles
     * @param unchanged fiches deja completes
     * @param skipped   comptes ecartes (sans adresse, ou adresse deja portee par
     *                  une autre fiche)
     */
    public record ImportReport(int created, int enriched, int unchanged, int skipped,
                               List<String> skippedReasons) {}

    /** Comptes prestataires n'ayant pas encore de fiche. Alimente le bandeau de l'ecran. */
    @Transactional(readOnly = true)
    public long countImportable() {
        List<User> candidates = importRepository.findProviderUsers(ProviderCategoryMapper.PROVIDER_ROLES);
        if (candidates.isEmpty()) return 0;

        Set<Long> linked = providerRepository.findAll().stream()
            .map(MarketplaceProvider::getUserId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        return candidates.stream()
            .filter(u -> !linked.contains(u.getId()))
            .filter(u -> u.getEmail() != null && !u.getEmail().isBlank())
            .count();
    }

    @Transactional
    public ImportReport importExistingProviders(EngagementMode defaultMode) {
        List<User> candidates = importRepository.findProviderUsers(ProviderCategoryMapper.PROVIDER_ROLES);
        if (candidates.isEmpty()) {
            return new ImportReport(0, 0, 0, 0, List.of());
        }

        List<Long> userIds = candidates.stream().map(User::getId).toList();

        // Tout est charge par lot : un import de plusieurs centaines de comptes
        // qui lirait tarifs, zones et pieces compte par compte ferait des
        // milliers d'allers-retours.
        Sources sources = loadSources(userIds);

        // Indexe par EMPREINTE et non par courriel : la colonne est chiffree, et
        // deux ecritures de la meme adresse donnent deux ciphertexts differents.
        Map<Long, MarketplaceProvider> byUserId = new HashMap<>();
        Map<String, MarketplaceProvider> byEmailHash = new HashMap<>();
        for (MarketplaceProvider existing : providerRepository.findAll()) {
            if (existing.getUserId() != null) byUserId.put(existing.getUserId(), existing);
            if (existing.getEmailHash() != null) byEmailHash.put(existing.getEmailHash(), existing);
        }

        Map<String, MarketplaceServiceCategory> categories = categoryRepository.findAll().stream()
            .collect(Collectors.toMap(MarketplaceServiceCategory::getCode, Function.identity(), (a, b) -> a));
        // Le catalogue entier tient en memoire (deux cent dix lignes) : le relire
        // par offre aurait fait une requete par prestation creee.
        Map<String, MarketplaceServiceItem> serviceItems = serviceItemRepository.findAll().stream()
            .collect(Collectors.toMap(MarketplaceServiceItem::getCode, Function.identity(), (a, b) -> a));

        int created = 0, enriched = 0, unchanged = 0, skipped = 0;
        List<String> skippedReasons = new ArrayList<>();
        Set<String> claimedHashes = new HashSet<>(byEmailHash.keySet());
        LocalDateTime now = LocalDateTime.now(clock);

        for (User user : candidates) {
            String email = user.getEmail() == null ? null : user.getEmail().trim().toLowerCase(Locale.ROOT);
            if (email == null || email.isEmpty()) {
                skipped++;
                skippedReasons.add("Compte " + user.getId() + " : aucune adresse e-mail");
                continue;
            }

            MarketplaceProvider provider = byUserId.get(user.getId());
            boolean isNew = false;

            if (provider == null) {
                // Une candidature deposee depuis le site public par la meme
                // personne est RATTACHEE plutot que doublee : sans cela,
                // l'unicite de l'adresse ferait echouer l'import entier sur un
                // seul doublon.
                String emailHash = StringUtils.computeEmailHash(email);
                provider = byEmailHash.get(emailHash);
                if (provider == null) {
                    if (claimedHashes.contains(emailHash)) {
                        skipped++;
                        // L'adresse est masquee : ce motif remonte a l'ecran et dans les
                        // journaux, ou une adresse en clair n'a rien a faire.
                        skippedReasons.add("Compte " + user.getId() + " : adresse "
                            + PiiMasker.maskEmail(email) + " deja portee par une autre fiche");
                        continue;
                    }
                    provider = new MarketplaceProvider();
                    provider.setEmail(email);
                    provider.setSource(ProviderSource.INVITATION);
                    provider.setSubmittedAt(user.getCreatedAt());
                    provider.setStatus(statusFor(user));
                    provider.setEngagementMode(defaultMode);
                    provider.setActivatedAt(provider.getStatus() == ProviderStatus.ACTIVE ? now : null);
                    isNew = true;
                    claimedHashes.add(emailHash);
                }
            }

            boolean touched = fillIdentity(provider, user);
            touched |= fillOrganization(provider, user, defaultMode);
            touched |= fillCompliance(provider, sources.documentsByUser.getOrDefault(user.getId(), List.of()));
            touched |= fillReputation(provider, sources.completedByUser.getOrDefault(user.getId(), 0L));
            touched |= fillOffers(provider, user, sources, categories, serviceItems);

            if (isNew) {
                providerRepository.save(provider);
                created++;
            } else if (touched) {
                providerRepository.save(provider);
                enriched++;
            } else {
                unchanged++;
            }
        }

        log.info("Import place de marche : {} creees, {} enrichies, {} inchangees, {} ignorees",
            created, enriched, unchanged, skipped);
        return new ImportReport(created, enriched, unchanged, skipped, skippedReasons);
    }

    // ─── Remplissage, champ par champ ────────────────────────────────────────

    /**
     * Identite. Le nom affiche prefere la raison sociale : c'est sous ce nom
     * qu'une societe de menage se fait connaitre, pas sous celui de la personne
     * qui a ouvert le compte.
     */
    private boolean fillIdentity(MarketplaceProvider provider, User user) {
        boolean touched = false;
        String fullName = join(user.getFirstName(), user.getLastName());
        String display = isBlank(user.getCompanyName()) ? fullName : user.getCompanyName().trim();

        if (isBlank(provider.getDisplayName()) && !isBlank(display)) {
            provider.setDisplayName(display);
            touched = true;
        }
        // Un compte sans nom ni societe reste nommable par son adresse : une
        // carte sans titre serait impossible a distinguer des autres.
        if (isBlank(provider.getDisplayName())) {
            provider.setDisplayName(user.getEmail());
            touched = true;
        }
        touched |= setIfBlank(provider::getLegalName, provider::setLegalName, user.getCompanyName());
        touched |= setIfBlank(provider::getContactFirstName, provider::setContactFirstName, user.getFirstName());
        touched |= setIfBlank(provider::getContactLastName, provider::setContactLastName, user.getLastName());
        touched |= setIfBlank(provider::getPhone, provider::setPhone, user.getPhoneNumber());
        // La PHOTO n'est volontairement PAS recopiee.
        //
        // `users.profile_picture_url` ne contient pas une URL mais une CLEF DE
        // STOCKAGE (`users/61/uuid.jpg`) : servie telle quelle a une balise
        // <img>, elle casse. Et meme convertie, une copie figee se desynchronise
        // des que la personne change sa photo. La fiche pointe donc vers le
        // compte (`userId`) et l'avatar est resolu a la LECTURE, par l'URL
        // signee du compte — la photo suit son proprietaire par construction.
        // `avatarUrl` reste reserve aux fiches SANS compte (candidatures
        // deposees depuis le site public).
        touched |= setIfBlank(provider::getBaseCity, provider::setBaseCity, user.getCity());
        touched |= setIfBlank(provider::getBasePostalCode, provider::setBasePostalCode, user.getPostalCode());

        if (isBlank(provider.getHeadline())) {
            provider.setHeadline(ProviderCategoryMapper.defaultOfferLabel(user.getRole()));
            touched = true;
        }
        return touched;
    }

    /**
     * Organisation porteuse.
     *
     * <p>Le mode d'engagement n'est pose qu'a la creation : le modifier a chaque
     * import annulerait la decision prise sur une fiche par l'equipe.</p>
     */
    private boolean fillOrganization(MarketplaceProvider provider, User user, EngagementMode defaultMode) {
        boolean touched = false;
        if (provider.getUserId() == null) {
            provider.setUserId(user.getId());
            touched = true;
        }
        if (provider.getHomeOrganizationId() == null && user.getOrganizationId() != null) {
            provider.setHomeOrganizationId(user.getOrganizationId());
            // Un mode « rattache » sans organisation serait refuse par la
            // moderation ; il ne devient tenable qu'une fois le lien pose.
            if (defaultMode != EngagementMode.INDEPENDENT) {
                provider.setEngagementMode(defaultMode);
            }
            touched = true;
        }
        return touched;
    }

    /** Echeances des pieces validees. La plus lointaine par type fait foi. */
    private boolean fillCompliance(MarketplaceProvider provider, List<ProviderDocument> documents) {
        boolean touched = false;
        for (ProviderDocument document : documents) {
            switch (document.getDocumentType()) {
                case LIABILITY_INSURANCE -> {
                    if (provider.getInsuranceExpiresAt() == null) {
                        provider.setInsuranceExpiresAt(document.getExpiresAt());
                        touched = true;
                    }
                }
                case URSSAF_VIGILANCE -> {
                    if (provider.getVigilanceExpiresAt() == null) {
                        provider.setVigilanceExpiresAt(document.getExpiresAt());
                        touched = true;
                    }
                }
                default -> { /* Kbis et piece d'identite n'ont pas d'echeance suivie. */ }
            }
        }
        return touched;
    }

    /**
     * Missions terminees.
     *
     * <p>Le compteur est repris, la NOTE ne l'est pas : rien dans le produit ne
     * note encore un intervenant, et inventer une moyenne donnerait a la fiche
     * une credibilite que personne n'a accordee.</p>
     */
    private boolean fillReputation(MarketplaceProvider provider, long completedMissions) {
        if (completedMissions <= 0 || provider.getCompletedMissions() > 0) return false;
        provider.setCompletedMissions((int) Math.min(completedMissions, Integer.MAX_VALUE));
        return true;
    }

    /**
     * Prestations et prix.
     *
     * <p>N'agit que sur une fiche SANS aucune prestation : completer une liste
     * deja remplie y reinjecterait a chaque import les lignes que l'equipe a
     * volontairement retirees.</p>
     */
    private boolean fillOffers(MarketplaceProvider provider, User user, Sources sources,
                               Map<String, MarketplaceServiceCategory> categories,
                               Map<String, MarketplaceServiceItem> serviceItems) {
        if (!provider.getOffers().isEmpty()) return false;

        int order = 0;

        for (ProviderTariff tariff : sources.tariffsByUser.getOrDefault(user.getId(), List.of())) {
            var item = serviceItems.get(tariff.getServiceKey());
            var category = item != null ? item.getCategory() : categories.get(ProviderCategoryMapper.forRole(user.getRole()));
            if (category == null) continue;
            var offer = offer(provider, category, item,
                item != null ? item.getLabelFr() : tariff.getServiceKey(),
                PricingModel.ON_QUOTE, null, order++);
            // Référence au prix vivant : jamais de copie monétaire.
            offer.setTariff(tariff);
            provider.getOffers().add(offer);
        }

        if (provider.getOffers().isEmpty()) {
            // Aucun tarif declare : on pose la prestation du metier, sur devis.
            // Une fiche sans metier serait invisible du filtre le plus utilise.
            var category = categories.get(ProviderCategoryMapper.forRole(user.getRole()));
            if (category != null) {
                var item = serviceItems.get(ProviderCategoryMapper.defaultServiceItemCode(user.getRole()));
                provider.getOffers().add(offer(provider, category, item,
                    item != null ? item.getLabelFr() : ProviderCategoryMapper.defaultOfferLabel(user.getRole()),
                    PricingModel.ON_QUOTE, null, order));
            }
        }

        return !provider.getOffers().isEmpty();
    }

    // ─── Chargement par lot ──────────────────────────────────────────────────

    private record Sources(
        Map<Long, List<ProviderTariff>> tariffsByUser,
        Map<Long, List<ProviderDocument>> documentsByUser,
        Map<Long, Long> completedByUser
    ) {}

    private Sources loadSources(List<Long> userIds) {
        var tariffs = importRepository.findProviderTariffs(userIds).stream()
            .collect(Collectors.groupingBy(ProviderTariff::getUserId));

        var documents = importRepository.findApprovedDocumentsWithExpiry(userIds).stream()
            .collect(Collectors.groupingBy(ProviderDocument::getUserId));

        Map<Long, Long> completedByUser = new HashMap<>();
        for (Object[] row : importRepository.countCompletedInterventionsByUser(userIds)) {
            if (row[0] != null) {
                completedByUser.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }

        return new Sources(tariffs,
            documents, completedByUser);
    }

    // ─── Utilitaires ─────────────────────────────────────────────────────────

    private MarketplaceProviderOffer offer(MarketplaceProvider provider,
                                           MarketplaceServiceCategory category,
                                           MarketplaceServiceItem serviceItem,
                                           String label, PricingModel model,
                                           BigDecimal amount, int order) {
        var offer = new MarketplaceProviderOffer();
        offer.setProvider(provider);
        offer.setCategory(category);
        // Rattache au catalogue quand la correspondance est certaine : sans ce
        // lien, la fiche reprise reste invisible du filtre par prestation.
        offer.setServiceItem(serviceItem);
        offer.setLabel(label);
        offer.setPricingModel(model);
        offer.setAmount(model.requiresAmount() && amount != null && amount.signum() > 0 ? amount : null);
        if (offer.getAmount() == null) offer.setPricingModel(PricingModel.ON_QUOTE);
        offer.setCurrency(provider.getCurrency());
        offer.setSortOrder(order);
        return offer;
    }

    /**
     * Un compte suspendu ou inactif n'arrive pas publie : sa fiche reprendrait
     * sa place au catalogue alors que la personne ne travaille plus.
     */
    private static ProviderStatus statusFor(User user) {
        return user.getStatus() == UserStatus.ACTIVE
            ? ProviderStatus.ACTIVE
            : ProviderStatus.SUSPENDED;
    }

    private static String labelOf(String interventionType) {
        InterventionType type = InterventionType.fromString(interventionType);
        return type == null ? interventionType : type.getDisplayName();
    }

    private static boolean setIfBlank(java.util.function.Supplier<String> getter,
                                      java.util.function.Consumer<String> setter,
                                      String candidate) {
        if (!isBlank(getter.get()) || isBlank(candidate)) return false;
        setter.accept(candidate.trim());
        return true;
    }

    private static String join(String first, String last) {
        return ((first == null ? "" : first.trim()) + " " + (last == null ? "" : last.trim())).trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
