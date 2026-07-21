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

import com.clenzy.dto.GuestPageDto;
import com.clenzy.model.Organization;

import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

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
    @Mock private com.clenzy.repository.ReservationRepository reservationRepository;
    @Mock private OrganizationService organizationService;

    private GuestService guestService;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        guestService = new GuestService(guestRepository, reservationRepository, organizationService);
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
            when(guestRepository.findByOrganizationId(eq(ORG_ID), any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(existing)));

            Guest result = guestService.findOrCreate("Marie", "Curie", "marie@test.com",
                    null, GuestChannel.BOOKING, "bk-456", ORG_ID);

            assertThat(result.getId()).isEqualTo(2L);
        }

        @Test
        void whenEmailMatchIsCaseInsensitive_thenFindsExisting() {
            Guest existing = buildGuest(3L, "Test", "User");
            existing.setEmail("TEST@EMAIL.COM");
            // channel=DIRECT, channelGuestId=null → skips channel dedup (line 60)
            when(guestRepository.findByOrganizationId(eq(ORG_ID), any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(existing)));

            Guest result = guestService.findOrCreate("Test", "User", "test@email.com",
                    null, GuestChannel.DIRECT, null, ORG_ID);

            assertThat(result.getId()).isEqualTo(3L);
        }

        @Test
        void whenNoMatch_thenCreatesNewGuest() {
            when(guestRepository.findByOrganizationId(eq(ORG_ID), any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of()));
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

            verify(guestRepository, never()).findByOrganizationId(any(), any(Pageable.class));
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

    @Nested
    class ChannelResolution {

        @Test
        void whenSourceIsVrbo_thenChannelIsVrbo() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreateFromName("Test", "vrbo", ORG_ID);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getChannel()).isEqualTo(GuestChannel.VRBO);
        }

        @Test
        void whenSourceIsAbritel_thenChannelIsVrbo() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreateFromName("Test", "abritel", ORG_ID);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getChannel()).isEqualTo(GuestChannel.VRBO);
        }

        @Test
        void whenSourceIsIcal_thenChannelIsIcal() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreateFromName("Test", "ical", ORG_ID);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getChannel()).isEqualTo(GuestChannel.ICAL);
        }

        @Test
        void whenSourceIsManual_thenChannelIsDirect() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreateFromName("Test", "manual", ORG_ID);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getChannel()).isEqualTo(GuestChannel.DIRECT);
        }

        @Test
        void whenSourceIsUnknown_thenChannelIsOther() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreateFromName("Test", "unknown-source", ORG_ID);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getChannel()).isEqualTo(GuestChannel.OTHER);
        }

        @Test
        void whenSourceIsNull_thenChannelIsOther() {
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreateFromName("Test", null, ORG_ID);

            ArgumentCaptor<Guest> captor = ArgumentCaptor.forClass(Guest.class);
            verify(guestRepository).save(captor.capture());
            assertThat(captor.getValue().getChannel()).isEqualTo(GuestChannel.OTHER);
        }
    }

    @Nested
    class UpdateIfNeeded {

        @Test
        void whenChannelMatch_andAllFieldsBlankOrSame_thenSkipsSave() {
            Guest existing = buildGuest(1L, "Jean", "Dupont");
            existing.setChannel(GuestChannel.AIRBNB);
            existing.setChannelGuestId("airbnb-123");
            existing.setEmail("jean@test.com");
            existing.setPhone("+33600000000");
            when(guestRepository.findByChannelAndChannelGuestId(
                    GuestChannel.AIRBNB, "airbnb-123", ORG_ID))
                    .thenReturn(Optional.of(existing));

            // Pass same firstName/lastName, blank email — should not save
            Guest result = guestService.findOrCreate("Jean", "Dupont", "  ", "  ",
                    GuestChannel.AIRBNB, "airbnb-123", ORG_ID);

            assertThat(result.getId()).isEqualTo(1L);
            verify(guestRepository, never()).save(any());
        }

        @Test
        void whenOnlyPhoneDifferent_thenUpdatesAndSaves() {
            Guest existing = buildGuest(1L, "Jean", "Dupont");
            existing.setChannel(GuestChannel.AIRBNB);
            existing.setChannelGuestId("airbnb-123");
            existing.setPhone("+33100000000");
            when(guestRepository.findByChannelAndChannelGuestId(
                    GuestChannel.AIRBNB, "airbnb-123", ORG_ID))
                    .thenReturn(Optional.of(existing));
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            guestService.findOrCreate(null, null, null, "+33600000000",
                    GuestChannel.AIRBNB, "airbnb-123", ORG_ID);

            verify(guestRepository).save(any(Guest.class));
            assertThat(existing.getPhone()).isEqualTo("+33600000000");
        }
    }

    @Nested
    class RecalculateAllStats {

        @Test
        void whenNoGuests_thenReturnsZero() {
            when(guestRepository.findAll()).thenReturn(List.of());

            int updated = guestService.recalculateAllStats();

            assertThat(updated).isZero();
            verify(guestRepository, never()).save(any());
        }

        @Test
        void whenStatsAreAlreadyCorrect_thenSkipsSave() {
            Guest guest = buildGuest(1L, "Jean", "Dupont");
            guest.setTotalStays(1);
            guest.setTotalSpent(BigDecimal.valueOf(100));

            when(guestRepository.findAll()).thenReturn(List.of(guest));
            // Agregat SQL [guestId, count, totalSpent] — audit perf 2026-07-21
            when(reservationRepository.aggregateConfirmedStaysByGuest())
                    .thenReturn(List.<Object[]>of(new Object[]{1L, 1L, BigDecimal.valueOf(100)}));

            int updated = guestService.recalculateAllStats();

            assertThat(updated).isZero();
            verify(guestRepository, never()).save(any(Guest.class));
        }

        @Test
        void whenStatsDifferent_thenUpdatesGuest() {
            Guest guest = buildGuest(1L, "Jean", "Dupont");
            guest.setTotalStays(5);
            guest.setTotalSpent(BigDecimal.valueOf(500));

            when(guestRepository.findAll()).thenReturn(List.of(guest));
            // 2 sejours confirmes (dont 1 sans prix), 120 depenses — l'agregat SQL
            // exclut deja les annulees et neutralise les prix null.
            when(reservationRepository.aggregateConfirmedStaysByGuest())
                    .thenReturn(List.<Object[]>of(new Object[]{1L, 2L, BigDecimal.valueOf(120)}));
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            int updated = guestService.recalculateAllStats();

            assertThat(updated).isEqualTo(1);
            assertThat(guest.getTotalStays()).isEqualTo(2);
            assertThat(guest.getTotalSpent()).isEqualByComparingTo("120");
        }

        @Test
        void whenGuestHasNoConfirmedReservations_thenResetsToZero() {
            Guest guest = buildGuest(1L, "Jean", "Dupont");
            guest.setTotalStays(3);
            guest.setTotalSpent(BigDecimal.valueOf(200));

            when(guestRepository.findAll()).thenReturn(List.of(guest));
            // Aucune ligne agregee pour ce guest → compteurs remis a zero.
            when(reservationRepository.aggregateConfirmedStaysByGuest()).thenReturn(List.of());
            when(guestRepository.save(any(Guest.class))).thenAnswer(inv -> inv.getArgument(0));

            int updated = guestService.recalculateAllStats();

            assertThat(updated).isEqualTo(1);
            assertThat(guest.getTotalStays()).isZero();
            assertThat(guest.getTotalSpent()).isEqualByComparingTo("0");
        }
    }

    // ===== LIST GUESTS PAGE (mode pagine opt-in) =====

    @Nested
    class ListGuestsPage {

        @Test
        void whenNoSearch_thenUsesSqlPaginationAndSqlCount() {
            Guest g1 = buildGuest(1L, "Alice", "Dupont");
            Pageable expected = PageRequest.of(1, 25);
            when(guestRepository.findByOrganizationId(eq(ORG_ID), eq(expected)))
                    .thenReturn(new PageImpl<>(List.of(g1), expected, 51));

            GuestPageDto result = guestService.listGuestsPage(ORG_ID, null, null, 1, 25);

            assertThat(result.content()).hasSize(1);
            assertThat(result.page()).isEqualTo(1);
            assertThat(result.size()).isEqualTo(25);
            assertThat(result.totalElements()).isEqualTo(51);
            // Aucun chargement complet en memoire dans ce mode.
            verify(guestRepository, never()).findByOrganizationId(ORG_ID);
        }

        @Test
        void whenNoSearchWithChannel_thenUsesPaginatedChannelQuery() {
            Guest g = buildGuest(2L, "Bob", "Martin");
            g.setChannel(GuestChannel.AIRBNB);
            when(guestRepository.findByOrganizationIdAndChannel(
                    eq(ORG_ID), eq(GuestChannel.AIRBNB), any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(g), PageRequest.of(0, 10), 1));

            GuestPageDto result = guestService.listGuestsPage(ORG_ID, null, "airbnb", 0, 10);

            assertThat(result.content()).hasSize(1);
            assertThat(result.content().get(0).channel()).isEqualTo("AIRBNB");
            assertThat(result.totalElements()).isEqualTo(1);
        }

        @Test
        void whenSearch_thenFiltersInMemoryAndPaginatesServerSide() {
            Guest g1 = buildGuest(1L, "Alice", "Dupont");
            Guest g2 = buildGuest(2L, "Alicia", "Durand");
            Guest g3 = buildGuest(3L, "Aline", "Dubois");
            Guest g4 = buildGuest(4L, "Bob", "Martin");
            when(guestRepository.findByOrganizationId(ORG_ID))
                    .thenReturn(List.of(g1, g2, g3, g4));

            // 3 "ali*" matchent ; page 1 de taille 2 → 1 seul element renvoye.
            GuestPageDto result = guestService.listGuestsPage(ORG_ID, "ali", null, 1, 2);

            assertThat(result.totalElements()).isEqualTo(3);
            assertThat(result.content()).hasSize(1);
            assertThat(result.content().get(0).firstName()).isEqualTo("Aline");
        }

        @Test
        void whenSearchPageBeyondEnd_thenEmptyContentButCorrectTotal() {
            Guest g1 = buildGuest(1L, "Alice", "Dupont");
            when(guestRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(g1));

            GuestPageDto result = guestService.listGuestsPage(ORG_ID, "alice", null, 5, 10);

            assertThat(result.content()).isEmpty();
            assertThat(result.totalElements()).isEqualTo(1);
        }

        @Test
        void whenUnknownChannel_thenEmptyPage() {
            GuestPageDto result = guestService.listGuestsPage(ORG_ID, null, "NOPE", 0, 25);

            assertThat(result.content()).isEmpty();
            assertThat(result.totalElements()).isZero();
        }

        @Test
        void whenCrossTenant_thenPaginatedCrossOrgQueryWithOrgNames() {
            Guest g = buildGuest(1L, "Alice", "Dupont"); // ORG_ID = 1
            Organization orgA = new Organization();
            orgA.setId(ORG_ID);
            orgA.setName("Org A");
            when(organizationService.findAll()).thenReturn(List.of(orgA));
            when(guestRepository.findAllGuests(any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(g), PageRequest.of(0, 25), 1));

            GuestPageDto result = guestService.listGuestsPage(null, null, null, 0, 25);

            assertThat(result.content()).hasSize(1);
            assertThat(result.content().get(0).organizationName()).isEqualTo("Org A");
        }
    }
}
