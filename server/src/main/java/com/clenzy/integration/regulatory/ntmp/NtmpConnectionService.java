package com.clenzy.integration.regulatory.ntmp;

import com.clenzy.exception.NotFoundException;
import com.clenzy.integration.external.service.ApiKeyEncryptionService;
import com.clenzy.integration.regulatory.model.RegulatoryConnection;
import com.clenzy.integration.regulatory.model.RegulatoryProviderType;
import com.clenzy.integration.regulatory.repository.RegulatoryConnectionRepository;
import com.clenzy.model.PropertyLicense;
import com.clenzy.repository.PropertyLicenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Raccorde une organisation a la passerelle NTMP : connexion, licence, jeton.
 *
 * <p>C'est ici que se rejoignent les trois moities du probleme — le secret
 * d'agence chiffre en base, la licence du LOGEMENT qui designe l'etablissement,
 * et le cache qui evite de bruler le quota.</p>
 *
 * <p><b>Contrat audit</b> : aucun appel reseau n'est emis dans une transaction.
 * {@link #tokenFor} lit la base dans une transaction courte, la referme, PUIS
 * echange le jeton hors transaction.</p>
 */
@Service
public class NtmpConnectionService {

    private final RegulatoryConnectionRepository connections;
    private final PropertyLicenseRepository licenses;
    private final ApiKeyEncryptionService encryption;
    private final NtmpTokenProvider tokens;
    private final NtmpGatewayClient gateway;

    public NtmpConnectionService(RegulatoryConnectionRepository connections,
                                 PropertyLicenseRepository licenses,
                                 ApiKeyEncryptionService encryption,
                                 NtmpTokenProvider tokens,
                                 NtmpGatewayClient gateway) {
        this.connections = connections;
        this.licenses = licenses;
        this.encryption = encryption;
        this.tokens = tokens;
        this.gateway = gateway;
    }

    /** Ce qu'il faut pour appeler la passerelle au nom d'un logement. */
    public record Credentials(Long connectionId,
                              String gatewayUrl,
                              String facilityId,
                              String facilitySecret,
                              String externalLicenseId,
                              boolean sandbox) {
    }

    /**
     * Jeton utilisable pour ce logement.
     *
     * <p>Deux temps, a dessein : la lecture en base est transactionnelle, l'appel
     * a la passerelle ne l'est pas.</p>
     */
    public NtmpAccessToken tokenFor(Long organizationId, Long propertyId) {
        Credentials credentials = credentialsFor(organizationId, propertyId);
        return tokens.get(
                credentials.connectionId(),
                credentials.externalLicenseId(),
                (connectionId, licenseId) -> gateway.exchangeToken(
                        credentials.gatewayUrl(),
                        credentials.facilityId(),
                        credentials.facilitySecret(),
                        licenseId));
    }

    /**
     * Connexion de l'organisation et licence du logement, secret dechiffre.
     *
     * <p>Transaction en LECTURE et courte : elle se referme avant tout appel
     * reseau.</p>
     */
    @Transactional(readOnly = true)
    public Credentials credentialsFor(Long organizationId, Long propertyId) {
        RegulatoryConnection connection = connections
                .findByOrganizationIdAndProvider(organizationId, RegulatoryProviderType.NTMP)
                .orElseThrow(() -> new NotFoundException(
                        "Aucun raccordement NTMP pour cette organisation"));

        if (connection.getStatus() != RegulatoryConnection.Status.ACTIVE) {
            throw new IllegalStateException(
                    "Raccordement NTMP inactif : " + connection.getStatus());
        }

        return new Credentials(
                connection.getId(),
                connection.getGatewayUrl(),
                connection.getFacilityId(),
                encryption.decrypt(connection.getFacilitySecretEncrypted()),
                tourismLicenseNumber(propertyId, organizationId),
                connection.isSandbox());
    }

    /**
     * Numero de licence d'exploitation touristique du logement.
     *
     * <p>C'est LUI que la passerelle attend en {@code externalLicenseId}, pas
     * l'identifiant Baitly. Un logement sans licence ne se declare pas : mieux
     * vaut echouer ici, avec un message qui nomme le logement, qu'envoyer une
     * declaration anonyme que le ministere rejettera.</p>
     */
    private String tourismLicenseNumber(Long propertyId, Long organizationId) {
        return licenses.findByPropertyIdAndOrganizationIdOrderByExpiresAtAsc(propertyId, organizationId)
                .stream()
                .filter(license -> license.getLicenseType() == PropertyLicense.LicenseType.TOURISM_REGISTRATION)
                .map(PropertyLicense::getLicenseNumber)
                .filter(number -> number != null && !number.isBlank())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Logement " + propertyId + " sans licence d'exploitation touristique : "
                                + "impossible de le declarer a la NTMP"));
    }

    /** Le secret a change : les jetons obtenus avec l'ancien ne valent plus rien. */
    public void forget(Long connectionId) {
        tokens.evict(connectionId);
    }
}
