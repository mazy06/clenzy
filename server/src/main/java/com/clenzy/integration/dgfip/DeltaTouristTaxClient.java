package com.clenzy.integration.dgfip;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Client du referentiel officiel des tarifs de taxe de sejour : jeu DELTA de la DGFiP
 * « Tarifs taxe de sejour » ({@code delta_deliberation_ts_tarif0}) sur
 * data.economie.gouv.fr (API Explore v2.1, sans authentification, Licence Ouverte).
 *
 * <p>Une commune s'y identifie par son departement + son numero de commune (le code INSEE
 * coupe en 2 + 3). Les deliberations y restent en vigueur tant qu'une nouvelle ne les
 * remplace pas : il n'y a pas forcement de ligne pour l'annee en cours.</p>
 *
 * <p>Hote FIXE (configuration), jamais derive d'une saisie : le code INSEE est valide
 * strictement avant d'entrer dans la requete — pas de SSRF ni d'injection ODSQL.</p>
 */
@Component
public class DeltaTouristTaxClient {

    private static final Logger log = LoggerFactory.getLogger(DeltaTouristTaxClient.class);
    private static final Pattern INSEE = Pattern.compile("^(\\d{5}|2[AB]\\d{3})$");
    static final String DATASET_PATH = "/api/explore/v2.1/catalog/datasets/delta_deliberation_ts_tarif0/records";
    private static final int PAGE = 100;
    /** Garde-fou : une commune compte quelques dizaines de lignes par annee. */
    private static final int MAX_ROWS = 1000;

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public DeltaTouristTaxClient(RestTemplate restTemplate,
                                 @Value("${clenzy.tourist-tax.delta-url:https://data.economie.gouv.fr}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl;
    }

    /** Une ligne du referentiel (un tarif pour une categorie d'hebergement et une annee). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DeltaRow(
            @JsonProperty("departement") String departement,
            @JsonProperty("commune") String commune,
            @JsonProperty("libelle_commune") String libelleCommune,
            @JsonProperty("date_effet") String dateEffet,
            @JsonProperty("date_fin") String dateFin,
            @JsonProperty("hebergement") String hebergement,
            @JsonProperty("regime") String regime,
            @JsonProperty("tarif") BigDecimal tarif,
            @JsonProperty("unite") String unite,
            @JsonProperty("taxe_add_dep") String taxeAddDep,
            @JsonProperty("taxe_add_article_l_2531_17_du_code_general_des_collectivites_territoriales") String addL253117,
            @JsonProperty("taxe_add_article_l_2531_18_du_code_general_des_collectivites_territoriales") String addL253118,
            @JsonProperty("taxe_add_article_l_4332_4_du_code_general_des_collectivites_territoriales") String addL43324,
            @JsonProperty("taxe_add_article_l_4332_5_du_code_general_des_collectivites_territoriales") String addL43325,
            @JsonProperty("taxe_add_article_l_4332_6_du_code_general_des_collectivites_territoriales") String addL43326,
            @JsonProperty("siren") String siren
    ) {
        /** Annee d'effet ({@code "2025"} ou {@code "2025-01-01..."}), 0 si illisible. */
        public int effectiveYear() {
            if (dateEffet == null || dateEffet.length() < 4) {
                return 0;
            }
            try {
                return Integer.parseInt(dateEffet.substring(0, 4));
            } catch (NumberFormatException e) {
                return 0;
            }
        }

        public LocalDate effectiveTo() {
            if (dateFin == null || dateFin.length() < 10) {
                return null;
            }
            try {
                return LocalDate.parse(dateFin.substring(0, 10));
            } catch (Exception e) {
                return null;
            }
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Page(@JsonProperty("total_count") long totalCount, @JsonProperty("results") List<DeltaRow> results) {
    }

    /**
     * Toutes les lignes publiees pour une commune (toutes annees).
     *
     * @throws IllegalArgumentException code INSEE invalide
     * @throws RestClientException      referentiel injoignable
     */
    public List<DeltaRow> fetchCommune(String inseeCode) {
        if (inseeCode == null || !INSEE.matcher(inseeCode).matches()) {
            throw new IllegalArgumentException("Code INSEE invalide : " + inseeCode);
        }
        String departement = inseeCode.substring(0, 2);
        String commune = inseeCode.substring(2);
        String where = "departement=\"" + departement + "\" and commune=\"" + commune + "\"";
        List<DeltaRow> rows = new ArrayList<>();
        for (int offset = 0; offset < MAX_ROWS; offset += PAGE) {
            java.net.URI url = UriComponentsBuilder.fromUriString(baseUrl)
                    .path(DATASET_PATH)
                    .queryParam("where", where)
                    .queryParam("limit", PAGE)
                    .queryParam("offset", offset)
                    .encode()
                    .build()
                    .toUri();
            Page page = restTemplate.getForObject(url, Page.class);
            if (page == null || page.results() == null || page.results().isEmpty()) {
                break;
            }
            rows.addAll(page.results());
            if (rows.size() >= page.totalCount()) {
                break;
            }
        }
        log.info("Referentiel DGFiP DELTA : {} ligne(s) pour la commune {}", rows.size(), inseeCode);
        return rows;
    }
}
