package com.clenzy.service.regulatory;

import com.clenzy.dto.TouristTaxSuggestionDto;
import com.clenzy.model.FrTouristTaxRate;
import com.clenzy.model.MaTouristTaxRate;
import com.clenzy.model.Property;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;
import com.clenzy.repository.MaTouristTaxRateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Optional;

/**
 * Suggestion de bareme de taxe de sejour pour un logement, selon son pays.
 *
 * <ul>
 *   <li><b>France</b> : commune deduite de l'adresse (BAN), tarif delibere (DGFiP DELTA),
 *       surtaxes legales d'Ile-de-France ; exoneration des moins de 18 ans ; la plateforme
 *       qui encaisse collecte la taxe (CGCT L2333-34).</li>
 *   <li><b>Maroc</b> : aucune source centrale. Tarif de la ville s'il est connu, sinon
 *       fourchette legale (art. 70 loi 47-06 modifiee) avec le HAUT de la fourchette par
 *       defaut — l'option prudente ; exoneration des moins de 12 ans ; les plateformes ne
 *       collectent pas, l'hote collecte et reverse chaque trimestre.</li>
 * </ul>
 */
@Service
public class TouristTaxReferenceService {

    private final FrCommuneResolver communeResolver;
    private final FrTouristTaxReferenceService frReference;
    private final MaTouristTaxRateRepository maRepository;
    private final Clock clock;

    public TouristTaxReferenceService(FrCommuneResolver communeResolver,
                                      FrTouristTaxReferenceService frReference,
                                      MaTouristTaxRateRepository maRepository,
                                      Clock clock) {
        this.communeResolver = communeResolver;
        this.frReference = frReference;
        this.maRepository = maRepository;
        this.clock = clock;
    }

    /**
     * @param category categorie dans le vocabulaire du pays ({@link FrTouristTaxRate.Category}
     *                 ou {@link MaTouristTaxRate.Category})
     */
    @Transactional
    public Optional<TouristTaxSuggestionDto> suggest(String countryCode, String address, String postalCode,
                                                     String city, String category) {
        String country = countryCode == null ? "" : countryCode.trim().toUpperCase(Locale.ROOT);
        return switch (country) {
            case "FR" -> suggestFrance(address, postalCode, city, category);
            case "MA" -> suggestMorocco(city, category);
            default -> Optional.empty();
        };
    }

    private Optional<TouristTaxSuggestionDto> suggestFrance(String address, String postalCode, String city,
                                                            String category) {
        Property probe = new Property();
        probe.setCountryCode("FR");
        probe.setAddress(address);
        probe.setPostalCode(postalCode);
        probe.setCity(city);
        Optional<String> insee = communeResolver.resolve(probe);
        if (insee.isEmpty()) {
            return Optional.empty();
        }
        FrTouristTaxRate.Category cat = FrTouristTaxRate.Category.valueOf(category);
        return frReference.suggest(insee.get(), cat, LocalDate.now(clock).getYear())
                .map(s -> new TouristTaxSuggestionDto("FR", s.inseeCode(), s.communeName(), s.category(),
                        s.calculationMode(), s.ratePerPerson(), s.percentageRate(), s.capPerPersonNight(),
                        s.departmentalSurchargePct(), s.regionalSurchargePct(), 18,
                        null, null, true, true, true, "EUR",
                        s.source() + " — délibération " + s.sourceYear(),
                        "https://data.economie.gouv.fr/explore/dataset/delta_deliberation_ts_tarif0/"));
    }

    Optional<TouristTaxSuggestionDto> suggestMorocco(String city, String category) {
        MaTouristTaxRate.Category cat = MaTouristTaxRate.Category.valueOf(category);
        Optional<MaTouristTaxRate> legal = maRepository.findByCityKeyAndCategory(MaTouristTaxRate.NATIONAL, cat);
        Optional<MaTouristTaxRate> local = maRepository.findByCityKeyAndCategory(cityKey(city), cat)
                .filter(r -> r.getRate() != null);
        if (local.isEmpty() && legal.isEmpty()) {
            return Optional.empty();
        }
        MaTouristTaxRate source = local.orElseGet(legal::get);
        return Optional.of(new TouristTaxSuggestionDto(
                "MA",
                null,
                local.map(MaTouristTaxRate::getCityLabel).orElse(city),
                cat.name(),
                TaxCalculationMode.PER_PERSON_PER_NIGHT,
                // Tarif communal connu, sinon le HAUT de la fourchette : sous-collecter engage l'hôte.
                local.map(MaTouristTaxRate::getRate).orElse(legal.get().getMaxRate()),
                null, null, null, null,
                12,
                legal.map(MaTouristTaxRate::getMinRate).orElse(null),
                legal.map(MaTouristTaxRate::getMaxRate).orElse(null),
                local.isPresent(),
                source.isVerified(),
                false,
                "MAD",
                source.getSourceLabel(),
                source.getSourceUrl()));
    }

    /** {@code "Casablanca "} → {@code "casablanca"} ; accents et espaces normalises. */
    static String cityKey(String city) {
        if (city == null) {
            return "";
        }
        return Normalizer.normalize(city, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .trim().toLowerCase(Locale.ROOT).replaceAll("[\\s'’-]+", "-");
    }
}
