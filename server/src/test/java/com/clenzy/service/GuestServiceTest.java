package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.GuestChannel;
import com.clenzy.repository.GuestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestServiceTest {

    @Mock private GuestRepository guestRepository;

    private GuestService guestService;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        guestService = new GuestService(guestRepository);
    }

    private Guest buildGuest(Long id, String firstName, String lastName) {
        Guest guest = new Guest(firstName, lastName, ORG_ID);
        guest.setId(id);
        return guest;
    }

    // ===== FIND OR CREATE =====

    @Nested
    class FindOrCreate {

        @Test
        void whenChannelAndChannelGuestIdMatch_thenReturnExistingGuest() {
            Guest existing = buildGuest(1L, "Jean", "Dupont");
            existing.setChannel(GuestChannel.AIRBNB);
            existing.setChannelGuestId("airbnb-123");
            existing.setEmail("jean@test.com");
            when(guestRepository.findByChannelAndChannelGuestId(
                    GuestChannel.AIRBNB, "airbnb-123", ORG_ID))
                    .thenReturn(Optional.of(existing));

            Guest result = guestService.findOrCreate("Jean", "Dupont", "jean@test.com",
                    null, GuestChannel.AIRBNB, "airbnb-123", ORG_ID);

            assertThat(result.getId()).isEqualTo(1L);
            verify(guestRepository, never()).save(any());
        }

        @Test
        void whenChannelGuestIdMatch_thenUpdatesFieldsIfDifferent() {
            Guest existing = buildGuest(1L, "Jean", "Dupont");
            existing.setChannel(GuestChannel.AIRBNB);
            existing.setChannelGuestId("airbnb-123");
            when(guestRepository.findByChannelAndChannelGuestId(
                    GuestChannel.AIRBNB, "airbnb-123", ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            Guest result = guestService.findOrCreate("Pierre", "Martin", "new@test.com",
                    "+33600000000", GuestChannel.AIRBNB, "airbnb-123", ORG_ID);

            assertThat(result.getFirstName()).isEqualTo("Pierre");
            assertThat(result.getLastName()).isEqualTo("Martin");
            assertThat(result.getEmail()).isEqualTo("new@test.com");
            assertThat(result.getPhone()).isEqualTo("+33600000000");
            verify(guestRepository).save(any(Guest.class));
        }

        @Test
        void whenEmailMatchesExistingGuest_thenReturnsExisting() {
            Guest existing = buildGuest(2L, "Marie", "Curie");
            existing.setEmail("marie@test.com");
            when(guestRepository.findByChannelAndChannelGuestId(any(), any(), eq(ORG_ID)))
                    .thenReturn(Optional.empty());
            when(guestRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(existing));

            Guest result = guestService.findOrCreate("Marie", "Curie", "marie@test.com",
                    null, GuestChannel.BOOKING, "bk-456", ORG_ID);

            assertThat(result.getId()).isEqualTo(2L);
        }

        @Test
        void whenEmailMatchIsCaseInsensitive_thenFindsExisting() {
            Guest existing = buildGuest(3L, "Test", "User");
            existing.setEmail("TEST@EMAIL.COM");
            // channel=DIRECT, channelGuestId=null → skips channel dedup (line 60)
            when(guestRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(existing));

            Guest result = guestService.findOrCreate("Test", "User", "test@email.com",
                    null, GuestChannel.DIRECT, null, ORG_ID);

            assertThat(result.getId()).isEqualTo(3L);
        }

        @Test
        void whenNoMatch_thenCreatesNewGuest() {
            when(guestRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of());
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> {
                Guest g = inv.getArgument(0);
                g.setId(10L);
                return g;
            });

            Guest result = guestService.findOrCreate("Nouveau", "Guest",
                    "new@test.com", "+33600000000", GuestChannel.DIRECT, null, ORG_ID);

            assertThat(result.getId()).isEqualTo(10L);
            assertThat(result.getFirstName()).isEqualTo("Nouveau");
            assertThat(result.getEmail()).isEqualTo("new@test.com");
            assertThat(result.getChannel()).isEqualTo(GuestChannel.DIRECT);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        void whenChannelAndGuestIdAreNull_thenSkipsChannelDedup() {
            // email=null → skips email dedup too, goes straight to create
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreate("No", "Channel", null, null, null, null, ORG_ID);

            verify(guestRepository, never()).findByChannelAndChannelGuestId(any(), any(), any());
        }

        @Test
        void whenEmailIsBlank_thenSkipsEmailDedup() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreate("No", "Email", "  ", null, null, null, ORG_ID);

            verify(guestRepository, never()).findByOrganizationId(any());
        }
    }

    // ===== FIND OR CREATE FROM NAME =====

    @Nested
    class FindOrCreateFromName {

        @Test
        void whenFullName_thenParsesFirstAndLastName() {
            // findOrCreateFromName passes email=null → skips email dedup, goes to create
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            Guest result = guestService.findOrCreateFromName("Jean Dupont", "airbnb", ORG_ID);

            assertThat(result.getFirstName()).isEqualTo("Jean");
            assertThat(result.getLastName()).isEqualTo("Dupont");
        }

        @Test
        void whenSingleName_thenLastNameIsEmpty() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            Guest result = guestService.findOrCreateFromName("Madonna", "direct", ORG_ID);

            assertThat(result.getFirstName()).isEqualTo("Madonna");
            assertThat(result.getLastName()).isEmpty();
        }

        @Test
        void whenNullName_thenReturnsNull() {
            Guest result = guestService.findOrCreateFromName(null, "airbnb", ORG_ID);
            assertThat(result).isNull();
        }

        @Test
        void whenBlankName_thenReturnsNull() {
            Guest result = guestService.findOrCreateFromName("   ", "airbnb", ORG_ID);
            assertThat(result).isNull();
        }

        @Test
        void whenSourceIsAirbnb_thenChannelIsAirbnb() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            Guest result = guestService.findOrCreateFromName("Test User", "airbnb", ORG_ID);

            assertThat(result.getChannel()).isEqualTo(GuestChannel.AIRBNB);
        }

        @Test
        void whenSourceIsBooking_thenChannelIsBooking() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreateFromName("Test User", "booking.com", ORG_ID);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getChannel()).isEqualTo(GuestChannel.BOOKING);
        }
    }

    // ===== RECORD STAY =====

    @Nested
    class RecordStay {

        @Test
        void whenGuestExists_thenIncrementsStaysAndAmount() {
            Guest guest = buildGuest(1L, "Jean", "Dupont");
            guest.setTotalStays(2);
            guest.setTotalSpent(BigDecimal.valueOf(500));
            when(guestRepository.findById(1L)).thenReturn(Optional.of(guest));
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.recordStay(1L, BigDecimal.valueOf(150));

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getTotalStays()).isEqualTo(3);
            assertThat(captor.getValue().getTotalSpent()).isEqualByComparingTo("650");
        }

        @Test
        void whenAmountIsNull_thenOnlyIncrementsStays() {
            Guest guest = buildGuest(1L, "Jean", "Dupont");
            guest.setTotalStays(1);
            guest.setTotalSpent(BigDecimal.valueOf(100));
            when(guestRepository.findById(1L)).thenReturn(Optional.of(guest));
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.recordStay(1L, null);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getTotalStays()).isEqualTo(2);
            assertThat(captor.getValue().getTotalSpent()).isEqualByComparingTo("100");
        }

        @Test
        void whenGuestNotFound_thenDoesNothing() {
            when(guestRepository.findById(999L)).thenReturn(Optional.empty());

            guestService.recordStay(999L, BigDecimal.TEN);

            verify(guestRepository, never()).save(any());
        }
    }
}
