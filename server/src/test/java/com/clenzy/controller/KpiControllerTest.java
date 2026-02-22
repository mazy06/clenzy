package com.clenzy.controller;

import com.clenzy.dto.kpi.KpiDtos.KpiHistoryDto;
import com.clenzy.dto.kpi.KpiDtos.KpiSnapshotDto;
import com.clenzy.service.KpiService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KpiControllerTest {

    @Mock private KpiService kpiService;

    private KpiController controller;

    @BeforeEach
    void setUp() {
        controller = new KpiController(kpiService);
    }

    @Nested
    @DisplayName("getCurrentSnapshot")
    class GetCurrent {
        @Test
        void whenSuccess_thenReturnsOk() {
            KpiSnapshotDto snapshot = mock(KpiSnapshotDto.class);
            when(kpiService.computeCurrentSnapshot()).thenReturn(snapshot);

            ResponseEntity<?> response = controller.getCurrentSnapshot();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isEqualTo(snapshot);
        }

        @Test
        void whenException_thenReturns500() {
            when(kpiService.computeCurrentSnapshot()).thenThrow(new RuntimeException("err"));

            ResponseEntity<?> response = controller.getCurrentSnapshot();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getHistory")
    class GetHistory {
        @Test
        void whenSuccess_thenReturnsOk() {
            KpiHistoryDto history = mock(KpiHistoryDto.class);
            when(kpiService.getHistory(24)).thenReturn(history);

            ResponseEntity<?> response = controller.getHistory(24);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenLargeHours_thenCapsAt720() {
            KpiHistoryDto history = mock(KpiHistoryDto.class);
            when(kpiService.getHistory(720)).thenReturn(history);

            ResponseEntity<?> response = controller.getHistory(1000);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(kpiService).getHistory(720);
        }

        @Test
        void whenException_thenReturns500() {
            when(kpiService.getHistory(anyInt())).thenThrow(new RuntimeException("err"));

            ResponseEntity<?> response = controller.getHistory(24);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("refreshSnapshot")
    class Refresh {
        @Test
        void whenSuccess_thenReturnsOk() {
            KpiSnapshotDto snapshot = mock(KpiSnapshotDto.class);
            when(kpiService.captureAndPersistSnapshot("MANUAL")).thenReturn(snapshot);

            ResponseEntity<?> response = controller.refreshSnapshot();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenException_thenReturns500() {
            when(kpiService.captureAndPersistSnapshot("MANUAL")).thenThrow(new RuntimeException("err"));

            ResponseEntity<?> response = controller.refreshSnapshot();

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
