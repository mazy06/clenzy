package com.clenzy.service;

import com.clenzy.dto.ContactAttachmentDto;
import com.clenzy.dto.ContactMessageDto;
import com.clenzy.dto.ContactUserDto;
import com.clenzy.model.*;
import com.clenzy.model.ContactAttachmentFile;
import com.clenzy.repository.ContactAttachmentFileRepository;
import com.clenzy.repository.ContactMessageRepository;
import com.clenzy.repository.ManagerUserRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.AttachmentValidator;
import com.clenzy.util.StringUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.internet.InternetAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.multipart.MultipartFile;

import com.clenzy.dto.ContactThreadSummaryDto;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ContactMessageService {

    private static final Logger log = LoggerFactory.getLogger(ContactMessageService.class);
    private static final int MAX_SUBJECT_LENGTH = 255;
    private static final int MAX_MESSAGE_LENGTH = 20000;
    private static final Set<String> RESTRICTED_ROLES = Set.of("HOST", "HOUSEKEEPER", "TECHNICIAN", "SUPERVISOR", "LAUNDRY", "EXTERIOR_TECH");

    private final ContactMessageRepository contactMessageRepository;
    private final ContactAttachmentFileRepository attachmentFileRepository;
    private final ManagerUserRepository managerUserRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final ObjectMapper objectMapper;
    private final ContactFileStorageService fileStorageService;
    private final NotificationService notificationService;
    private final TenantContext tenantContext;
    private final ContactMessageEventPublisher eventPublisher;

    @Value("${clenzy.mail.contact.max-attachments:10}")
    private int maxAttachments;

    @Value("${clenzy.mail.contact.max-attachment-size-bytes:10485760}")
    private long maxAttachmentSizeBytes;

    public ContactMessageService(
            ContactMessageRepository contactMessageRepository,
            ContactAttachmentFileRepository attachmentFileRepository,
            ManagerUserRepository managerUserRepository,
            UserRepository userRepository,
            EmailService emailService,
            ObjectMapper objectMapper,
            ContactFileStorageService fileStorageService,
            NotificationService notificationService,
            TenantContext tenantContext,
            ContactMessageEventPublisher eventPublisher
    ) {
        this.contactMessageRepository = contactMessageRepository;
        this.attachmentFileRepository = attachmentFileRepository;
        this.managerUserRepository = managerUserRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.objectMapper = objectMapper;
        this.fileStorageService = fileStorageService;
        this.notificationService = notificationService;
        this.tenantContext = tenantContext;
        this.eventPublisher = eventPublisher;
    }

    // ─── Lecture ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ContactMessageDto> listMessages(String box, Pageable pageable, Jwt jwt) {
        String userId = requireUserId(jwt);
        String normalizedBox = box == null ? "inbox" : box.trim().toLowerCase(Locale.ROOT);

        Page<ContactMessage> page = switch (normalizedBox) {
            case "inbox" -> contactMessageRepository
                    .findByRecipientKeycloakIdAndArchivedFalseOrderByCreatedAtDesc(userId, pageable);
            case "sent" -> contactMessageRepository
                    .findBySenderKeycloakIdAndArchivedFalseOrderByCreatedAtDesc(userId, pageable);
            case "archived" -> contactMessageRepository.findArchivedForUser(userId, pageable, tenantContext.getRequiredOrganizationId());
            default -> throw new IllegalArgumentException("Boite de messages invalide: " + box);
        };

        return page.map(ContactMessageDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public List<ContactUserDto> listRecipients(Jwt jwt) {
        AuthActor actor = resolveActor(jwt);
        boolean restricted = actor.roles().stream()
                .map(r -> r.toUpperCase(Locale.ROOT))
                .anyMatch(RESTRICTED_ROLES::contains);

        List<User> users;

        if (restricted && actor.dbId() != null) {
            // Roles restreints (HOST, etc.) : seulement leur(s) manager(s) assigne(s)
            Long orgId = tenantContext.getRequiredOrganizationId();
            List<Long> managerIds = managerUserRepository
                    .findManagerIdsByUserIdAndIsActiveTrue(actor.dbId(), orgId);

            if (managerIds.isEmpty()) {
                // Fallback : aucun manager assigne → retourner tous les platform staff
                users = userRepository.findByStatusAndRoleInAndKeycloakIdIsNotNullOrderByFirstNameAscLastNameAsc(
                        UserStatus.ACTIVE,
                        List.of(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER)
                );
            } else {
                // Retourner uniquement les managers assignes
                users = userRepository.findAllById(managerIds).stream()
                        .filter(u -> u.getStatus() == UserStatus.ACTIVE && u.getKeycloakId() != null)
                        .collect(Collectors.toList());
            }
        } else if (restricted) {
            // dbId null (utilisateur pas encore en base) : ancien comportement
            users = userRepository.findByStatusAndRoleInAndKeycloakIdIsNotNullOrderByFirstNameAscLastNameAsc(
                    UserStatus.ACTIVE,
                    List.of(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER)
            );
        } else {
            // Admin / Manager : retourner tous les utilisateurs actifs
            users = userRepository.findByStatusAndKeycloakIdIsNotNullOrderByFirstNameAscLastNameAsc(UserStatus.ACTIVE);
        }

        return users.stream()
                .filter(u -> !actor.userId().equals(u.getKeycloakId()))
                .map(u -> new ContactUserDto(
                        u.getKeycloakId(),
                        StringUtils.firstNonBlank(u.getFirstName(), "Utilisateur"),
                        StringUtils.firstNonBlank(u.getLastName(), ""),
                        u.getEmail(),
                        u.getRole() != null ? u.getRole().name() : "UNKNOWN"
                ))
                .collect(Collectors.toList());
    }

    /**
     * Recupere un message en validant que l'utilisateur est sender ou recipient.
     * Utilise pour le telechargement des pieces jointes.
     */
    @Transactional(readOnly = true)
    public ContactMessage getMessageForUser(Long messageId, Jwt jwt) {
        String userId = requireUserId(jwt);
        return contactMessageRepository.findByIdForUser(messageId, userId)
                .orElseThrow(() -> new NoSuchElementException("Message introuvable"));
    }

    // ─── Envoi ──────────────────────────────────────────────────────────────

    @Transactional
    public ContactMessageDto sendMessage(
            Jwt jwt,
            String recipientId,
            String subject,
            String message,
            String priority,
            String category,
            List<MultipartFile> attachments
    ) {
        AuthActor actor = resolveActor(jwt);
        ResolvedRecipient recipient = resolveRecipientOrEmail(recipientId);

        // Validation d'acces uniquement pour les utilisateurs internes
        if (!recipient.external()) {
            User recipientUser = resolveRecipient(recipientId);
            validateRecipientAccess(actor, recipientUser);
        }

        String normalizedSubject = normalizeSubject(subject);
        String normalizedMessage = normalizeMessage(message);
        ContactMessagePriority messagePriority = parsePriority(priority);
        ContactMessageCategory messageCategory = parseCategory(category);
        List<MultipartFile> sanitizedAttachments = AttachmentValidator.sanitizeAndFilter(attachments);
        AttachmentValidator.validate(sanitizedAttachments, maxAttachments, maxAttachmentSizeBytes);

        ContactMessage contactMessage = new ContactMessage();
        contactMessage.setSenderKeycloakId(actor.userId());
        contactMessage.setSenderFirstName(actor.firstName());
        contactMessage.setSenderLastName(actor.lastName());
        contactMessage.setSenderEmail(actor.email());
        contactMessage.setRecipientKeycloakId(recipient.keycloakId());
        contactMessage.setRecipientFirstName(recipient.firstName());
        contactMessage.setRecipientLastName(recipient.lastName());
        contactMessage.setRecipientEmail(recipient.email());
        contactMessage.setSubject(normalizedSubject);
        contactMessage.setMessage(normalizedMessage);
        contactMessage.setPriority(messagePriority);
        contactMessage.setCategory(messageCategory);
        contactMessage.setStatus(ContactMessageStatus.SENT);
        List<ContactAttachmentDto> attachmentMetadata = buildAttachmentMetadata(sanitizedAttachments);
        contactMessage.setAttachments(serializeAttachments(attachmentMetadata));
        contactMessage.setOrganizationId(tenantContext.getRequiredOrganizationId());

        contactMessage = contactMessageRepository.save(contactMessage);
        dispatchEmail(contactMessage, actor, sanitizedAttachments);

        // Stocker les fichiers sur disque apres l'envoi email (best-effort)
        storeAndUpdateAttachments(contactMessage, sanitizedAttachments, attachmentMetadata);

        // Notifications
        String senderName = (actor.firstName() + " " + actor.lastName()).trim();
        if (!recipient.external() && recipient.keycloakId() != null) {
            notificationService.notify(recipient.keycloakId(), NotificationKey.CONTACT_MESSAGE_RECEIVED,
                    "Nouveau message de " + senderName,
                    normalizedSubject,
                    "/contact");
        }
        notificationService.notify(actor.userId(), NotificationKey.CONTACT_MESSAGE_SENT,
                "Message envoye",
                "Votre message \"" + normalizedSubject + "\" a ete envoye avec succes",
                "/contact?tab=1");

        // Publication temps reel via WebSocket
        ContactMessageDto dto = ContactMessageDto.fromEntity(contactMessage);
        eventPublisher.publishNewMessage(contactMessage, dto);

        return dto;
    }

    @Transactional
    public ContactMessageDto replyToMessage(
            Jwt jwt,
            Long messageId,
            String messageText,
            List<MultipartFile> attachments
    ) {
        AuthActor actor = resolveActor(jwt);
        ContactMessage original = contactMessageRepository.findByIdForUser(messageId, actor.userId())
                .orElseThrow(() -> new NoSuchElementException("Message introuvable"));

        String normalizedMessage = normalizeMessage(messageText);
        List<MultipartFile> sanitizedAttachments = AttachmentValidator.sanitizeAndFilter(attachments);
        AttachmentValidator.validate(sanitizedAttachments, maxAttachments, maxAttachmentSizeBytes);

        ContactMessage reply = new ContactMessage();
        reply.setSenderKeycloakId(actor.userId());
        reply.setSenderFirstName(actor.firstName());
        reply.setSenderLastName(actor.lastName());
        reply.setSenderEmail(actor.email());

        if (actor.userId().equals(original.getSenderKeycloakId())) {
            reply.setRecipientKeycloakId(original.getRecipientKeycloakId());
            reply.setRecipientFirstName(original.getRecipientFirstName());
            reply.setRecipientLastName(original.getRecipientLastName());
            reply.setRecipientEmail(original.getRecipientEmail());
        } else {
            reply.setRecipientKeycloakId(original.getSenderKeycloakId());
            reply.setRecipientFirstName(original.getSenderFirstName());
            reply.setRecipientLastName(original.getSenderLastName());
            reply.setRecipientEmail(original.getSenderEmail());
        }

        reply.setSubject(buildReplySubject(original.getSubject()));
        reply.setMessage(normalizedMessage);
        reply.setPriority(original.getPriority());
        reply.setCategory(original.getCategory());
        reply.setStatus(ContactMessageStatus.SENT);
        List<ContactAttachmentDto> attachmentMetadata = buildAttachmentMetadata(sanitizedAttachments);
        reply.setAttachments(serializeAttachments(attachmentMetadata));
        reply.setOrganizationId(tenantContext.getRequiredOrganizationId());

        reply = contactMessageRepository.save(reply);
        dispatchEmail(reply, actor, sanitizedAttachments);

        // Stocker les fichiers sur disque apres l'envoi email (best-effort)
        storeAndUpdateAttachments(reply, sanitizedAttachments, attachmentMetadata);

        original.setStatus(ContactMessageStatus.REPLIED);
        if (original.getRepliedAt() == null) {
            original.setRepliedAt(LocalDateTime.now());
        }
        // @Transactional flushe les modifications sur original et reply au commit

        // Notification au destinataire de la reponse
        String replySenderName = (actor.firstName() + " " + actor.lastName()).trim();
        if (reply.getRecipientKeycloakId() != null && !"external".equals(reply.getRecipientKeycloakId())) {
            notificationService.notify(reply.getRecipientKeycloakId(), NotificationKey.CONTACT_MESSAGE_REPLIED,
                    "Reponse de " + replySenderName,
                    reply.getSubject(),
                    "/contact");
        }

        // Publication temps reel via WebSocket
        ContactMessageDto dto = ContactMessageDto.fromEntity(reply);
        eventPublisher.publishNewMessage(reply, dto);

        return dto;
    }

    // ─── Actions ────────────────────────────────────────────────────────────

    @Transactional
    public ContactMessageDto updateStatus(Jwt jwt, Long id, String statusValue) {
        String userId = requireUserId(jwt);
        ContactMessageStatus status = parseStatus(statusValue);
        ContactMessage message = contactMessageRepository.findByIdForUser(id, userId)
                .orElseThrow(() -> new NoSuchElementException("Message introuvable"));

        if (status == ContactMessageStatus.READ && !userId.equals(message.getRecipientKeycloakId())) {
            throw new SecurityException("Seul le destinataire peut marquer le message comme lu");
        }

        applyStatus(message, status);
        return ContactMessageDto.fromEntity(contactMessageRepository.save(message));
    }

    @Transactional
    public void deleteMessage(Jwt jwt, Long id) {
        String userId = requireUserId(jwt);
        ContactMessage message = contactMessageRepository.findByIdForUser(id, userId)
                .orElseThrow(() -> new NoSuchElementException("Message introuvable"));
        contactMessageRepository.delete(message);
    }

    @Transactional
    public Map<String, Object> bulkUpdateStatus(Jwt jwt, List<Long> ids, String statusValue) {
        String userId = requireUserId(jwt);
        ContactMessageStatus status = parseStatus(statusValue);
        List<Long> sanitizedIds = sanitizeIds(ids);
        if (sanitizedIds.isEmpty()) {
            return Map.of("updatedCount", 0);
        }

        List<ContactMessage> messages = contactMessageRepository.findByIdsForUser(sanitizedIds, userId);
        int updatedCount = 0;
        for (ContactMessage message : messages) {
            if (status == ContactMessageStatus.READ && !userId.equals(message.getRecipientKeycloakId())) {
                continue;
            }
            applyStatus(message, status);
            updatedCount++;
        }

        contactMessageRepository.saveAll(messages);
        return Map.of("updatedCount", updatedCount);
    }

    @Transactional
    public Map<String, Object> bulkDelete(Jwt jwt, List<Long> ids) {
        String userId = requireUserId(jwt);
        List<Long> sanitizedIds = sanitizeIds(ids);
        if (sanitizedIds.isEmpty()) {
            return Map.of("deletedCount", 0);
        }

        List<ContactMessage> messages = contactMessageRepository.findByIdsForUser(sanitizedIds, userId);
        int deletedCount = messages.size();
        contactMessageRepository.deleteAll(messages);
        return Map.of("deletedCount", deletedCount);
    }

    /**
     * Marque tous les messages non-lus d'un thread comme READ.
     * Seul le destinataire peut marquer ses messages comme lus (garanti par la query).
     *
     * @return le nombre de messages mis a jour
     */
    @Transactional
    public int markThreadAsRead(Jwt jwt, String counterpartKeycloakId) {
        String userId = requireUserId(jwt);
        Long orgId = tenantContext.getOrganizationId();

        List<ContactMessage> unread = contactMessageRepository
                .findUnreadThreadMessages(userId, counterpartKeycloakId, orgId);

        if (unread.isEmpty()) {
            return 0;
        }

        for (ContactMessage message : unread) {
            applyStatus(message, ContactMessageStatus.READ);
        }

        contactMessageRepository.saveAll(unread);

        // Notifier l'expediteur via WebSocket que ses messages ont ete lus
        eventPublisher.publishThreadRead(userId, counterpartKeycloakId, orgId, unread.size());

        return unread.size();
    }

    @Transactional
    public ContactMessageDto archiveMessage(Jwt jwt, Long id) {
        String userId = requireUserId(jwt);
        ContactMessage message = contactMessageRepository.findByIdForUser(id, userId)
                .orElseThrow(() -> new NoSuchElementException("Message introuvable"));
        message.setArchived(true);
        message.setArchivedAt(LocalDateTime.now());
        ContactMessageDto dto = ContactMessageDto.fromEntity(contactMessageRepository.save(message));

        notificationService.notify(userId, NotificationKey.CONTACT_MESSAGE_ARCHIVED,
                "Message archive",
                "\"" + message.getSubject() + "\" a ete archive",
                "/contact?tab=2");

        return dto;
    }

    @Transactional
    public ContactMessageDto unarchiveMessage(Jwt jwt, Long id) {
        String userId = requireUserId(jwt);
        ContactMessage message = contactMessageRepository.findByIdForUser(id, userId)
                .orElseThrow(() -> new NoSuchElementException("Message introuvable"));
        message.setArchived(false);
        message.setArchivedAt(null);
        return ContactMessageDto.fromEntity(contactMessageRepository.save(message));
    }

    // ─── Email dispatch ─────────────────────────────────────────────────────

    private void dispatchEmail(ContactMessage message, AuthActor sender, List<MultipartFile> attachments) {
        try {
            String fullRecipient = (message.getRecipientFirstName() + " " + message.getRecipientLastName()).trim();
            String fullSender = (sender.firstName() + " " + sender.lastName()).trim();

            String providerMessageId = emailService.sendContactMessage(
                    message.getRecipientEmail(),
                    fullRecipient,
                    sender.email(),
                    fullSender,
                    message.getSubject(),
                    message.getMessage(),
                    attachments
            );
            message.setProviderMessageId(providerMessageId);
            applyStatus(message, ContactMessageStatus.DELIVERED);
        } catch (Exception e) {
            log.error("Erreur d'envoi email contact #{} : {}", message.getId(), e.getMessage());
        }
    }

    private void applyStatus(ContactMessage message, ContactMessageStatus status) {
        message.setStatus(status);
        LocalDateTime now = LocalDateTime.now();
        switch (status) {
            case DELIVERED -> { if (message.getDeliveredAt() == null) message.setDeliveredAt(now); }
            case READ -> { if (message.getReadAt() == null) message.setReadAt(now); }
            case REPLIED -> { if (message.getRepliedAt() == null) message.setRepliedAt(now); }
            case SENT -> { /* pas de timestamp supplementaire */ }
        }
    }

    // ─── Threads (messagerie instantanee) ─────────────────────────────────

    /**
     * Liste des conversations groupees par interlocuteur.
     * Pour chaque paire (user, counterpart), retourne un resume
     * avec le dernier message, le compteur de non-lus et le total.
     */
    @Transactional(readOnly = true)
    public List<ContactThreadSummaryDto> getThreads(Jwt jwt) {
        String userId = requireUserId(jwt);
        Long orgId = tenantContext.getOrganizationId();

        List<ContactMessage> allMessages = contactMessageRepository.findAllForUser(userId, orgId);
        if (allMessages.isEmpty()) return List.of();

        // Grouper par interlocuteur (keycloakId de l'autre personne)
        Map<String, List<ContactMessage>> byCounterpart = new LinkedHashMap<>();
        for (ContactMessage m : allMessages) {
            String counterpartId = m.getSenderKeycloakId().equals(userId)
                    ? m.getRecipientKeycloakId()
                    : m.getSenderKeycloakId();
            byCounterpart.computeIfAbsent(counterpartId, k -> new ArrayList<>()).add(m);
        }

        List<ContactThreadSummaryDto> threads = new ArrayList<>();
        for (var entry : byCounterpart.entrySet()) {
            List<ContactMessage> msgs = entry.getValue();
            // Le premier message est le plus recent (ORDER BY createdAt DESC)
            ContactMessage latest = msgs.get(0);

            String counterpartId = entry.getKey();
            String firstName, lastName, email;
            if (latest.getSenderKeycloakId().equals(counterpartId)) {
                firstName = latest.getSenderFirstName();
                lastName = latest.getSenderLastName();
                email = latest.getSenderEmail();
            } else {
                firstName = latest.getRecipientFirstName();
                lastName = latest.getRecipientLastName();
                email = latest.getRecipientEmail();
            }

            long unreadCount = msgs.stream()
                    .filter(m -> m.getRecipientKeycloakId().equals(userId))
                    .filter(m -> m.getStatus() == ContactMessageStatus.SENT
                              || m.getStatus() == ContactMessageStatus.DELIVERED)
                    .count();

            String preview = latest.getMessage();
            if (preview != null && preview.length() > 200) {
                preview = preview.substring(0, 200) + "...";
            }

            threads.add(new ContactThreadSummaryDto(
                    counterpartId,
                    firstName != null ? firstName : "Utilisateur",
                    lastName != null ? lastName : "",
                    email != null ? email : "",
                    preview,
                    latest.getCreatedAt(),
                    unreadCount,
                    msgs.size()
            ));
        }

        return threads;
    }

    /**
     * Messages d'une conversation avec un interlocuteur, tries par date croissante (chat).
     */
    @Transactional(readOnly = true)
    public List<ContactMessageDto> getThreadMessages(Jwt jwt, String counterpartKeycloakId) {
        String userId = requireUserId(jwt);
        Long orgId = tenantContext.getOrganizationId();

        List<ContactMessage> messages = contactMessageRepository
                .findThreadMessages(userId, counterpartKeycloakId, orgId);

        return messages.stream()
                .map(ContactMessageDto::fromEntity)
                .toList();
    }

    // ─── Auth helpers ───────────────────────────────────────────────────────

    private String requireUserId(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new SecurityException("Utilisateur non authentifie");
        }
        return jwt.getSubject();
    }

    private AuthActor resolveActor(Jwt jwt) {
        String userId = requireUserId(jwt);
        User user = userRepository.findByKeycloakId(userId).orElse(null);

        String email = StringUtils.firstNonBlank(jwt.getClaimAsString("email"), user != null ? user.getEmail() : null);
        if (email.isBlank()) {
            throw new IllegalArgumentException("Email utilisateur manquant");
        }
        validateEmail(email);

        String firstName = StringUtils.firstNonBlank(
                jwt.getClaimAsString("given_name"),
                user != null ? user.getFirstName() : null,
                "Utilisateur"
        );
        String lastName = StringUtils.firstNonBlank(
                jwt.getClaimAsString("family_name"),
                user != null ? user.getLastName() : null,
                ""
        );

        List<String> roles = extractRoles(jwt);
        if (roles.isEmpty() && user != null && user.getRole() != null) {
            roles = List.of(user.getRole().name());
        }

        Long dbId = user != null ? user.getId() : null;
        return new AuthActor(dbId, userId, email, firstName, lastName, roles);
    }

    @SuppressWarnings("unchecked")
    private List<String> extractRoles(Jwt jwt) {
        try {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess == null) return List.of();
            Object roles = realmAccess.get("roles");
            if (!(roles instanceof List<?> list)) return List.of();
            return list.stream().map(String::valueOf).toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    // ─── Recipient helpers ──────────────────────────────────────────────────

    /**
     * Resout le destinataire : soit un utilisateur interne (keycloakId), soit un email externe.
     */
    private ResolvedRecipient resolveRecipientOrEmail(String recipientId) {
        if (recipientId == null || recipientId.isBlank()) {
            throw new IllegalArgumentException("Destinataire requis");
        }

        String trimmed = recipientId.trim();

        // Si c'est un email, on le traite comme destinataire externe
        if (trimmed.contains("@")) {
            validateEmail(trimmed);
            // Verifier d'abord si un utilisateur interne a cet email
            Optional<User> byEmail = userRepository.findByEmailHash(StringUtils.computeEmailHash(trimmed));
            if (byEmail.isPresent() && byEmail.get().getKeycloakId() != null) {
                return ResolvedRecipient.fromUser(byEmail.get());
            }
            return ResolvedRecipient.fromEmail(trimmed);
        }

        // Sinon, c'est un keycloakId ou un ID numerique
        User user = resolveRecipient(trimmed);
        return ResolvedRecipient.fromUser(user);
    }

    private User resolveRecipient(String recipientId) {
        if (recipientId == null || recipientId.isBlank()) {
            throw new IllegalArgumentException("Destinataire requis");
        }

        Optional<User> byKeycloakId = userRepository.findByKeycloakId(recipientId);
        User user = byKeycloakId.orElseGet(() -> {
            try {
                Long numericId = Long.valueOf(recipientId);
                return userRepository.findById(numericId).orElse(null);
            } catch (NumberFormatException ignored) {
                return null;
            }
        });

        if (user == null) {
            throw new NoSuchElementException("Destinataire introuvable");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new IllegalArgumentException("Destinataire inactif");
        }
        if (user.getKeycloakId() == null || user.getKeycloakId().isBlank()) {
            throw new IllegalArgumentException("Destinataire invalide (keycloakId manquant)");
        }
        validateEmail(user.getEmail());
        return user;
    }

    private void validateRecipientAccess(AuthActor actor, User recipient) {
        if (actor.userId().equals(recipient.getKeycloakId())) {
            throw new IllegalArgumentException("Vous ne pouvez pas vous envoyer un message a vous-meme");
        }

        boolean restricted = actor.roles().stream()
                .map(r -> r.toUpperCase(Locale.ROOT))
                .anyMatch(RESTRICTED_ROLES::contains);

        if (restricted) {
            // Les roles restreints ne peuvent ecrire qu'aux platform staff
            if (!recipient.getRole().isPlatformStaff()) {
                throw new SecurityException("Utilisateur non autorise comme destinataire");
            }
            // Verifier l'assignation manager (si le host a un manager assigne)
            if (actor.dbId() != null && recipient.getId() != null) {
                Long orgId = tenantContext.getRequiredOrganizationId();
                List<Long> managerIds = managerUserRepository
                        .findManagerIdsByUserIdAndIsActiveTrue(actor.dbId(), orgId);
                // Si des managers sont assignes, le destinataire doit en faire partie
                if (!managerIds.isEmpty() && !managerIds.contains(recipient.getId())) {
                    throw new SecurityException("Vous ne pouvez contacter que votre manager assigne");
                }
            }
        }
    }

    // ─── Attachment helpers ─────────────────────────────────────────────────

    private List<ContactAttachmentDto> buildAttachmentMetadata(List<MultipartFile> attachments) {
        List<ContactAttachmentDto> result = new ArrayList<>();
        for (MultipartFile attachment : attachments) {
            String name = StringUtils.sanitizeFileName(attachment.getOriginalFilename());
            String contentType = StringUtils.firstNonBlank(attachment.getContentType(), "application/octet-stream");
            result.add(new ContactAttachmentDto(
                    UUID.randomUUID().toString(), name, name, attachment.getSize(), contentType, null
            ));
        }
        return result;
    }

    /**
     * Stocke les fichiers en base de donnees (table contact_attachment_files)
     * et met a jour les metadonnees JSONB avec storagePath = "db".
     * Appele APRES l'envoi email pour ne pas bloquer la livraison en cas d'echec de stockage.
     */
    private void storeAndUpdateAttachments(ContactMessage message, List<MultipartFile> files,
                                            List<ContactAttachmentDto> metadata) {
        if (files.isEmpty()) return;
        try {
            List<ContactAttachmentDto> updated = new ArrayList<>();
            for (int i = 0; i < metadata.size(); i++) {
                ContactAttachmentDto dto = metadata.get(i);
                MultipartFile file = files.get(i);

                // Stocker les bytes en base de donnees
                ContactAttachmentFile attachmentFile = new ContactAttachmentFile(
                        message.getId(),
                        dto.id(),
                        file.getBytes(),
                        dto.contentType(),
                        dto.originalName(),
                        dto.size()
                );
                attachmentFileRepository.save(attachmentFile);

                updated.add(new ContactAttachmentDto(
                        dto.id(), dto.filename(), dto.originalName(), dto.size(), dto.contentType(), "db"
                ));
            }
            message.setAttachments(serializeAttachments(updated));
            // L'entite dirty sera flushee au commit de la @Transactional
        } catch (Exception e) {
            log.error("Echec du stockage des pieces jointes pour le message #{}: {}", message.getId(), e.getMessage());
            // Ne PAS relancer — l'email a deja ete envoye avec succes
        }
    }

    private String serializeAttachments(List<ContactAttachmentDto> attachments) {
        try {
            return objectMapper.writeValueAsString(attachments);
        } catch (Exception e) {
            return "[]";
        }
    }

    // ─── Validation helpers ─────────────────────────────────────────────────

    private String normalizeSubject(String subject) {
        String normalized = subject == null ? "" : subject.replaceAll("[\\r\\n]+", " ").trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Sujet requis");
        }
        return normalized.length() > MAX_SUBJECT_LENGTH
                ? normalized.substring(0, MAX_SUBJECT_LENGTH)
                : normalized;
    }

    private String normalizeMessage(String message) {
        String normalized = message == null ? "" : message.trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Message requis");
        }
        if (normalized.length() > MAX_MESSAGE_LENGTH) {
            throw new IllegalArgumentException("Message trop long (max " + MAX_MESSAGE_LENGTH + " caracteres)");
        }
        return normalized;
    }

    private ContactMessagePriority parsePriority(String value) {
        String normalized = StringUtils.firstNonBlank(value, "MEDIUM").toUpperCase(Locale.ROOT);
        try {
            return ContactMessagePriority.valueOf(normalized);
        } catch (Exception e) {
            throw new IllegalArgumentException("Priorite invalide: " + value);
        }
    }

    private ContactMessageCategory parseCategory(String value) {
        String normalized = StringUtils.firstNonBlank(value, "GENERAL").toUpperCase(Locale.ROOT);
        try {
            return ContactMessageCategory.valueOf(normalized);
        } catch (Exception e) {
            throw new IllegalArgumentException("Categorie invalide: " + value);
        }
    }

    private ContactMessageStatus parseStatus(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Statut requis");
        }
        try {
            return ContactMessageStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            throw new IllegalArgumentException("Statut invalide: " + value);
        }
    }

    private List<Long> sanitizeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return ids.stream().filter(Objects::nonNull).distinct().limit(1000).toList();
    }

    private String buildReplySubject(String subject) {
        String normalized = normalizeSubject(subject);
        return normalized.toLowerCase(Locale.ROOT).startsWith("re:") ? normalized : "Re: " + normalized;
    }

    private void validateEmail(String email) {
        try {
            InternetAddress address = new InternetAddress(email);
            address.validate();
        } catch (Exception e) {
            throw new IllegalArgumentException("Adresse email invalide: " + email);
        }
    }

    private record AuthActor(Long dbId, String userId, String email, String firstName, String lastName, List<String> roles) {}

    /**
     * Destinataire resolu : soit un utilisateur interne, soit un email externe.
     */
    private record ResolvedRecipient(String keycloakId, String firstName, String lastName, String email, boolean external) {
        static ResolvedRecipient fromUser(User user) {
            return new ResolvedRecipient(
                    user.getKeycloakId(),
                    StringUtils.firstNonBlank(user.getFirstName(), "Utilisateur"),
                    StringUtils.firstNonBlank(user.getLastName(), ""),
                    user.getEmail(),
                    false
            );
        }

        static ResolvedRecipient fromEmail(String email) {
            String localPart = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
            return new ResolvedRecipient("external", localPart, "", email, true);
        }
    }

}
