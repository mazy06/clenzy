package com.clenzy.service;

import com.clenzy.dto.ContactMessageDto;
import com.clenzy.dto.ContactThreadSummaryDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.ContactMessage;
import com.clenzy.model.ContactMessageCategory;
import com.clenzy.model.ContactMessagePriority;
import com.clenzy.model.ContactMessageStatus;
import com.clenzy.model.ContactThread;
import com.clenzy.model.ContactThreadParticipant;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.User;
import com.clenzy.repository.ContactMessageRepository;
import com.clenzy.repository.ContactThreadParticipantRepository;
import com.clenzy.repository.ContactThreadRepository;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Fils de discussion de GROUPE de la messagerie de contact.
 *
 * <p>Un {@link ContactMessage} porte un expediteur et un destinataire : les
 * conversations de l'ecran Contacts n'etaient qu'un regroupement par
 * interlocuteur. Reunir trois personnes autour d'un meme sujet — un devis
 * adresse au proprietaire ET a la conciergerie — donnait deux echanges
 * paralleles, chacun ignorant l'autre.</p>
 *
 * <p>Ici la visibilite vient de la PARTICIPATION, pas du destinataire. Les
 * echanges un-a-un ne changent pas : leur {@code threadId} reste NULL.</p>
 */
@Service
@Transactional
public class ContactThreadService {

    private static final Logger log = LoggerFactory.getLogger(ContactThreadService.class);

    /** Rien n'a encore ete lu : tout message du fil compte comme non lu. */
    private static final LocalDateTime NEVER_READ = LocalDateTime.of(1970, 1, 1, 0, 0);

    /** Prefixe de la cle exposee au front — l'ecran adresse un fil comme un interlocuteur. */
    public static final String GROUP_KEY_PREFIX = "group:";

    private final ContactThreadRepository threadRepository;
    private final ContactThreadParticipantRepository participantRepository;
    private final ContactMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ContactMessageEventPublisher eventPublisher;

    public ContactThreadService(ContactThreadRepository threadRepository,
                                ContactThreadParticipantRepository participantRepository,
                                ContactMessageRepository messageRepository,
                                UserRepository userRepository,
                                NotificationService notificationService,
                                ContactMessageEventPublisher eventPublisher) {
        this.threadRepository = threadRepository;
        this.participantRepository = participantRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
    }

    /** `group:12` → 12 ; toute autre cle designe un echange un-a-un. */
    public static Long parseGroupKey(String key) {
        if (key == null || !key.startsWith(GROUP_KEY_PREFIX)) return null;
        try {
            return Long.valueOf(key.substring(GROUP_KEY_PREFIX.length()));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static String groupKey(Long threadId) {
        return GROUP_KEY_PREFIX + threadId;
    }

    // ── Creation ────────────────────────────────────────────────────────────

    /**
     * Ouvre le fil de cet objet metier, ou rend celui deja ouvert.
     *
     * <p>Idempotent par {@code (org, referenceType, referenceId)} : un second
     * devis sur la meme intervention n'ouvre pas un second fil, il poursuit la
     * discussion — c'est le meme sujet pour les memes personnes.</p>
     */
    public ContactThread openThread(Long orgId, String subject, ContactMessageCategory category,
                                    String creatorKeycloakId, String referenceType, Long referenceId,
                                    Collection<String> participantKeycloakIds) {
        Optional<ContactThread> existing = referenceType != null && referenceId != null
                ? threadRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(orgId, referenceType, referenceId)
                : Optional.empty();

        ContactThread thread = existing.orElseGet(() -> {
            ContactThread created = new ContactThread();
            created.setOrganizationId(orgId);
            created.setSubject(subject);
            created.setCategory(category != null ? category : ContactMessageCategory.GENERAL);
            created.setCreatedByKeycloakId(creatorKeycloakId);
            created.setReferenceType(referenceType);
            created.setReferenceId(referenceId);
            return threadRepository.save(created);
        });

        // Le createur participe toujours : sans lui, il ecrirait dans un fil
        // qu'il ne verrait pas.
        Set<String> everyone = new LinkedHashSet<>();
        everyone.add(creatorKeycloakId);
        if (participantKeycloakIds != null) {
            participantKeycloakIds.stream().filter(id -> id != null && !id.isBlank()).forEach(everyone::add);
        }
        for (String keycloakId : everyone) {
            addParticipant(thread.getId(), keycloakId);
        }
        return thread;
    }

    private void addParticipant(Long threadId, String keycloakId) {
        if (participantRepository.existsByThreadIdAndKeycloakId(threadId, keycloakId)) {
            return;
        }
        ContactThreadParticipant participant = new ContactThreadParticipant();
        participant.setThreadId(threadId);
        participant.setKeycloakId(keycloakId);
        userRepository.findByKeycloakId(keycloakId).ifPresent(user -> {
            participant.setFirstName(user.getFirstName());
            participant.setLastName(user.getLastName());
            participant.setEmail(user.getEmail());
        });
        participantRepository.save(participant);
    }

    // ── Ecriture ────────────────────────────────────────────────────────────

    /**
     * Poste dans le fil. Le message n'a pas de destinataire : il s'adresse a
     * tous les participants, et chacun le recoit en notification.
     */
    public ContactMessage post(ContactThread thread, String senderKeycloakId,
                               String subject, String body, ContactMessagePriority priority) {
        return post(thread, senderKeycloakId, subject, body, priority, null);
    }

    /** Variante portant une carte structuree (devis, intervention). */
    public ContactMessage post(ContactThread thread, String senderKeycloakId,
                               String subject, String body, ContactMessagePriority priority,
                               String payload) {
        if (!participantRepository.existsByThreadIdAndKeycloakId(thread.getId(), senderKeycloakId)) {
            throw new AccessDeniedException("Vous ne participez pas a cette discussion");
        }
        User sender = userRepository.findByKeycloakId(senderKeycloakId).orElse(null);

        ContactMessage message = new ContactMessage();
        message.setThreadId(thread.getId());
        message.setOrganizationId(thread.getOrganizationId());
        message.setSenderKeycloakId(senderKeycloakId);
        message.setSenderFirstName(sender != null ? safe(sender.getFirstName()) : "");
        message.setSenderLastName(sender != null ? safe(sender.getLastName()) : "");
        message.setSenderEmail(sender != null ? safe(sender.getEmail()) : "");
        message.setSubject(subject != null ? subject : thread.getSubject());
        message.setMessage(body);
        message.setPriority(priority != null ? priority : ContactMessagePriority.MEDIUM);
        message.setCategory(thread.getCategory());
        message.setStatus(ContactMessageStatus.SENT);
        message.setPayload(payload);
        message = messageRepository.save(message);

        thread.setLastMessageAt(LocalDateTime.now());
        threadRepository.save(thread);

        notifyParticipants(thread, senderKeycloakId, sender);

        // Les fils de GROUPE ne publiaient aucun evenement temps reel : ni ce
        // service ni le controleur ne touchaient au courtier. Les participants
        // ne voyaient donc le message qu'au sondage suivant — jusqu'a une
        // minute. On emet sur la meme destination que les messages de contact
        // 1 a 1, celle que le client ecoute deja.
        eventPublisher.publishNewMessage(message, ContactMessageDto.fromEntity(message));
        return message;
    }

    private void notifyParticipants(ContactThread thread, String senderKeycloakId, User sender) {
        String senderName = sender != null
                ? (safe(sender.getFirstName()) + " " + safe(sender.getLastName())).trim()
                : "";
        for (ContactThreadParticipant participant : participantRepository.findByThreadId(thread.getId())) {
            if (participant.getKeycloakId().equals(senderKeycloakId)) continue;
            try {
                notificationService.notify(participant.getKeycloakId(),
                        NotificationKey.CONTACT_MESSAGE_RECEIVED,
                        senderName.isBlank() ? "Nouveau message" : "Nouveau message de " + senderName,
                        thread.getSubject(),
                        "/contact?thread=" + groupKey(thread.getId()));
            } catch (Exception e) {
                // Une notification qui echoue ne doit pas perdre le message.
                log.warn("Notification du fil {} impossible pour {} : {}",
                        thread.getId(), participant.getKeycloakId(), e.getMessage());
            }
        }
    }

    // ── Lecture ─────────────────────────────────────────────────────────────

    /** Fils de groupe visibles par l'appelant. */
    @Transactional(readOnly = true)
    public List<ContactThreadSummaryDto> listMyThreads(String userId, boolean archived) {
        List<ContactThreadParticipant> mine =
                participantRepository.findByKeycloakIdAndArchived(userId, archived);
        if (mine.isEmpty()) return List.of();

        List<Long> threadIds = mine.stream().map(ContactThreadParticipant::getThreadId).toList();
        Map<Long, ContactThreadParticipant> myParticipation = mine.stream()
                .collect(Collectors.toMap(ContactThreadParticipant::getThreadId, p -> p, (a, b) -> a));
        Map<Long, List<ContactThreadParticipant>> byThread =
                participantRepository.findByThreadIdIn(threadIds).stream()
                        .collect(Collectors.groupingBy(ContactThreadParticipant::getThreadId));

        List<ContactThreadSummaryDto> summaries = new ArrayList<>();
        for (ContactThread thread : threadRepository.findByIdInOrderByLastMessageAtDesc(threadIds)) {
            List<ContactMessage> messages = messageRepository.findByThreadIdOrderByCreatedAtAsc(thread.getId());
            ContactMessage last = messages.isEmpty() ? null : messages.get(messages.size() - 1);
            ContactThreadParticipant me = myParticipation.get(thread.getId());
            long unread = messageRepository.countUnreadInThread(thread.getId(), userId,
                    me != null && me.getLastReadAt() != null ? me.getLastReadAt() : NEVER_READ);

            List<String> names = byThread.getOrDefault(thread.getId(), List.of()).stream()
                    .map(ContactThreadParticipant::displayName).toList();

            summaries.add(new ContactThreadSummaryDto(
                    groupKey(thread.getId()), null,
                    "", "", "", null, null,
                    last != null ? preview(last.getMessage()) : null,
                    thread.getLastMessageAt(),
                    unread, messages.size(),
                    thread.getId(), thread.getSubject(), names));
        }
        return summaries;
    }

    /** Total des messages non lus dans MES fils de groupe. */
    @Transactional(readOnly = true)
    public long countMyUnread(String userId) {
        return participantRepository.findByKeycloakIdAndArchived(userId, false).stream()
                .mapToLong(participant -> messageRepository.countUnreadInThread(
                        participant.getThreadId(), userId,
                        participant.getLastReadAt() != null ? participant.getLastReadAt() : NEVER_READ))
                .sum();
    }

    @Transactional(readOnly = true)
    public List<ContactMessageDto> messages(Long threadId, String userId) {
        requireParticipant(threadId, userId);
        return messageRepository.findByThreadIdOrderByCreatedAtAsc(threadId).stream()
                .map(ContactMessageDto::fromEntity).toList();
    }

    public int markAsRead(Long threadId, String userId) {
        ContactThreadParticipant me = requireParticipant(threadId, userId);
        long unread = messageRepository.countUnreadInThread(threadId, userId,
                me.getLastReadAt() != null ? me.getLastReadAt() : NEVER_READ);
        me.setLastReadAt(LocalDateTime.now());
        participantRepository.save(me);
        return (int) unread;
    }

    /** L'archivage est PAR participant : les autres gardent le fil. */
    public void setArchived(Long threadId, String userId, boolean archived) {
        ContactThreadParticipant me = requireParticipant(threadId, userId);
        me.setArchived(archived);
        participantRepository.save(me);
    }

    /** Le fil deja ouvert pour cet objet metier, s'il existe. */
    @Transactional(readOnly = true)
    public Optional<ContactThread> findByReference(Long orgId, String referenceType, Long referenceId) {
        return threadRepository.findByOrganizationIdAndReferenceTypeAndReferenceId(
                orgId, referenceType, referenceId);
    }

    @Transactional(readOnly = true)
    public ContactThread requireThread(Long threadId) {
        return threadRepository.findById(threadId)
                .orElseThrow(() -> new NotFoundException("Discussion introuvable : " + threadId));
    }

    private ContactThreadParticipant requireParticipant(Long threadId, String userId) {
        return participantRepository.findByThreadIdAndKeycloakId(threadId, userId)
                .orElseThrow(() -> new AccessDeniedException("Vous ne participez pas a cette discussion"));
    }

    private static String preview(String message) {
        if (message == null) return null;
        String flat = message.replaceAll("\\s+", " ").trim();
        return flat.length() > 120 ? flat.substring(0, 117) + "..." : flat;
    }

    private static String safe(String value) {
        return value != null ? value : "";
    }
}
