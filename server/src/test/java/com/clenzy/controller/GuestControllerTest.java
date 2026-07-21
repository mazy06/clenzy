package com.clenzy.controller;

import com.clenzy.dto.GuestDto;
import com.clenzy.dto.GuestListDto;
import com.clenzy.model.Guest;
import com.clenzy.model.GuestChannel;
import com.clenzy.model.Organization;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.GuestService;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link GuestController}.
 *
 * Covers list (super-admin cross-tenant + scoped), search by name, create with dedup,
 * update email with ownership check, recalculateStats.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("GuestController")
class GuestControllerTest {

    @Mock private GuestRepository guestRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private UserRepository userRepository;
    @Mock private TenantContext tenantContext;

    private GuestService guestService;
    private GuestController controller;

    @BeforeEach
    void setUp() {
        // Services REELS au-dessus des repositories mockes (pattern Vague A) ;
        // spy pour stubber findOrCreate/recalculateAllStats au niveau service.
        OrganizationService organizationService =
            new OrganizationService(organizationRepository, memberRepository, userRepository,
                org.mockito.Mockito.mock(com.clenzy.service.AutomationRuleService.class));
        guestService = spy(new GuestService(guestRepository, reservationRepository, organizationService));
        controller = new GuestController(guestService, tenantContext);
    }

    private Guest newGuest(Long id, Long orgId, String first, String last, String email, GuestChannel ch) {
        Guest g = new Guest(first, last, orgId);
        g.setId(id);
        g.setEmail(email);
        g.setChannel(ch);
        return g;
    }

    @Nested
    @DisplayName("list")
    class ListGuests {

        @Test
        @DisplayName("super-admin -> cross-tenant fetch + orgName lookup")
        void whenSuperAdmin_thenCrossTenant() {
            when(tenantContext.isSuperAdmin()).thenReturn(true);
            Organization org1 = new Organization(); org1.setId(1L); org1.setName("Org A");
            Organization org2 = new Organization(); org2.setId(2L); org2.setName("Org B");
            when(organizationRepository.findAll()).thenReturn(List.of(org1, org2));
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", "alice@x.com", GuestChannel.DIRECT);
            Guest g2 = newGuest(2L, 2L, "Bob", "Martin", "bob@x.com", GuestChannel.AIRBNB);
            when(guestRepository.findAllOrderByLastName()).thenReturn(List.of(g1, g2));

            ResponseEntity<List<GuestListDto>> response = controller.list(null, null);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(response.getBody()).hasSize(2);
            assertThat(response.getBody().get(0).organizationName()).isEqualTo("Org A");
            assertThat(response.getBody().get(1).organizationName()).isEqualTo("Org B");
        }

        @Test
        @DisplayName("non super-admin -> scoped to org, orgName empty")
        void whenScoped_thenOnlyOrgGuests() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            Guest g = newGuest(1L, 7L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            when(guestRepository.findByOrganizationId(7L)).thenReturn(List.of(g));

            ResponseEntity<List<GuestListDto>> response = controller.list(null, null);

            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).organizationName()).isNull();
            verify(organizationRepository, never()).findAll();
        }

        @Test
        @DisplayName("search by firstName (case-insensitive) -> matches")
        void whenSearchByFirstName_thenFilters() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", "a@x.com", GuestChannel.DIRECT);
            Guest g2 = newGuest(2L, 1L, "Bob", "Martin", "b@x.com", GuestChannel.AIRBNB);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1, g2));

            ResponseEntity<List<GuestListDto>> response = controller.list("ali", null);

            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).firstName()).isEqualTo("Alice");
        }

        @Test
        @DisplayName("search by lastName -> matches")
        void whenSearchByLastName_thenFilters() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            Guest g2 = newGuest(2L, 1L, "Bob", "Martin", null, GuestChannel.AIRBNB);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1, g2));

            ResponseEntity<List<GuestListDto>> response = controller.list("MARTIN", null);

            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).lastName()).isEqualTo("Martin");
        }

        @Test
        @DisplayName("search by full name -> matches")
        void whenSearchByFullName_thenMatches() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1));

            ResponseEntity<List<GuestListDto>> response = controller.list("alice dupont", null);

            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        @DisplayName("search by email -> matches")
        void whenSearchByEmail_thenMatches() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", "alice@example.com", GuestChannel.DIRECT);
            Guest g2 = newGuest(2L, 1L, "Bob", "Martin", "bob@example.com", GuestChannel.AIRBNB);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1, g2));

            ResponseEntity<List<GuestListDto>> response = controller.list("alice@", null);

            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).email()).isEqualTo("alice@example.com");
        }

        @Test
        @DisplayName("search < 2 chars -> filter ignored")
        void whenSearchTooShort_thenReturnsAll() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1));

            ResponseEntity<List<GuestListDto>> response = controller.list("a", null);

            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        @DisplayName("channel filter -> filtered in SQL by enum")
        void whenChannelFilter_thenFilters() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g2 = newGuest(2L, 1L, "Bob", "Martin", null, GuestChannel.AIRBNB);
            // Le filtre channel est desormais applique en SQL (champ non chiffre).
            when(guestRepository.findByOrganizationIdAndChannel(1L, GuestChannel.AIRBNB))
                    .thenReturn(List.of(g2));

            ResponseEntity<List<GuestListDto>> response = controller.list(null, "AIRBNB");

            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).channel()).isEqualTo("AIRBNB");
        }

        @Test
        @DisplayName("channel blank -> ignored")
        void whenChannelBlank_thenIgnored() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1));

            ResponseEntity<List<GuestListDto>> response = controller.list(null, "  ");

            assertThat(response.getBody()).hasSize(1);
        }

        @Test
        @DisplayName("search not matching anywhere -> empty result")
        void whenNoMatch_thenEmpty() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1));

            ResponseEntity<List<GuestListDto>> response = controller.list("zzz", null);
            assertThat(response.getBody()).isEmpty();
        }

        @Test
        @DisplayName("null channel on guest with channel filter -> filtered out (SQL)")
        void whenGuestChannelNullAndFilterSet_thenExcluded() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            // Un guest sans channel ne matche pas le filtre SQL par canal.
            when(guestRepository.findByOrganizationIdAndChannel(1L, GuestChannel.AIRBNB))
                    .thenReturn(List.of());

            ResponseEntity<List<GuestListDto>> response = controller.list(null, "AIRBNB");
            assertThat(response.getBody()).isEmpty();
        }
    }

    @Nested
    @DisplayName("listPaged")
    class ListPaged {

        @Test
        @DisplayName("no search -> true SQL pagination + envelope {content, totalElements}")
        void whenNoSearch_thenSqlPagination() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(7L);
            Guest g = newGuest(1L, 7L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            when(guestRepository.findByOrganizationId(eq(7L), any(org.springframework.data.domain.Pageable.class)))
                    .thenReturn(new org.springframework.data.domain.PageImpl<>(
                            List.of(g), org.springframework.data.domain.PageRequest.of(0, 25), 60));

            ResponseEntity<com.clenzy.dto.GuestPageDto> response =
                    controller.listPaged(null, null, 0, 25);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(response.getBody().content()).hasSize(1);
            assertThat(response.getBody().totalElements()).isEqualTo(60);
            assertThat(response.getBody().page()).isZero();
            assertThat(response.getBody().size()).isEqualTo(25);
        }

        @Test
        @DisplayName("with search -> in-memory filter then server-side slice (payload bounded)")
        void whenSearch_thenServerSideSlice() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            Guest g2 = newGuest(2L, 1L, "Alicia", "Durand", null, GuestChannel.DIRECT);
            Guest g3 = newGuest(3L, 1L, "Bob", "Martin", null, GuestChannel.DIRECT);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1, g2, g3));

            ResponseEntity<com.clenzy.dto.GuestPageDto> response =
                    controller.listPaged("ali", null, 0, 1);

            // 2 matchent, mais le payload est borne a la page (1 element).
            assertThat(response.getBody().content()).hasSize(1);
            assertThat(response.getBody().totalElements()).isEqualTo(2);
        }

        @Test
        @DisplayName("negative page / oversized size -> clamped (0, 200)")
        void whenOutOfBoundsParams_thenClamped() {
            when(tenantContext.isSuperAdmin()).thenReturn(false);
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            org.mockito.ArgumentCaptor<org.springframework.data.domain.Pageable> captor =
                    org.mockito.ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
            when(guestRepository.findByOrganizationId(eq(1L), captor.capture()))
                    .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of()));

            controller.listPaged(null, null, -3, 5000);

            assertThat(captor.getValue().getPageNumber()).isZero();
            assertThat(captor.getValue().getPageSize()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("search")
    class SearchByName {

        @Test
        @DisplayName("search null -> empty list (no repo call)")
        void whenSearchNull_thenEmpty() {
            ResponseEntity<List<GuestDto>> response = controller.search(null);
            assertThat(response.getBody()).isEmpty();
            verify(guestRepository, never()).findByOrganizationId(anyLong());
        }

        @Test
        @DisplayName("search blank -> empty")
        void whenSearchBlank_thenEmpty() {
            ResponseEntity<List<GuestDto>> response = controller.search("  ");
            assertThat(response.getBody()).isEmpty();
        }

        @Test
        @DisplayName("search < 2 chars -> empty")
        void whenSearchTooShort_thenEmpty() {
            ResponseEntity<List<GuestDto>> response = controller.search("a");
            assertThat(response.getBody()).isEmpty();
        }

        @Test
        @DisplayName("search matches -> returns limited results (up to 20)")
        void whenMatches_thenReturnsResults() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest g1 = newGuest(1L, 1L, "Alice", "Dupont", null, GuestChannel.DIRECT);
            Guest g2 = newGuest(2L, 1L, "Bob", "Martin", null, GuestChannel.DIRECT);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of(g1, g2));

            ResponseEntity<List<GuestDto>> response = controller.search("ali");

            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).firstName()).isEqualTo("Alice");
        }

        @Test
        @DisplayName("search matches but no result -> empty")
        void whenNoMatch_thenEmpty() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(guestRepository.findByOrganizationId(1L)).thenReturn(List.of());

            ResponseEntity<List<GuestDto>> response = controller.search("xx");
            assertThat(response.getBody()).isEmpty();
        }
    }

    @Nested
    @DisplayName("create")
    class CreateGuest {

        @Test
        @DisplayName("create -> delegates to createDirect + returns DTO")
        void whenCreate_thenDelegatesToService() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            GuestDto input = new GuestDto(null, "Alice", "Dupont", "alice@x.com", "+33600000000", null, "fr", "FR", "VIP");

            Guest created = newGuest(99L, 1L, "Alice", "Dupont", "alice@x.com", GuestChannel.DIRECT);
            doReturn(GuestService.toDto(created)).when(guestService).createDirect(eq(input), eq(1L));

            ResponseEntity<GuestDto> response = controller.create(input);

            assertThat(response.getBody().id()).isEqualTo(99L);
            assertThat(response.getBody().firstName()).isEqualTo("Alice");
            assertThat(response.getBody().fullName()).isEqualTo("Alice Dupont");
        }
    }

    @Nested
    @DisplayName("updateEmail")
    class UpdateEmail {

        @Test
        @DisplayName("email blank -> 400")
        void whenEmailBlank_thenReturns400() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            ResponseEntity<GuestDto> response = controller.updateEmail(1L, Map.of("email", ""));
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("email missing -> 400")
        void whenEmailMissing_thenReturns400() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            ResponseEntity<GuestDto> response = controller.updateEmail(1L, Map.of());
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("guest not found -> 404")
        void whenGuestNotFound_thenReturns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(guestRepository.findById(99L)).thenReturn(java.util.Optional.empty());

            ResponseEntity<GuestDto> response = controller.updateEmail(99L, Map.of("email", "new@x.com"));
            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        @DisplayName("guest belongs to other org -> 404 (ownership)")
        void whenGuestWrongOrg_thenReturns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest other = newGuest(1L, 99L, "Alice", "Dupont", "x@x.com", GuestChannel.DIRECT);
            when(guestRepository.findById(1L)).thenReturn(java.util.Optional.of(other));

            ResponseEntity<GuestDto> response = controller.updateEmail(1L, Map.of("email", "n@x.com"));
            assertThat(response.getStatusCode().value()).isEqualTo(404);
            verify(guestRepository, never()).save(any());
        }

        @Test
        @DisplayName("happy path -> updates email + 200")
        void whenSuccess_thenReturns200() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            Guest existing = newGuest(1L, 1L, "Alice", "Dupont", "old@x.com", GuestChannel.DIRECT);
            when(guestRepository.findById(1L)).thenReturn(java.util.Optional.of(existing));
            when(guestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ResponseEntity<GuestDto> response = controller.updateEmail(1L, Map.of("email", "  new@x.com  "));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().email()).isEqualTo("new@x.com");
            assertThat(existing.getEmail()).isEqualTo("new@x.com");
        }
    }

    @Nested
    @DisplayName("recalculateStats")
    class RecalculateStats {

        @Test
        @DisplayName("delegates to service + returns count")
        void whenCalled_thenReturnsCount() {
            doReturn(42).when(guestService).recalculateAllStats();

            Map<String, Object> response = controller.recalculateStats();

            assertThat(response).containsEntry("updated", 42);
            assertThat(response).containsEntry("status", "ok");
        }
    }
}
