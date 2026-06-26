package com.clenzy.integration.compliance.submission.chekin;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.submission.ComplianceSubmissionStrategy;
import com.clenzy.integration.compliance.submission.SubmissionResult;
import com.clenzy.model.GuestDeclaration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

import java.util.HashMap;
import java.util.Map;

/**
 * Stratégie de soumission Chekin — intégration HTTP réelle.
 *
 * <p>Flux : (1) échange de la clé API déchiffrée contre un JWT temporaire, puis
 * (2) {@code POST /guests} avec les données d'identité de la déclaration. Tout est
 * exécuté hors transaction DB (appelé par l'orchestrateur en post-commit).</p>
 *
 * <h2>Ce qui est « grounded » (doc publique Chekin)</h2>
 * <ul>
 *   <li>Schéma d'auth : clé API → JWT, en-tête {@code Authorization: JWT &lt;token&gt;}.</li>
 *   <li>API v1, HTTPS, ressources Reservations/Housing/Police/Guests, {@code POST /guests}.</li>
 *   <li>Base d'URL : prise de {@code connection.serverUrl} (configurable, défauts prod/staging documentés).</li>
 * </ul>
 *
 * <h2>Ce qui est configurable / à confirmer</h2>
 * <p>Les <b>noms de champs</b> du payload guest et le chemin exact d'échange de token ne sont
 * pas publiés de façon fiable. On mappe vers les noms les plus standards (snake_case) mais on
 * NE devine PAS de champ critique manquant : la {@code housing}/{@code reservation} cible côté
 * Chekin est portée par {@code accountIdentifier} de la connexion (id du logement Chekin). Si
 * l'API rejette le payload (4xx), l'erreur remonte telle quelle dans le {@link SubmissionResult}
 * — jamais avalée.</p>
 */
@Service
public class ChekinComplianceSubmissionStrategy implements ComplianceSubmissionStrategy {

    private static final Logger log = LoggerFactory.getLogger(ChekinComplianceSubmissionStrategy.class);

    private final ChekinApiClient client;

    public ChekinComplianceSubmissionStrategy(ChekinApiClient client) {
        this.client = client;
    }

    @Override
    public ComplianceProviderType provider() {
        return ComplianceProviderType.CHEKIN;
    }

    @Override
    public SubmissionResult submit(GuestDeclaration declaration, ComplianceConnection connection, String apiKey) {
        final String baseUrl = connection.getServerUrl();
        try {
            String token = client.exchangeApiKeyForToken(
                    baseUrl, ChekinApiClient.DEFAULT_TOKEN_PATH, apiKey);

            Map<String, Object> payload = buildGuestPayload(declaration, connection);
            String externalId = client.createGuest(
                    baseUrl, ChekinApiClient.DEFAULT_GUEST_PATH, token, payload);

            log.info("Chekin: déclaration {} transmise (guest externe={})", declaration.getId(), externalId);
            return SubmissionResult.accepted(externalId, "Déclaration transmise à Chekin");
        } catch (RestClientResponseException e) {
            // Rejet/erreur HTTP du provider : tracé explicitement, jamais avalé.
            String msg = "Chekin a rejeté la déclaration (HTTP " + e.getStatusCode().value() + ")";
            log.warn("Chekin: échec soumission déclaration {} — {} : {}",
                    declaration.getId(), msg, e.getResponseBodyAsString());
            return SubmissionResult.rejected(msg);
        }
    }

    /**
     * Mappe {@link GuestDeclaration} → payload guest Chekin. La déclaration arrive avec ses PII
     * déjà déchiffrées (converters JPA). Le {@code accountIdentifier} de la connexion porte l'id
     * du logement Chekin cible. Noms de champs en snake_case (standard Chekin) ; les détails
     * incertains restent isolés ici pour ajustement sans toucher au transport.
     */
    private Map<String, Object> buildGuestPayload(GuestDeclaration d, ComplianceConnection connection) {
        Map<String, Object> payload = new HashMap<>();
        putIfPresent(payload, "name", d.getFirstName());
        putIfPresent(payload, "surname", d.getLastName());
        putIfPresent(payload, "second_surname", d.getMaidenName());
        putIfPresent(payload, "birth_date", d.getBirthDate()); // ISO yyyy-MM-dd (cf. GuestDeclaration)
        putIfPresent(payload, "birth_place", d.getBirthPlace());
        putIfPresent(payload, "nationality", d.getNationality());
        putIfPresent(payload, "residence_address", d.getResidenceAddress());
        putIfPresent(payload, "residence_country", d.getResidenceCountry());
        putIfPresent(payload, "document_type", d.getIdDocumentType());
        putIfPresent(payload, "document_number", d.getIdDocumentNumber());
        // Logement / réservation Chekin cible : id externe porté par la connexion (configurable, non deviné).
        putIfPresent(payload, "housing_id", connection.getAccountIdentifier());
        return payload;
    }

    private static void putIfPresent(Map<String, Object> map, String key, String value) {
        if (value != null && !value.isBlank()) {
            map.put(key, value);
        }
    }
}
