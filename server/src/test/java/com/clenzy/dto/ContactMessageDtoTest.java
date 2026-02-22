package com.clenzy.dto;

import com.clenzy.model.ContactMessage;
import com.clenzy.model.ContactMessageCategory;
import com.clenzy.model.ContactMessagePriority;
import com.clenzy.model.ContactMessageStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class ContactMessageDtoTest {

    @Test
    void fromEntity_mapsAllFieldsCorrectly() {
        ContactMessage msg = createFullMessage();

        ContactMessageDto dto = ContactMessageDto.fromEntity(msg);

        assertEquals(1L, dto.id());
        assertEquals("sender-kc-id", dto.senderId());
        assertEquals("Jean Dupont", dto.senderName());
        assertEquals("recipient-kc-id", dto.recipientId());
        assertEquals("Marie Martin", dto.recipientName());
        assertEquals("Sujet test", dto.subject());
        assertEquals("Corps du message", dto.message());
        assertEquals("HIGH", dto.priority());
        assertEquals("TECHNICAL", dto.category());
        assertEquals("SENT", dto.status());
        assertFalse(dto.archived());

        // Verify sender ContactUserDto
        assertNotNull(dto.sender());
        assertEquals("sender-kc-id", dto.sender().id());
        assertEquals("Jean", dto.sender().firstName());
        assertEquals("Dupont", dto.sender().lastName());
        assertEquals("jean@test.com", dto.sender().email());

        // Verify recipient ContactUserDto
        assertNotNull(dto.recipient());
        assertEquals("recipient-kc-id", dto.recipient().id());
        assertEquals("Marie", dto.recipient().firstName());
        assertEquals("Martin", dto.recipient().lastName());
        assertEquals("marie@test.com", dto.recipient().email());
    }

    @Test
    void fromEntity_nullSenderFirstName_usesUtilisateurFallback() {
        ContactMessage msg = createFullMessage();
        msg.setSenderFirstName(null);

        ContactMessageDto dto = ContactMessageDto.fromEntity(msg);

        assertEquals("Utilisateur Dupont", dto.senderName());
        assertEquals("Utilisateur", dto.sender().firstName());
    }

    @Test
    void fromEntity_nullSenderLastName_senderNameIsTrimmedFirstOnly() {
        ContactMessage msg = createFullMessage();
        msg.setSenderLastName(null);

        ContactMessageDto dto = ContactMessageDto.fromEntity(msg);

        assertEquals("Jean", dto.senderName());
        assertEquals("", dto.sender().lastName());
    }

    @Test
    void fromEntity_validJsonAttachments_parsesList() {
        ContactMessage msg = createFullMessage();
        msg.setAttachments("[{\"id\":\"a1\",\"filename\":\"f.pdf\",\"originalName\":\"orig.pdf\",\"size\":1024,\"contentType\":\"application/pdf\",\"storagePath\":\"/tmp/f.pdf\"}]");

        ContactMessageDto dto = ContactMessageDto.fromEntity(msg);

        assertNotNull(dto.attachments());
        assertEquals(1, dto.attachments().size());
        assertEquals("a1", dto.attachments().get(0).id());
        assertEquals("f.pdf", dto.attachments().get(0).filename());
    }

    @Test
    void fromEntity_nullAttachments_returnsEmptyList() {
        ContactMessage msg = createFullMessage();
        msg.setAttachments(null);

        ContactMessageDto dto = ContactMessageDto.fromEntity(msg);

        assertNotNull(dto.attachments());
        assertTrue(dto.attachments().isEmpty());
    }

    @Test
    void fromEntity_invalidJsonAttachments_returnsEmptyListNoException() {
        ContactMessage msg = createFullMessage();
        msg.setAttachments("{invalid json[");

        ContactMessageDto dto = ContactMessageDto.fromEntity(msg);

        assertNotNull(dto.attachments());
        assertTrue(dto.attachments().isEmpty());
    }

    // --- Helpers ---

    private ContactMessage createFullMessage() {
        ContactMessage msg = new ContactMessage();
        msg.setId(1L);
        msg.setSenderKeycloakId("sender-kc-id");
        msg.setSenderFirstName("Jean");
        msg.setSenderLastName("Dupont");
        msg.setSenderEmail("jean@test.com");
        msg.setRecipientKeycloakId("recipient-kc-id");
        msg.setRecipientFirstName("Marie");
        msg.setRecipientLastName("Martin");
        msg.setRecipientEmail("marie@test.com");
        msg.setSubject("Sujet test");
        msg.setMessage("Corps du message");
        msg.setPriority(ContactMessagePriority.HIGH);
        msg.setCategory(ContactMessageCategory.TECHNICAL);
        msg.setStatus(ContactMessageStatus.SENT);
        msg.setArchived(false);
        msg.setAttachments("[]");
        msg.setCreatedAt(LocalDateTime.of(2026, 1, 15, 10, 0));
        return msg;
    }
}
