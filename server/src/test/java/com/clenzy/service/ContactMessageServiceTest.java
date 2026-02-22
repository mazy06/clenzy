package com.clenzy.service;

import com.clenzy.dto.ContactMessageDto;
import com.clenzy.model.*;
import com.clenzy.repository.ContactMessageRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContactMessageServiceTest {

    @Mock private ContactMessageRepository contactMessageRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private ObjectMapper objectMapper;
    @Mock private ContactFileStorageService fileStorageService;
    @Mock private NotificationService notificationService;
    @Mock private TenantContext tenantContext;

    private ContactMessageService service;

    // Test fixtures
    private static final String SENDER_KC_ID = "kc-sender-001";
    private static final String RECIPIENT_KC_ID = "kc-recipient-002";
    private static final Long ORG_ID = 10L;

    private Jwt senderJwt;
    private Jwt recipientJwt;
    private User senderUser;
    private User recipientUser;

    @BeforeEach
    void setUp() {
        service = new ContactMessageService(
                contactMessageRepository,
                userRepository,
                emailService,
                objectMapper,
                fileStorageService,
                notificationService,
                tenantContext
        );

        // Build JWTs
        senderJwt = Jwt.withTokenValue("token-sender")
                .header("alg", "RS256")
                .subject(SENDER_KC_ID)
                .claim("email", "sender@clenzy.com")
                .claim("given_name", "Alice")
                .claim("family_name", "Martin")
                .claim("realm_access", Map.of("roles", List.of("SUPER_ADMIN")))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        recipientJwt = Jwt.withTokenValue("token-recipient")
                .header("alg", "RS256")
                .subject(RECIPIENT_KC_ID)
                .claim("email", "recipient@clenzy.com")
                .claim("given_name", "Bob")
                .claim("family_name", "Dupont")
                .claim("realm_access", Map.of("roles", List.of("HOST")))
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        // Build Users
        senderUser = new User("Alice", "Martin", "sender@clenzy.com", "password123");
        senderUser.setId(1L);
        senderUser.setKeycloakId(SENDER_KC_ID);
        senderUser.setRole(UserRole.SUPER_ADMIN);
        senderUser.setStatus(UserStatus.ACTIVE);

        recipientUser = new User("Bob", "Dupont", "recipient@clenzy.com", "password456");
        recipientUser.setId(2L);
        recipientUser.setKeycloakId(RECIPIENT_KC_ID);
        recipientUser.setRole(UserRole.HOST);
        recipientUser.setStatus(UserStatus.ACTIVE);
    }

    // ── Helper methods ───────────────────────────────────────────────────────

    private ContactMessage buildMessage(String senderKcId, String recipientKcId) {
        ContactMessage msg = new ContactMessage();
        msg.setId(1L);
        msg.setSenderKeycloakId(senderKcId);
        msg.setSenderFirstName("Alice");
        msg.setSenderLastName("Martin");
        msg.setSenderEmail("sender@clenzy.com");
        msg.setRecipientKeycloakId(recipientKcId);
        msg.setRecipientFirstName("Bob");
        msg.setRecipientLastName("Dupont");
        msg.setRecipientEmail("recipient@clenzy.com");
        msg.setSubject("Test Subject");
        msg.setMessage("Test message content");
        msg.setPriority(ContactMessagePriority.MEDIUM);
        msg.setCategory(ContactMessageCategory.GENERAL);
        msg.setStatus(ContactMessageStatus.SENT);
        msg.setOrganizationId(ORG_ID);
        return msg;
    }

    // ── sendMessage ──────────────────────────────────────────────────────────

    @Nested
    class SendMessageTests {

        @Test
        void sendMessage_validInternalRecipient_createsAndSendsEmail() throws Exception {
            // Arrange
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByKeycloakId(RECIPIENT_KC_ID)).thenReturn(Optional.of(recipientUser));
            when(objectMapper.writeValueAsString(anyList())).thenReturn("[]");
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> {
                        ContactMessage m = inv.getArgument(0);
                        m.setId(1L);
                        return m;
                    });
            when(emailService.sendContactMessage(anyString(), anyString(), anyString(),
                    anyString(), anyString(), anyString(), anyList()))
                    .thenReturn("smtp-msg-id-001");

            // Act
            ContactMessageDto result = service.sendMessage(
                    senderJwt, RECIPIENT_KC_ID, "Hello", "Body text", "HIGH", "TECHNICAL", List.of()
            );

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.subject()).isEqualTo("Hello");

            ArgumentCaptor<ContactMessage> captor = ArgumentCaptor.forClass(ContactMessage.class);
            verify(contactMessageRepository).save(captor.capture());
            ContactMessage saved = captor.getValue();
            assertThat(saved.getSenderKeycloakId()).isEqualTo(SENDER_KC_ID);
            assertThat(saved.getRecipientKeycloakId()).isEqualTo(RECIPIENT_KC_ID);
            assertThat(saved.getPriority()).isEqualTo(ContactMessagePriority.HIGH);
            assertThat(saved.getCategory()).isEqualTo(ContactMessageCategory.TECHNICAL);

            verify(emailService).sendContactMessage(
                    eq("recipient@clenzy.com"), anyString(), eq("sender@clenzy.com"),
                    anyString(), eq("Hello"), eq("Body text"), anyList()
            );
        }

        @Test
        void sendMessage_externalEmailRecipient_createsMessageForExternalRecipient() throws Exception {
            // Arrange
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByEmailHash(anyString())).thenReturn(Optional.empty());
            when(objectMapper.writeValueAsString(anyList())).thenReturn("[]");
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> {
                        ContactMessage m = inv.getArgument(0);
                        m.setId(2L);
                        return m;
                    });
            when(emailService.sendContactMessage(anyString(), anyString(), anyString(),
                    anyString(), anyString(), anyString(), anyList()))
                    .thenReturn("smtp-ext-001");

            // Act
            ContactMessageDto result = service.sendMessage(
                    senderJwt, "external@example.com", "External", "Hi external", null, null, List.of()
            );

            // Assert
            assertThat(result).isNotNull();
            verify(emailService).sendContactMessage(
                    eq("external@example.com"), anyString(), anyString(),
                    anyString(), eq("External"), eq("Hi external"), anyList()
            );
        }

        @Test
        void sendMessage_nullJwt_throwsSecurityException() {
            assertThatThrownBy(() -> service.sendMessage(
                    null, RECIPIENT_KC_ID, "Sub", "Msg", null, null, List.of()
            )).isInstanceOf(SecurityException.class);
        }

        @Test
        void sendMessage_blankSubject_throwsIllegalArgument() {
            // Arrange
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByKeycloakId(RECIPIENT_KC_ID)).thenReturn(Optional.of(recipientUser));

            // Act & Assert (normalizeSubject fails before tenantContext is needed)
            assertThatThrownBy(() -> service.sendMessage(
                    senderJwt, RECIPIENT_KC_ID, "   ", "Body", null, null, List.of()
            )).isInstanceOf(IllegalArgumentException.class)
              .hasMessageContaining("Sujet requis");
        }

        @Test
        void sendMessage_blankMessage_throwsIllegalArgument() {
            // Arrange
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByKeycloakId(RECIPIENT_KC_ID)).thenReturn(Optional.of(recipientUser));

            // Act & Assert (normalizeMessage fails before tenantContext is needed)
            assertThatThrownBy(() -> service.sendMessage(
                    senderJwt, RECIPIENT_KC_ID, "Sub", "", null, null, List.of()
            )).isInstanceOf(IllegalArgumentException.class)
              .hasMessageContaining("Message requis");
        }

        @Test
        void sendMessage_invalidPriority_throwsIllegalArgument() {
            // Arrange
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByKeycloakId(RECIPIENT_KC_ID)).thenReturn(Optional.of(recipientUser));

            // Act & Assert (parsePriority fails before tenantContext is needed)
            assertThatThrownBy(() -> service.sendMessage(
                    senderJwt, RECIPIENT_KC_ID, "Sub", "Msg", "INVALID_PRIORITY", null, List.of()
            )).isInstanceOf(IllegalArgumentException.class)
              .hasMessageContaining("Priorite invalide");
        }

        @Test
        void sendMessage_invalidCategory_throwsIllegalArgument() {
            // Arrange
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByKeycloakId(RECIPIENT_KC_ID)).thenReturn(Optional.of(recipientUser));

            // Act & Assert (parseCategory fails before tenantContext is needed)
            assertThatThrownBy(() -> service.sendMessage(
                    senderJwt, RECIPIENT_KC_ID, "Sub", "Msg", null, "BOGUS", List.of()
            )).isInstanceOf(IllegalArgumentException.class)
              .hasMessageContaining("Categorie invalide");
        }

        @Test
        void sendMessage_selfRecipient_throwsIllegalArgument() {
            // Arrange
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));

            // Act & Assert
            assertThatThrownBy(() -> service.sendMessage(
                    senderJwt, SENDER_KC_ID, "Sub", "Msg", null, null, List.of()
            )).isInstanceOf(IllegalArgumentException.class)
              .hasMessageContaining("vous-meme");
        }

        @Test
        void sendMessage_recipientNotFound_throwsNoSuchElement() {
            // Arrange
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByKeycloakId("unknown-kc-id")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.sendMessage(
                    senderJwt, "unknown-kc-id", "Sub", "Msg", null, null, List.of()
            )).isInstanceOf(NoSuchElementException.class);
        }

        @Test
        void sendMessage_inactiveRecipient_throwsIllegalArgument() {
            // Arrange
            recipientUser.setStatus(UserStatus.SUSPENDED);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByKeycloakId(RECIPIENT_KC_ID)).thenReturn(Optional.of(recipientUser));

            // Act & Assert
            assertThatThrownBy(() -> service.sendMessage(
                    senderJwt, RECIPIENT_KC_ID, "Sub", "Msg", null, null, List.of()
            )).isInstanceOf(IllegalArgumentException.class)
              .hasMessageContaining("inactif");
        }

        @Test
        void sendMessage_restrictedRoleSendingToNonStaff_throwsSecurityException() {
            // Arrange: HOST sender trying to send to another HOST (non-platform-staff)
            Jwt hostJwt = Jwt.withTokenValue("token-host")
                    .header("alg", "RS256")
                    .subject("kc-host-001")
                    .claim("email", "host@clenzy.com")
                    .claim("given_name", "Host")
                    .claim("family_name", "User")
                    .claim("realm_access", Map.of("roles", List.of("HOST")))
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();

            User hostUser = new User("Host", "User", "host@clenzy.com", "password");
            hostUser.setKeycloakId("kc-host-001");
            hostUser.setRole(UserRole.HOST);
            hostUser.setStatus(UserStatus.ACTIVE);

            User anotherHost = new User("Other", "Host", "other@clenzy.com", "password");
            anotherHost.setKeycloakId("kc-host-002");
            anotherHost.setRole(UserRole.HOST);
            anotherHost.setStatus(UserStatus.ACTIVE);

            when(userRepository.findByKeycloakId("kc-host-001")).thenReturn(Optional.of(hostUser));
            when(userRepository.findByKeycloakId("kc-host-002")).thenReturn(Optional.of(anotherHost));

            // Act & Assert (validateRecipientAccess throws before tenantContext is needed)
            assertThatThrownBy(() -> service.sendMessage(
                    hostJwt, "kc-host-002", "Sub", "Msg", null, null, List.of()
            )).isInstanceOf(SecurityException.class)
              .hasMessageContaining("non autorise");
        }

        @Test
        void sendMessage_nullRecipient_throwsIllegalArgument() {
            // Arrange
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));

            // Act & Assert
            assertThatThrownBy(() -> service.sendMessage(
                    senderJwt, null, "Sub", "Msg", null, null, List.of()
            )).isInstanceOf(IllegalArgumentException.class)
              .hasMessageContaining("Destinataire requis");
        }

        @Test
        void sendMessage_notifiesBothSenderAndRecipient() throws Exception {
            // Arrange
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByKeycloakId(RECIPIENT_KC_ID)).thenReturn(Optional.of(recipientUser));
            when(objectMapper.writeValueAsString(anyList())).thenReturn("[]");
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> {
                        ContactMessage m = inv.getArgument(0);
                        m.setId(1L);
                        return m;
                    });

            // Act
            service.sendMessage(senderJwt, RECIPIENT_KC_ID, "Subject", "Body", null, null, List.of());

            // Assert
            verify(notificationService).notify(eq(RECIPIENT_KC_ID),
                    eq(NotificationKey.CONTACT_MESSAGE_RECEIVED), anyString(), anyString(), anyString());
            verify(notificationService).notify(eq(SENDER_KC_ID),
                    eq(NotificationKey.CONTACT_MESSAGE_SENT), anyString(), anyString(), anyString());
        }
    }

    // ── replyToMessage ───────────────────────────────────────────────────────

    @Nested
    class ReplyToMessageTests {

        @Test
        void replyToMessage_asSender_repliesToRecipient() throws Exception {
            // Arrange
            ContactMessage original = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(original));
            when(objectMapper.writeValueAsString(anyList())).thenReturn("[]");
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> {
                        ContactMessage m = inv.getArgument(0);
                        m.setId(2L);
                        return m;
                    });

            // Act
            ContactMessageDto result = service.replyToMessage(senderJwt, 1L, "Reply text", List.of());

            // Assert
            assertThat(result).isNotNull();
            ArgumentCaptor<ContactMessage> captor = ArgumentCaptor.forClass(ContactMessage.class);
            verify(contactMessageRepository).save(captor.capture());
            ContactMessage reply = captor.getValue();
            assertThat(reply.getRecipientKeycloakId()).isEqualTo(RECIPIENT_KC_ID);
            assertThat(reply.getSubject()).startsWith("Re:");
            assertThat(original.getStatus()).isEqualTo(ContactMessageStatus.REPLIED);
        }

        @Test
        void replyToMessage_asRecipient_repliesToSender() throws Exception {
            // Arrange
            ContactMessage original = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(RECIPIENT_KC_ID)).thenReturn(Optional.of(recipientUser));
            when(contactMessageRepository.findByIdForUser(1L, RECIPIENT_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(original));
            when(objectMapper.writeValueAsString(anyList())).thenReturn("[]");
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> {
                        ContactMessage m = inv.getArgument(0);
                        m.setId(2L);
                        return m;
                    });

            // Act
            ContactMessageDto result = service.replyToMessage(recipientJwt, 1L, "Reply from recipient", List.of());

            // Assert
            ArgumentCaptor<ContactMessage> captor = ArgumentCaptor.forClass(ContactMessage.class);
            verify(contactMessageRepository).save(captor.capture());
            ContactMessage reply = captor.getValue();
            assertThat(reply.getRecipientKeycloakId()).isEqualTo(SENDER_KC_ID);
        }

        @Test
        void replyToMessage_originalNotFound_throwsNoSuchElement() {
            // Arrange
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(contactMessageRepository.findByIdForUser(999L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.replyToMessage(senderJwt, 999L, "Reply", List.of()))
                    .isInstanceOf(NoSuchElementException.class);
        }

        @Test
        void replyToMessage_blankMessage_throwsIllegalArgument() {
            // Arrange
            ContactMessage original = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(original));

            // Act & Assert
            assertThatThrownBy(() -> service.replyToMessage(senderJwt, 1L, "  ", List.of()))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Message requis");
        }

        @Test
        void replyToMessage_subjectAlreadyRe_doesNotDoublePrefix() throws Exception {
            // Arrange
            ContactMessage original = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            original.setSubject("Re: Original subject");
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(original));
            when(objectMapper.writeValueAsString(anyList())).thenReturn("[]");
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> {
                        ContactMessage m = inv.getArgument(0);
                        m.setId(2L);
                        return m;
                    });

            // Act
            service.replyToMessage(senderJwt, 1L, "Reply text", List.of());

            // Assert
            ArgumentCaptor<ContactMessage> captor = ArgumentCaptor.forClass(ContactMessage.class);
            verify(contactMessageRepository).save(captor.capture());
            assertThat(captor.getValue().getSubject()).isEqualTo("Re: Original subject");
            assertThat(captor.getValue().getSubject()).doesNotStartWith("Re: Re:");
        }

        @Test
        void replyToMessage_notifiesReplyRecipient() throws Exception {
            // Arrange
            ContactMessage original = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(original));
            when(objectMapper.writeValueAsString(anyList())).thenReturn("[]");
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> {
                        ContactMessage m = inv.getArgument(0);
                        m.setId(2L);
                        return m;
                    });

            // Act
            service.replyToMessage(senderJwt, 1L, "Reply text", List.of());

            // Assert
            verify(notificationService).notify(
                    eq(RECIPIENT_KC_ID),
                    eq(NotificationKey.CONTACT_MESSAGE_REPLIED),
                    anyString(), anyString(), anyString()
            );
        }
    }

    // ── archiveMessage / unarchiveMessage ────────────────────────────────────

    @Nested
    class ArchiveTests {

        @Test
        void archiveMessage_setsArchivedTrueAndTimestamp() {
            // Arrange
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(msg));
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            ContactMessageDto result = service.archiveMessage(senderJwt, 1L);

            // Assert
            assertThat(result.archived()).isTrue();
            assertThat(msg.isArchived()).isTrue();
            assertThat(msg.getArchivedAt()).isNotNull();
            verify(notificationService).notify(
                    eq(SENDER_KC_ID),
                    eq(NotificationKey.CONTACT_MESSAGE_ARCHIVED),
                    anyString(), anyString(), anyString()
            );
        }

        @Test
        void archiveMessage_messageNotFound_throwsNoSuchElement() {
            // Arrange
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(999L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.archiveMessage(senderJwt, 999L))
                    .isInstanceOf(NoSuchElementException.class);
        }

        @Test
        void unarchiveMessage_setsArchivedFalseAndClearsTimestamp() {
            // Arrange
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            msg.setArchived(true);
            msg.setArchivedAt(LocalDateTime.now());
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(msg));
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            ContactMessageDto result = service.unarchiveMessage(senderJwt, 1L);

            // Assert
            assertThat(result.archived()).isFalse();
            assertThat(msg.isArchived()).isFalse();
            assertThat(msg.getArchivedAt()).isNull();
        }
    }

    // ── updateStatus ─────────────────────────────────────────────────────────

    @Nested
    class UpdateStatusTests {

        @Test
        void updateStatus_markAsRead_asRecipient_succeeds() {
            // Arrange
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(1L, RECIPIENT_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(msg));
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            ContactMessageDto result = service.updateStatus(recipientJwt, 1L, "READ");

            // Assert
            assertThat(result.status()).isEqualTo("READ");
            assertThat(msg.getReadAt()).isNotNull();
        }

        @Test
        void updateStatus_markAsRead_asNonRecipient_throwsSecurityException() {
            // Arrange
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(msg));

            // Act & Assert
            assertThatThrownBy(() -> service.updateStatus(senderJwt, 1L, "READ"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("destinataire");
        }

        @Test
        void updateStatus_invalidStatus_throwsIllegalArgument() {
            assertThatThrownBy(() -> service.updateStatus(senderJwt, 1L, "INVALID"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Statut invalide");
        }

        @Test
        void updateStatus_nullStatus_throwsIllegalArgument() {
            assertThatThrownBy(() -> service.updateStatus(senderJwt, 1L, null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Statut requis");
        }

        @Test
        void updateStatus_delivered_setsDeliveredAt() {
            // Arrange
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(msg));
            when(contactMessageRepository.save(any(ContactMessage.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act
            service.updateStatus(senderJwt, 1L, "DELIVERED");

            // Assert
            assertThat(msg.getDeliveredAt()).isNotNull();
        }
    }

    // ── deleteMessage ────────────────────────────────────────────────────────

    @Nested
    class DeleteMessageTests {

        @Test
        void deleteMessage_existingMessage_deletesSuccessfully() {
            // Arrange
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(msg));

            // Act
            service.deleteMessage(senderJwt, 1L);

            // Assert
            verify(contactMessageRepository).delete(msg);
        }

        @Test
        void deleteMessage_notFound_throwsNoSuchElement() {
            // Arrange
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(999L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.deleteMessage(senderJwt, 999L))
                    .isInstanceOf(NoSuchElementException.class);
        }
    }

    // ── bulkUpdateStatus ─────────────────────────────────────────────────────

    @Nested
    class BulkUpdateStatusTests {

        @Test
        void bulkUpdateStatus_emptyIds_returnsZero() {
            // Act
            Map<String, Object> result = service.bulkUpdateStatus(senderJwt, List.of(), "READ");

            // Assert
            assertThat(result.get("updatedCount")).isEqualTo(0);
            verifyNoInteractions(contactMessageRepository);
        }

        @Test
        void bulkUpdateStatus_nullIds_returnsZero() {
            // Act
            Map<String, Object> result = service.bulkUpdateStatus(senderJwt, null, "READ");

            // Assert
            assertThat(result.get("updatedCount")).isEqualTo(0);
        }

        @Test
        void bulkUpdateStatus_readStatusSkipsNonRecipientMessages() {
            // Arrange
            ContactMessage msg1 = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            msg1.setId(1L);
            ContactMessage msg2 = buildMessage("other-sender", SENDER_KC_ID);
            msg2.setId(2L);

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdsForUser(anyList(), eq(SENDER_KC_ID), eq(ORG_ID)))
                    .thenReturn(List.of(msg1, msg2));

            // Act
            Map<String, Object> result = service.bulkUpdateStatus(senderJwt, List.of(1L, 2L), "READ");

            // Assert - msg1 is skipped (sender is not recipient), msg2 is updated (sender IS recipient)
            assertThat(result.get("updatedCount")).isEqualTo(1);
        }

        @Test
        void bulkUpdateStatus_deliveredStatus_updatesAllMessages() {
            // Arrange
            ContactMessage msg1 = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            msg1.setId(1L);
            ContactMessage msg2 = buildMessage("other-sender", SENDER_KC_ID);
            msg2.setId(2L);

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdsForUser(anyList(), eq(SENDER_KC_ID), eq(ORG_ID)))
                    .thenReturn(List.of(msg1, msg2));

            // Act
            Map<String, Object> result = service.bulkUpdateStatus(senderJwt, List.of(1L, 2L), "DELIVERED");

            // Assert - DELIVERED has no recipient restriction
            assertThat(result.get("updatedCount")).isEqualTo(2);
        }
    }

    // ── bulkDelete ───────────────────────────────────────────────────────────

    @Nested
    class BulkDeleteTests {

        @Test
        void bulkDelete_emptyIds_returnsZero() {
            // Act
            Map<String, Object> result = service.bulkDelete(senderJwt, List.of());

            // Assert
            assertThat(result.get("deletedCount")).isEqualTo(0);
        }

        @Test
        void bulkDelete_validIds_deletesAndReturnsCount() {
            // Arrange
            ContactMessage msg1 = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            ContactMessage msg2 = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdsForUser(anyList(), eq(SENDER_KC_ID), eq(ORG_ID)))
                    .thenReturn(List.of(msg1, msg2));

            // Act
            Map<String, Object> result = service.bulkDelete(senderJwt, List.of(1L, 2L));

            // Assert
            assertThat(result.get("deletedCount")).isEqualTo(2);
            verify(contactMessageRepository).deleteAll(List.of(msg1, msg2));
        }
    }

    // ── listMessages ─────────────────────────────────────────────────────────

    @Nested
    class ListMessagesTests {

        @Test
        void listMessages_inbox_returnsRecipientMessages() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            Page<ContactMessage> page = new PageImpl<>(List.of(msg));

            when(contactMessageRepository.findByRecipientKeycloakIdAndArchivedFalseOrderByCreatedAtDesc(
                    RECIPIENT_KC_ID, pageable)).thenReturn(page);

            // Act
            Page<ContactMessageDto> result = service.listMessages("inbox", pageable, recipientJwt);

            // Assert
            assertThat(result.getTotalElements()).isEqualTo(1);
        }

        @Test
        void listMessages_sent_returnsSenderMessages() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            Page<ContactMessage> page = new PageImpl<>(List.of(msg));

            when(contactMessageRepository.findBySenderKeycloakIdAndArchivedFalseOrderByCreatedAtDesc(
                    SENDER_KC_ID, pageable)).thenReturn(page);

            // Act
            Page<ContactMessageDto> result = service.listMessages("sent", pageable, senderJwt);

            // Assert
            assertThat(result.getTotalElements()).isEqualTo(1);
        }

        @Test
        void listMessages_archived_returnsArchivedMessages() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ContactMessage> page = new PageImpl<>(List.of());

            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findArchivedForUser(SENDER_KC_ID, pageable, ORG_ID))
                    .thenReturn(page);

            // Act
            Page<ContactMessageDto> result = service.listMessages("archived", pageable, senderJwt);

            // Assert
            assertThat(result.getTotalElements()).isZero();
        }

        @Test
        void listMessages_invalidBox_throwsIllegalArgument() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);

            // Act & Assert
            assertThatThrownBy(() -> service.listMessages("spam", pageable, senderJwt))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        void listMessages_nullBox_defaultsToInbox() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);
            Page<ContactMessage> page = new PageImpl<>(List.of());

            when(contactMessageRepository.findByRecipientKeycloakIdAndArchivedFalseOrderByCreatedAtDesc(
                    SENDER_KC_ID, pageable)).thenReturn(page);

            // Act
            service.listMessages(null, pageable, senderJwt);

            // Assert
            verify(contactMessageRepository).findByRecipientKeycloakIdAndArchivedFalseOrderByCreatedAtDesc(
                    SENDER_KC_ID, pageable);
        }

        @Test
        void listMessages_nullJwt_throwsSecurityException() {
            // Arrange
            Pageable pageable = PageRequest.of(0, 10);

            // Act & Assert
            assertThatThrownBy(() -> service.listMessages("inbox", pageable, null))
                    .isInstanceOf(SecurityException.class);
        }
    }

    // ── getMessageForUser ────────────────────────────────────────────────────

    @Nested
    class GetMessageForUserTests {

        @Test
        void getMessageForUser_existingMessage_returnsMessage() {
            // Arrange
            ContactMessage msg = buildMessage(SENDER_KC_ID, RECIPIENT_KC_ID);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(1L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.of(msg));

            // Act
            ContactMessage result = service.getMessageForUser(1L, senderJwt);

            // Assert
            assertThat(result).isEqualTo(msg);
        }

        @Test
        void getMessageForUser_notFound_throwsNoSuchElement() {
            // Arrange
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(contactMessageRepository.findByIdForUser(999L, SENDER_KC_ID, ORG_ID))
                    .thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> service.getMessageForUser(999L, senderJwt))
                    .isInstanceOf(NoSuchElementException.class);
        }
    }

    // ── listRecipients ───────────────────────────────────────────────────────

    @Nested
    class ListRecipientsTests {

        @Test
        void listRecipients_adminUser_seeAllActiveUsers() {
            // Arrange
            when(userRepository.findByKeycloakId(SENDER_KC_ID)).thenReturn(Optional.of(senderUser));
            when(userRepository.findByStatusAndKeycloakIdIsNotNullOrderByFirstNameAscLastNameAsc(UserStatus.ACTIVE))
                    .thenReturn(List.of(senderUser, recipientUser));

            // Act
            var result = service.listRecipients(senderJwt);

            // Assert - should exclude the sender (self) from list
            assertThat(result).hasSize(1);
            assertThat(result.get(0).id()).isEqualTo(RECIPIENT_KC_ID);
        }

        @Test
        void listRecipients_restrictedRole_seesOnlyPlatformStaff() {
            // Arrange: HOST is in RESTRICTED_ROLES
            Jwt hostJwt = Jwt.withTokenValue("token-host")
                    .header("alg", "RS256")
                    .subject("kc-host-001")
                    .claim("email", "host@clenzy.com")
                    .claim("given_name", "Host")
                    .claim("family_name", "User")
                    .claim("realm_access", Map.of("roles", List.of("HOST")))
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();

            User hostUser = new User("Host", "User", "host@clenzy.com", "password");
            hostUser.setKeycloakId("kc-host-001");
            hostUser.setRole(UserRole.HOST);
            hostUser.setStatus(UserStatus.ACTIVE);

            when(userRepository.findByKeycloakId("kc-host-001")).thenReturn(Optional.of(hostUser));
            when(userRepository.findByStatusAndRoleInAndKeycloakIdIsNotNullOrderByFirstNameAscLastNameAsc(
                    UserStatus.ACTIVE, List.of(UserRole.SUPER_ADMIN, UserRole.SUPER_MANAGER)))
                    .thenReturn(List.of(senderUser));

            // Act
            var result = service.listRecipients(hostJwt);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).id()).isEqualTo(SENDER_KC_ID);
        }
    }
}
