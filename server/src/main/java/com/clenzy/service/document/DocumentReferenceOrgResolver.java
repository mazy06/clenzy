package com.clenzy.service.document;

import com.clenzy.model.ReferenceType;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Résout l'organisation propriétaire d'une référence documentaire, <b>depuis la base</b>.
 *
 * <h2>Pourquoi ce composant existe</h2>
 * <p>Audit 2026-07 (P1-03) : {@code DocumentEventService} lisait {@code organizationId},
 * {@code referenceId} et {@code emailTo} dans le payload Kafka, et les transmettait tels
 * quels au générateur — <b>sans jamais vérifier que la référence appartenait à cette
 * organisation</b>. Un événement forgé sur le topic {@code documents.generate} suffisait
 * donc à faire générer la facture d'un autre tenant et à l'expédier à une adresse
 * arbitraire. Le broker étant en {@code PLAINTEXT} sans ACL, et Kafka-UI ayant été exposé
 * en écriture, ce n'était pas théorique.</p>
 *
 * <p>Le patron appliqué ici est celui que trois connecteurs suivaient déjà correctement
 * ({@code BookingCalendarService}, {@code AirbnbMessageService}, {@code MinutWebhookConsumer}) :
 * <b>ne jamais faire confiance à l'identifiant d'organisation d'un événement, le
 * re-dériver de l'entité référencée</b>. Le payload ne sert plus que de contrôle de
 * cohérence.</p>
 *
 * <p>Lecture volontairement non scopée par tenant : on cherche justement à savoir
 * <i>à qui</i> appartient la référence. C'est l'appelant qui décide ensuite quoi en faire.</p>
 */
@Component
public class DocumentReferenceOrgResolver {

    private static final Logger log = LoggerFactory.getLogger(DocumentReferenceOrgResolver.class);

    private final InterventionRepository interventionRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;
    private final ProviderExpenseRepository providerExpenseRepository;
    private final ServiceQuoteRepository serviceQuoteRepository;
    private final ReceivedFormRepository receivedFormRepository;
    private final ManagementContractRepository managementContractRepository;

    public DocumentReferenceOrgResolver(InterventionRepository interventionRepository,
                                        ServiceRequestRepository serviceRequestRepository,
                                        PropertyRepository propertyRepository,
                                        UserRepository userRepository,
                                        ReservationRepository reservationRepository,
                                        ProviderExpenseRepository providerExpenseRepository,
                                        ReceivedFormRepository receivedFormRepository,
                                        ManagementContractRepository managementContractRepository,
                                        ServiceQuoteRepository serviceQuoteRepository) {
        this.interventionRepository = interventionRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.reservationRepository = reservationRepository;
        this.providerExpenseRepository = providerExpenseRepository;
        this.receivedFormRepository = receivedFormRepository;
        this.managementContractRepository = managementContractRepository;
        this.serviceQuoteRepository = serviceQuoteRepository;
    }

    /**
     * @return l'organisation propriétaire de la référence, ou {@link Optional#empty()} si la
     *         référence n'existe pas ou ne porte pas d'organisation — dans les deux cas
     *         l'appelant doit refuser de traiter l'événement (fail-closed).
     */
    @Transactional(readOnly = true)
    public Optional<Long> resolve(ReferenceType referenceType, Long referenceId) {
        if (referenceType == null || referenceId == null) {
            return Optional.empty();
        }
        Optional<Long> organizationId = switch (referenceType) {
            case INTERVENTION -> interventionRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
            case SERVICE_REQUEST -> serviceRequestRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
            case PROPERTY -> propertyRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
            case USER -> userRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
            case RESERVATION -> reservationRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
            case PROVIDER_EXPENSE -> providerExpenseRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
            case SERVICE_QUOTE -> serviceQuoteRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
            case RECEIVED_FORM -> receivedFormRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
            case MANAGEMENT_CONTRACT -> managementContractRepository.findById(referenceId)
                    .map(e -> e.getOrganizationId());
        };

        if (organizationId.isEmpty()) {
            log.warn("Reference documentaire {}#{} introuvable ou sans organisation — "
                    + "generation refusee", referenceType, referenceId);
        }
        return organizationId;
    }
}
