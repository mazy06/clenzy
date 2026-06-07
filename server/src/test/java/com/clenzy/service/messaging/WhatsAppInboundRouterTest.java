package com.clenzy.service.messaging;

import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.Guest;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.User;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

/**
 * Tests du routage WhatsApp entrant (relais B1) : identification du guest par
 * numero, rattachement reservation/host, ou file "a trier".
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WhatsAppInboundRouterTest {

    @Mock private GuestRepository guestRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private ConversationService conversationService;

    private WhatsAppInboundRouter router;

    private static final String FROM = "+33612345678";

    @BeforeEach
    void setUp() {
        router = new WhatsAppInboundRouter(guestRepository, reservationRepository,
            organizationRepository, conversationService);
    }

    private Guest guest() {
        Guest g = new Guest("Alice", "Martin", 10L);
        g.setId(1L);
        return g;
    }

    private Conversation conv() {
        Conversation c = new Conversation();
        c.setId(7L);
        return c;
    }

    @Test
    void guestWithActiveReservation_attachesAndAssignsHost() {
        Guest g = guest();
        User host = new User();
        host.setKeycloakId("kc-host");
        Property property = new Property();
        property.setOwner(host);
        Reservation res = new Reservation();
        res.setId(5L);
        res.setStatus("confirmed");
        res.setCheckIn(LocalDate.now());
        res.setCheckOut(LocalDate.now().plusDays(2));
        res.setProperty(property);

        when(guestRepository.findByPhoneHash(anyString())).thenReturn(List.of(g));
        when(reservationRepository.findByGuestId(1L)).thenReturn(List.of(res));
        when(conversationService.getOrCreateForReservation(eq(10L), eq(5L),
            eq(ConversationChannel.WHATSAPP), eq(g), eq(property), eq(res))).thenReturn(conv());

        router.route(FROM, "Alice", "Bonjour", "wamid.1");

        verify(conversationService).getOrCreateForReservation(10L, 5L,
            ConversationChannel.WHATSAPP, g, property, res);
        verify(conversationService).assignConversation(7L, 10L, "kc-host");
        verify(conversationService).addInboundMessage(any(Conversation.class),
            eq("Alice Martin"), eq(FROM), eq("Bonjour"), isNull(), eq("wamid.1"));
    }

    @Test
    void guestWithoutReservation_createsUnassignedConversation() {
        Guest g = guest();
        when(guestRepository.findByPhoneHash(anyString())).thenReturn(List.of(g));
        when(reservationRepository.findByGuestId(1L)).thenReturn(List.of());
        when(conversationService.getOrCreate(eq(10L), eq(ConversationChannel.WHATSAPP),
            eq(FROM), eq(g), isNull(), isNull(), anyString())).thenReturn(conv());

        router.route(FROM, "Alice", "Bonjour", "wamid.2");

        verify(conversationService).getOrCreate(eq(10L), eq(ConversationChannel.WHATSAPP),
            eq(FROM), eq(g), isNull(), isNull(), anyString());
        verify(conversationService).addInboundMessage(any(), eq("Alice Martin"), eq(FROM),
            eq("Bonjour"), isNull(), eq("wamid.2"));
        verify(conversationService, never()).assignConversation(anyLong(), anyLong(), anyString());
    }

    @Test
    void unknownNumber_goesToSystemOrgTriageQueue() {
        when(guestRepository.findByPhoneHash(anyString())).thenReturn(List.of());
        Organization systemOrg = new Organization("System", OrganizationType.SYSTEM, "system");
        systemOrg.setId(99L);
        when(organizationRepository.findByType(OrganizationType.SYSTEM)).thenReturn(List.of(systemOrg));
        when(conversationService.getOrCreate(eq(99L), eq(ConversationChannel.WHATSAPP),
            eq(FROM), isNull(), isNull(), isNull(), anyString())).thenReturn(conv());

        router.route(FROM, "Inconnu", "Bonjour", "wamid.3");

        verify(conversationService).getOrCreate(eq(99L), eq(ConversationChannel.WHATSAPP),
            eq(FROM), isNull(), isNull(), isNull(), anyString());
        verify(conversationService).addInboundMessage(any(), anyString(), eq(FROM),
            eq("Bonjour"), isNull(), eq("wamid.3"));
    }

    @Test
    void unknownNumber_noSystemOrg_doesNothing() {
        when(guestRepository.findByPhoneHash(anyString())).thenReturn(List.of());
        when(organizationRepository.findByType(OrganizationType.SYSTEM)).thenReturn(List.of());

        router.route(FROM, "Inconnu", "Bonjour", "wamid.4");

        verify(conversationService, never()).getOrCreate(any(), any(), any(), any(), any(), any(), any());
        verify(conversationService, never()).addInboundMessage(any(), any(), any(), any(), any(), any());
    }
}
