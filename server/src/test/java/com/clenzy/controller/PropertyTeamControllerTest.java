package com.clenzy.controller;

import com.clenzy.dto.PropertyTeamDto;
import com.clenzy.dto.PropertyTeamRequest;
import com.clenzy.service.PropertyTeamService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PropertyTeamControllerTest {

    @Mock private PropertyTeamService propertyTeamService;

    private PropertyTeamController controller;

    @BeforeEach
    void setUp() {
        controller = new PropertyTeamController(propertyTeamService);
    }

    @Nested
    @DisplayName("getByProperty")
    class GetByProperty {
        @Test
        void whenExists_thenReturnsOk() {
            PropertyTeamDto dto = mock(PropertyTeamDto.class);
            when(propertyTeamService.getByProperty(1L)).thenReturn(Optional.of(dto));

            ResponseEntity<PropertyTeamDto> response = controller.getByProperty(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo(dto);
        }

        @Test
        void whenNotExists_thenReturnsNoContent() {
            when(propertyTeamService.getByProperty(1L)).thenReturn(Optional.empty());

            ResponseEntity<PropertyTeamDto> response = controller.getByProperty(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
        }
    }

    @Nested
    @DisplayName("getByProperties")
    class GetByProperties {
        @Test
        void whenSuccess_thenReturnsList() {
            List<PropertyTeamDto> dtos = List.of(mock(PropertyTeamDto.class));
            when(propertyTeamService.getByProperties(List.of(1L, 2L))).thenReturn(dtos);

            ResponseEntity<List<PropertyTeamDto>> response = controller.getByProperties(List.of(1L, 2L));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("assign")
    class Assign {
        @Test
        void whenSuccess_thenReturnsOk() {
            PropertyTeamRequest request = mock(PropertyTeamRequest.class);
            PropertyTeamDto dto = mock(PropertyTeamDto.class);
            when(propertyTeamService.assignTeamToProperty(request)).thenReturn(dto);

            ResponseEntity<PropertyTeamDto> response = controller.assign(request);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("remove")
    class Remove {
        @Test
        void whenSuccess_thenReturnsNoContent() {
            ResponseEntity<Void> response = controller.remove(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(204);
            verify(propertyTeamService).removeTeamFromProperty(1L);
        }
    }
}
