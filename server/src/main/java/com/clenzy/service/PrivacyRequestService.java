package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Conversation;
import com.clenzy.model.Guest;
import com.clenzy.model.PrivacyRequest;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.PrivacyRequestRepository;
import com.clenzy.repository.ReservationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * M9 — demandes RGPD des voyageurs. Le cœur est {@link #executeErasure} :
 * anonymisation SÉLECTIVE et IRRÉVERSIBLE du voyageur — les PII sont purgées
 * (identité, coordonnées, contenu des messages), les données à obligation
 * légale sont CONSERVÉES avec base tracée dans le rapport (factures =
 * obligation comptable, fiches police = obligation légale, montants des
 * séjours = comptabilité). Verrou CAS RECEIVED → IN_PROGRESS : une demande
 * ne s'exécute qu'une fois, même sous double clic.
 */
@Service
public class PrivacyRequestService {

    private static final Logger log = LoggerFactory.getLogger(PrivacyRequestService.class);

    static final String ANONYMIZED_FIRST_NAME = "Voyageur";
    static final String ANONYMIZED_LAST_NAME = "anonymisé";
    static final String MESSAGE_PLACEHOLDER = "[Message supprimé — demande RGPD]";

    private final PrivacyRequestRepository privacyRequestRepository;
    private final GuestRepository guestRepository;
    private final ReservationRepository reservationRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public PrivacyRequestService(PrivacyRequestRepository privacyRequestRepository,
                                 GuestRepository guestRepository,
                                 ReservationRepository reservationRepository,
                                 ConversationRepository conversationRepository,
                                 ConversationMessageRepository conversationMessageRepository,
                                 ObjectMapper objectMapper,
                                 Clock clock) {
        this.privacyRequestRepository = privacyRequestRepository;
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
        this.conversationRepository = conversationRepository;
        this.conversationMessageRepository = conversationMessageRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public List<PrivacyRequest> list(Long orgId) {
        return privacyRequestRepository.findByOrganizationIdOrderByDueAtAsc(orgId);
    }

    /** Saisie v1 (écran admin). L'échéance légale J+30 est posée ici. */
    @Transactional
    public PrivacyRequest create(Long orgId, Long guestId, String requesterEmail,
                                 PrivacyRequest.Type type, String notes) {
        if (requesterEmail == null || requesterEmail.isBlank()) {
            throw new IllegalArgumentException("Email du demandeur requis");
        }
        if (guestId != null) {
            guestRepository.findByIdAndOrganizationId(guestId, orgId)
                    .orElseThrow(() -> new NotFoundException("Voyageur introuvable"));
        }
        final PrivacyRequest request = new PrivacyRequest();
        request.setOrganizationId(orgId);
        request.setGuestId(guestId);
        request.setRequesterEmail(requesterEmail.trim());
        request.setType(type != null ? type : PrivacyRequest.Type.ERASURE);
        request.setRequestedAt(LocalDate.now(clock));
        request.setDueAt(LocalDate.now(clock).plusDays(PrivacyRequest.LEGAL_DUE_DAYS));
        request.setNotes(notes);
        return privacyRequestRepository.save(request);
    }

    @Transactional
    public void refuse(Long id, Long orgId, String handledBy, String reason) {
        requireOwned(id, orgId);
        if (privacyRequestRepository.markRefused(id, orgId, Instant.now(clock), handledBy,
                reason != null && !reason.isBlank() ? reason : "Refusée sans motif détaillé") == 0) {
            throw new IllegalStateException("Demande déjà traitée ou en cours");
        }
    }

    /** Clôture manuelle des types traités hors système (ACCESS / RECTIFICATION). */
    @Transactional
    public void completeManually(Long id, Long orgId, String handledBy) {
        final PrivacyRequest request = requireOwned(id, orgId);
        if (request.getType() == PrivacyRequest.Type.ERASURE) {
            throw new IllegalStateException(
                    "Une demande d'effacement se clôture par son exécution, pas manuellement");
        }
        if (privacyRequestRepository.markCompletedManually(id, orgId, Instant.now(clock), handledBy) == 0) {
            throw new IllegalStateException("Demande déjà traitée ou en cours");
        }
    }

    /**
     * Effacement sélectif IRRÉVERSIBLE. Écritures DB pures (aucun effet externe) :
     * <ul>
     *   <li>Guest : identité → « Voyageur anonymisé », email/téléphone/hash/notes/
     *       identifiant canal effacés ;</li>
     *   <li>Réservations du voyageur : nom dénormalisé anonymisé — dates et montants
     *       CONSERVÉS (comptabilité) ;</li>
     *   <li>Conversations : contenu des messages purgé, aperçu vidé — la trace
     *       qu'un échange a eu lieu reste (métadonnées sans PII) ;</li>
     *   <li>CONSERVÉ (base légale dans le rapport) : factures, fiches police.</li>
     * </ul>
     */
    @Transactional
    public PrivacyRequest executeErasure(Long id, Long orgId, String handledBy) {
        final PrivacyRequest request = requireOwned(id, orgId);
        if (request.getType() != PrivacyRequest.Type.ERASURE) {
            throw new IllegalStateException("Cette demande n'est pas un effacement");
        }
        if (request.getGuestId() == null) {
            throw new IllegalStateException(
                    "Demande sans voyageur rattaché — lier la fiche voyageur avant d'effacer");
        }
        if (privacyRequestRepository.markInProgress(id, orgId, handledBy) == 0) {
            throw new IllegalStateException("Demande déjà traitée ou en cours d'exécution");
        }
        final Guest guest = guestRepository.findByIdAndOrganizationId(request.getGuestId(), orgId)
                .orElseThrow(() -> new IllegalStateException("Voyageur introuvable"));

        // 1. Fiche voyageur.
        guest.setFirstName(ANONYMIZED_FIRST_NAME);
        guest.setLastName(ANONYMIZED_LAST_NAME);
        guest.setEmail(null);
        guest.setPhone(null);
        guest.setPhoneHash(null);
        guest.setNotes(null);
        guest.setChannelGuestId(null);
        guestRepository.save(guest);

        // 2. Nom dénormalisé sur les réservations (dates/montants conservés).
        final List<Reservation> reservations = reservationRepository.findByGuestId(guest.getId());
        int reservationCount = 0;
        for (Reservation reservation : reservations) {
            if (orgId.equals(reservation.getOrganizationId())) {
                reservation.setGuestName(ANONYMIZED_FIRST_NAME + " " + ANONYMIZED_LAST_NAME);
                reservationCount++;
            }
        }
        reservationRepository.saveAll(reservations);

        // 3. Conversations : contenu purgé, aperçu vidé.
        final List<Conversation> conversations =
                conversationRepository.findByOrganizationIdAndGuestId(orgId, guest.getId());
        int messageCount = 0;
        if (!conversations.isEmpty()) {
            messageCount = conversationMessageRepository.purgeContentForConversations(
                    conversations.stream().map(Conversation::getId).toList(),
                    MESSAGE_PLACEHOLDER, ANONYMIZED_FIRST_NAME + " " + ANONYMIZED_LAST_NAME);
            for (Conversation conversation : conversations) {
                conversation.setLastMessagePreview(MESSAGE_PLACEHOLDER);
                conversation.setAiDraftReply(null);
                conversation.setAiDraftMeta(null);
            }
            conversationRepository.saveAll(conversations);
        }

        // 4. Rapport d'exécution : l'effacé ET le conservé (avec sa base légale).
        final String report = buildReport(guest.getId(), reservationCount,
                conversations.size(), messageCount);
        if (privacyRequestRepository.markCompleted(id, orgId, Instant.now(clock), report) == 0) {
            throw new IllegalStateException("Clôture de la demande impossible (état inattendu)");
        }
        log.info("RGPD : effacement exécuté org={} demande={} guest={} ({} résa, {} conversations, {} messages)",
                orgId, id, guest.getId(), reservationCount, conversations.size(), messageCount);
        request.setStatus(PrivacyRequest.Status.COMPLETED);
        request.setReport(report);
        return request;
    }

    private String buildReport(Long guestId, int reservations, int conversations, int messages) {
        final ObjectNode root = objectMapper.createObjectNode();
        root.put("guestId", guestId);
        final ObjectNode erased = root.putObject("erased");
        erased.put("guestIdentity", true);
        erased.put("reservationsAnonymized", reservations);
        erased.put("conversationsPurged", conversations);
        erased.put("messagesPurged", messages);
        root.putArray("retained")
                .add(objectMapper.createObjectNode()
                        .put("data", "factures et montants des séjours")
                        .put("basis", "obligation comptable (10 ans)"))
                .add(objectMapper.createObjectNode()
                        .put("data", "fiches police / déclarations voyageurs")
                        .put("basis", "obligation légale d'hébergeur"));
        return root.toString();
    }

    private PrivacyRequest requireOwned(Long id, Long orgId) {
        return privacyRequestRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new NotFoundException("Demande RGPD introuvable"));
    }
}
