package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.ProviderApplicationRequest;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.marketplace.repository.MarketplaceServiceCategoryRepository;
import com.clenzy.marketplace.repository.MarketplaceServiceItemRepository;
import com.clenzy.service.UserService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Depot d'une candidature depuis le site public.
 *
 * <h2>Ce que le client n'a PAS le droit de decider</h2>
 * <p>Le statut, la source, l'organisation porteuse, le compte utilisateur, la
 * verification et les agregats de reputation sont fixes par le SERVEUR. Les
 * laisser au contrat d'entree aurait permis a n'importe qui de s'auto-publier
 * au catalogue avec quatre etoiles et deux cents missions.</p>
 *
 * <p>Une candidature arrive donc toujours en {@link ProviderStatus#PENDING_REVIEW}
 * et attend la moderation ({@link MarketplaceModerationService}).</p>
 */
@Service
public class MarketplaceApplicationService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceApplicationService.class);

    /** Une candidature ne peut pas declarer plus de prestations, zones ou creneaux que cela. */
    private static final int MAX_OFFERS = 40;
    private static final int MAX_ZONES = 40;
    private static final int MAX_SLOTS = 60;

    private final MarketplaceProviderRepository providerRepository;
    private final MarketplaceServiceCategoryRepository categoryRepository;
    private final MarketplaceServiceItemRepository serviceItemRepository;
    private final MarketplaceNotificationOutbox notifications;
    private final Clock clock;

    public MarketplaceApplicationService(MarketplaceProviderRepository providerRepository,
                                         MarketplaceServiceCategoryRepository categoryRepository,
                                         MarketplaceServiceItemRepository serviceItemRepository,
                                         MarketplaceNotificationOutbox notifications,
                                         Clock clock) {
        this.providerRepository = providerRepository;
        this.categoryRepository = categoryRepository;
        this.serviceItemRepository = serviceItemRepository;
        this.notifications = notifications;
        this.clock = clock;
    }

    /**
     * Duree pendant laquelle un candidat peut revenir deposer ses pieces.
     *
     * <p>Reunir un Kbis et une attestation de vigilance prend des jours — une
     * poignee d'heures condamnerait la plupart des dossiers a rester
     * incomplets. Trente jours couvre le delai reel sans laisser un acces
     * ouvert indefiniment.</p>
     */
    private static final Duration UPLOAD_WINDOW = Duration.ofDays(30);

    /**
     * Recu remis au candidat.
     *
     * @param uploadToken jeton EN CLAIR, montre une seule fois : la base n'en
     *                    garde que l'empreinte, et il n'est plus recuperable
     *                    apres cette reponse.
     */
    public record Receipt(Long id, String uploadToken) {}

    /**
     * Marque l'adresse comme prouvee.
     *
     * <p>Idempotent : re-cliquer le lien d'un courriel ne doit pas produire une
     * erreur. Le jeton est consomme — il ne sert qu'une fois, et le garder
     * laisserait une seconde voie ouverte pour rien.</p>
     *
     * @return {@code false} si aucun dossier ne correspond a ce jeton
     */
    @Transactional
    public boolean confirmEmail(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        MarketplaceProvider provider = providerRepository
            .findByEmailConfirmTokenHash(MarketplaceUploadTokens.hash(token))
            .orElse(null);
        if (provider == null) {
            return false;
        }
        if (!provider.isEmailConfirmed()) {
            provider.setEmailConfirmedAt(LocalDateTime.now(clock));
        }
        provider.setEmailConfirmTokenHash(null);
        providerRepository.save(provider);
        log.info("Adresse confirmee pour la fiche {}", provider.getId());
        return true;
    }

    /** Levee lorsqu'une adresse a deja une fiche : l'appelant la traduit en 409. */
    public static class DuplicateApplicationException extends RuntimeException {
        public DuplicateApplicationException(String message) { super(message); }
    }

    /**
     * @param clientIp adresse resolue par l'appelant. Fait partie de la PREUVE
     *                 d'acceptation : sans elle, il ne reste qu'une date et une
     *                 version, ce qui ne demontre rien.
     */
    @Transactional
    public Receipt apply(ProviderApplicationRequest request, String clientIp) {
        if (!request.acceptedTerms()) {
            throw new IllegalArgumentException("Les conditions prestataire doivent être acceptées.");
        }

        // La version annoncee par le formulaire doit etre la version COURANTE.
        // Un formulaire garde en cache montrerait un ancien texte, et la preuve
        // enregistree designerait alors le mauvais document — pire qu'aucune
        // preuve, parce qu'elle aurait l'air valable.
        String announced = request.termsVersion();
        if (announced != null && !announced.isBlank()
            && !UserService.PROVIDER_TERMS_VERSION.equals(announced.trim())) {
            throw new IllegalArgumentException(
                "Les conditions ont changé depuis l'ouverture du formulaire. Rechargez la page.");
        }

        String email = request.email().trim().toLowerCase(Locale.ROOT);
        // Le controle porte sur l'empreinte : la colonne `email` est chiffree et
        // ne se compare pas.
        if (providerRepository.existsByEmailHash(StringUtils.computeEmailHash(email))) {
            throw new DuplicateApplicationException("Une candidature existe déjà pour cette adresse.");
        }

        MarketplaceProvider provider = new MarketplaceProvider();
        provider.setDisplayName(request.displayName().trim());
        provider.setLegalName(trimToNull(request.legalName()));
        provider.setContactFirstName(trimToNull(request.contactFirstName()));
        provider.setContactLastName(trimToNull(request.contactLastName()));
        provider.setEmail(email);
        provider.setPhone(trimToNull(request.phone()));
        provider.setWebsite(trimToNull(request.website()));
        provider.setHeadline(trimToNull(request.headline()));
        provider.setBio(trimToNull(request.bio()));

        provider.setBaseAddress(trimToNull(request.baseAddress()));
        provider.setBaseCity(trimToNull(request.baseCity()));
        provider.setBasePostalCode(trimToNull(request.basePostalCode()));
        provider.setBaseCountryCode(normalizeCountry(request.baseCountryCode()));
        provider.setTravelRadiusKm(request.travelRadiusKm());
        provider.setLanguages(joinLanguages(request.languages()));
        provider.setRegistrationNumber(trimToNull(request.registrationNumber()));

        // Decide par le serveur, jamais par le formulaire.
        provider.setStatus(ProviderStatus.PENDING_REVIEW);
        provider.setSource(ProviderSource.LANDING);
        provider.setEngagementMode(EngagementMode.INDEPENDENT);
        provider.setSubmittedAt(LocalDateTime.now(clock));

        // La preuve, en trois morceaux indissociables.
        provider.setTermsVersion(UserService.PROVIDER_TERMS_VERSION);
        provider.setTermsAcceptedAt(LocalDateTime.now(clock));
        provider.setTermsAcceptedIp(trimToNull(clientIp));

        // Le jeton de depot est emis AVEC la candidature : les pieces sont ce
        // qui permet de la juger, les demander plus tard revient a decider sans
        // elles.
        String uploadToken = MarketplaceUploadTokens.generate();
        provider.setUploadTokenHash(MarketplaceUploadTokens.hash(uploadToken));
        provider.setUploadTokenExpiresAt(LocalDateTime.now(clock).plus(UPLOAD_WINDOW));

        // Preuve de l'adresse. Sans elle, n'importe qui candidate au nom d'un
        // tiers et l'acceptation creerait un compte sur son adresse.
        String confirmToken = MarketplaceUploadTokens.generate();
        provider.setEmailConfirmTokenHash(MarketplaceUploadTokens.hash(confirmToken));

        attachOffers(provider, request.offers());
        attachZones(provider, request.zones());
        attachAvailability(provider, request.availability());

        try {
            MarketplaceProvider saved = providerRepository.saveAndFlush(provider);
            log.info("Candidature place de marche recue : id={} categories={}",
                saved.getId(), saved.getOffers().size());

            // Apres le commit : prevenir l'equipe passe par un courriel, donc un
            // appel externe, qui n'a rien a faire dans la transaction. Et rien
            // ne doit etre annonce si l'enregistrement echoue finalement.
            notifications.enqueue(saved.getId(), "APPLICATION_EMAIL", String.valueOf(saved.getOffers().size()), null, null);
            notifications.enqueue(saved.getId(), "APPLICATION_STAFF", null, null, null);
            notifications.enqueue(saved.getId(), "CONFIRMATION", confirmToken, null, null);

            return new Receipt(saved.getId(), uploadToken);
        } catch (DataIntegrityViolationException e) {
            // L'unicite en base tranche la course entre deux soumissions
            // simultanees : le controle prealable seul serait un
            // verifier-puis-agir, et laisserait passer un doublon.
            throw new DuplicateApplicationException("Une candidature existe déjà pour cette adresse.");
        }
    }

    // ─── Rattachement des collections ────────────────────────────────────────

    private void attachOffers(MarketplaceProvider provider, List<ProviderApplicationRequest.OfferInput> inputs) {
        if (inputs == null || inputs.isEmpty()) return;
        requireBounded(inputs, MAX_OFFERS, "prestations");

        List<String> codes = inputs.stream()
            .map(ProviderApplicationRequest.OfferInput::categoryCode)
            .filter(c -> c != null && !c.isBlank())
            .map(String::trim)
            .distinct()
            .toList();
        Map<String, MarketplaceServiceCategory> byCode = categoryRepository.findByCodeIn(codes).stream()
            .collect(Collectors.toMap(MarketplaceServiceCategory::getCode, Function.identity()));

        // Une seule requete pour tout le formulaire : resoudre prestation par
        // prestation ferait quarante allers-retours sur une surface publique.
        List<String> itemCodes = inputs.stream()
            .map(ProviderApplicationRequest.OfferInput::serviceItemCode)
            .filter(c -> c != null && !c.isBlank())
            .map(String::trim)
            .distinct()
            .toList();
        Map<String, MarketplaceServiceItem> itemsByCode = itemCodes.isEmpty()
            ? Map.of()
            : serviceItemRepository.findByCodeIn(itemCodes).stream()
                .collect(Collectors.toMap(MarketplaceServiceItem::getCode, Function.identity()));

        int order = 0;
        for (var input : inputs) {
            MarketplaceServiceCategory category = byCode.get(trimToNull(input.categoryCode()));
            // Categorie inconnue : la ligne est ignoree plutot que de faire
            // echouer toute la candidature. Un referentiel evolue, et un code
            // perime dans un formulaire mis en cache ne doit pas couter le
            // dossier entier.
            if (category == null) throw new IllegalArgumentException("Catégorie inconnue : rechargez le catalogue.");

            var offer = new MarketplaceProviderOffer();
            offer.setProvider(provider);
            offer.setCategory(category);

            // La prestation ne se rattache que si elle appartient BIEN au metier
            // annonce : sinon le formulaire pourrait ranger « Massage » sous
            // « Serrurerie » et fausser tous les comptes par prestation.
            // La clef est testee AVANT la recherche : Map.of() refuse une clef
            // nulle jusque dans get(), et la plupart des lignes n'en portent pas.
            String itemCode = trimToNull(input.serviceItemCode());
            MarketplaceServiceItem item = itemCode == null ? null : itemsByCode.get(itemCode);
            if (itemCode != null && (item == null || !item.getCategory().getCode().equals(category.getCode())))
                throw new IllegalArgumentException("Prestation inconnue ou incompatible avec la catégorie.");
            if (item != null) {
                offer.setServiceItem(item);
            }

            if (trimToNull(input.label()) == null) throw new IllegalArgumentException("Libellé de prestation requis.");
            offer.setLabel(input.label().trim());
            offer.setDescription(trimToNull(input.description()));
            offer.setPricingModel(parsePricingModel(input.pricingModel()));
            offer.setCurrency(normalizeCurrency(input.currency()));
            offer.setUnitLabel(trimToNull(input.unitLabel()));
            offer.setMinDurationMinutes(input.minDurationMinutes());
            // Un montant negatif est refuse en silence : il ne vient jamais
            // d'une saisie legitime.
            if (offer.getPricingModel().requiresAmount()) {
                if (input.amount() == null || input.amount().signum() < 0)
                    throw new IllegalArgumentException("Montant de prestation invalide.");
                offer.setAmount(input.amount());
            }
            offer.setSortOrder(order++);
            provider.getOffers().add(offer);
        }
    }

    private void attachZones(MarketplaceProvider provider, List<ProviderApplicationRequest.ZoneInput> inputs) {
        if (inputs == null) return;
        requireBounded(inputs, MAX_ZONES, "zones");
        for (var input : inputs) {
            String country = normalizeCountry(input.countryCode());
            if ("FR".equals(country) ? trimToNull(input.department()) == null : trimToNull(input.city()) == null)
                throw new IllegalArgumentException("Indiquez un département en France ou une ville dans les autres pays.");
            var zone = new MarketplaceProviderZone();
            zone.setProvider(provider);
            zone.setCountryCode(normalizeCountry(input.countryCode()));
            zone.setDepartment(trimToNull(input.department()));
            zone.setCity(trimToNull(input.city()));
            zone.setPostalCode(trimToNull(input.postalCode()));
            zone.setRadiusKm(input.radiusKm());
            zone.setPrimary(input.primary());
            provider.getZones().add(zone);
        }
    }

    private void attachAvailability(MarketplaceProvider provider,
                                    List<ProviderApplicationRequest.AvailabilityInput> inputs) {
        if (inputs == null) return;
        requireBounded(inputs, MAX_SLOTS, "créneaux");
        for (var input : inputs) {
            if (input.dayOfWeek() < 1 || input.dayOfWeek() > 7)
                throw new IllegalArgumentException("Jour de disponibilité invalide.");
            LocalTime start = parseTime(input.startTime());
            LocalTime end = parseTime(input.endTime());
            // Un creneau qui finit avant de commencer n'est pas une plage :
            // l'ecarter vaut mieux que stocker une disponibilite vide qui
            // passerait pour une declaration.
            if (start == null || end == null || !end.isAfter(start))
                throw new IllegalArgumentException("Le créneau doit avoir une fin après son début.");

            var slot = new MarketplaceProviderAvailability();
            slot.setProvider(provider);
            slot.setDayOfWeek(input.dayOfWeek());
            slot.setStartTime(start);
            slot.setEndTime(end);
            provider.getAvailability().add(slot);
        }
    }

    // ─── Normalisation ───────────────────────────────────────────────────────

    private static PricingModel parsePricingModel(String raw) {
        if (raw == null || raw.isBlank()) return PricingModel.ON_QUOTE;
        try {
            return PricingModel.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Modèle de tarification inconnu.");
        }
    }

    private static void requireBounded(List<?> inputs, int max, String label) {
        if (inputs.size() > max || inputs.stream().anyMatch(java.util.Objects::isNull))
            throw new IllegalArgumentException("Liste de " + label + " invalide.");
    }

    private static LocalTime parseTime(String raw) {
        try {
            return LocalTime.parse(raw.trim());
        } catch (DateTimeParseException | NullPointerException e) {
            return null;
        }
    }

    private static String normalizeCountry(String raw) {
        String value = trimToNull(raw);
        if (value != null && !value.matches("[a-zA-Z]{2}"))
            throw new IllegalArgumentException("Code pays invalide.");
        return value == null ? "FR" : value.toUpperCase(Locale.ROOT);
    }

    private static String normalizeCurrency(String raw) {
        String value = trimToNull(raw);
        String currency = value == null ? "EUR" : value.toUpperCase(Locale.ROOT);
        java.util.Currency.getInstance(currency);
        return currency;
    }

    /** Codes ISO 639-1 uniquement : deux lettres, le reste est ecarte. */
    private static String joinLanguages(List<String> languages) {
        if (languages == null || languages.isEmpty()) return null;
        String joined = languages.stream()
            .filter(l -> l != null && l.trim().length() == 2)
            .map(l -> l.trim().toLowerCase(Locale.ROOT))
            .distinct()
            .limit(10)
            .collect(Collectors.joining(","));
        return joined.isEmpty() ? null : joined;
    }

    private static String trimToNull(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
