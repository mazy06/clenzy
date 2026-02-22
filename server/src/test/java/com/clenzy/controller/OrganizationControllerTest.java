package com.clenzy.controller;

import com.clenzy.dto.OrganizationDto;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.OrganizationService;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrganizationControllerTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationMemberRepository memberRepository;
    @Mock private OrganizationService organizationService;

    private OrganizationController controller;

    private Organization createOrg(Long id, String name) {
        Organization org = new Organization();
        org.setId(id);
        org.setName(name);
        org.setType(OrganizationType.INDIVIDUAL);
        org.setSlug("slug-" + id);
        return org;
    }

    @BeforeEach
    void setUp() {
        controller = new OrganizationController(organizationRepository, memberRepository, organizationService);
    }

    @Nested
    @DisplayName("listAll")
    class ListAll {
        @Test
        void whenListAll_thenReturnsOrganizations() {
            Organization org = createOrg(1L, "Org A");
            when(organizationRepository.findAll()).thenReturn(List.of(org));
            when(memberRepository.countByOrganizationId(1L)).thenReturn(5L);

            ResponseEntity<List<OrganizationDto>> response = controller.listAll();
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
            assertThat(response.getBody().get(0).getName()).isEqualTo("Org A");
            assertThat(response.getBody().get(0).getMemberCount()).isEqualTo(5);
        }
    }

    @Nested
    @DisplayName("getById")
    class GetById {
        @Test
        void whenExists_thenReturnsOrg() {
            Organization org = createOrg(1L, "Org A");
            when(organizationRepository.findById(1L)).thenReturn(Optional.of(org));
            when(memberRepository.countByOrganizationId(1L)).thenReturn(3L);

            ResponseEntity<OrganizationDto> response = controller.getById(1L);
            assertThat(response.getBody().getName()).isEqualTo("Org A");
        }

        @Test
        void whenNotFound_thenThrows() {
            when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> controller.getById(1L))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void whenValidName_thenCreates() {
            Organization org = createOrg(1L, "New Org");
            when(organizationService.createStandalone("New Org", OrganizationType.INDIVIDUAL)).thenReturn(org);
            when(memberRepository.countByOrganizationId(1L)).thenReturn(0L);

            ResponseEntity<OrganizationDto> response = controller.create(Map.of("name", "New Org"));
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }

        @Test
        void whenNullName_thenBadRequest() {
            ResponseEntity<OrganizationDto> response = controller.create(Map.of());
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenBlankName_thenBadRequest() {
            ResponseEntity<OrganizationDto> response = controller.create(Map.of("name", "  "));
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        void whenValidType_thenUsesIt() {
            Organization org = createOrg(1L, "Conciergerie");
            org.setType(OrganizationType.CONCIERGE);
            when(organizationService.createStandalone("Conciergerie", OrganizationType.CONCIERGE)).thenReturn(org);
            when(memberRepository.countByOrganizationId(1L)).thenReturn(0L);

            Map<String, String> body = Map.of("name", "Conciergerie", "type", "CONCIERGE");
            ResponseEntity<OrganizationDto> response = controller.create(body);
            assertThat(response.getStatusCode().value()).isEqualTo(201);
        }

        @Test
        void whenInvalidType_thenBadRequest() {
            Map<String, String> body = Map.of("name", "Test", "type", "INVALID");
            ResponseEntity<OrganizationDto> response = controller.create(body);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void whenUpdate_thenDelegates() {
            Organization org = createOrg(1L, "Updated");
            when(organizationService.updateOrganization(1L, "Updated", null)).thenReturn(org);
            when(memberRepository.countByOrganizationId(1L)).thenReturn(0L);

            ResponseEntity<OrganizationDto> response = controller.update(1L, Map.of("name", "Updated"));
            assertThat(response.getBody().getName()).isEqualTo("Updated");
        }

        @Test
        void whenInvalidType_thenBadRequest() {
            Map<String, String> body = Map.of("type", "BAD");
            ResponseEntity<OrganizationDto> response = controller.update(1L, body);
            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }
    }

    @Nested
    @DisplayName("delete")
    class Delete {
        @Test
        void whenDelete_thenDelegates() {
            controller.delete(1L);
            verify(organizationService).deleteOrganization(1L);
        }
    }
}
