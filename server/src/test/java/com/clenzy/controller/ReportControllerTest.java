package com.clenzy.controller;

import com.clenzy.service.ReportService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportControllerTest {

    @Mock private ReportService reportService;

    private ReportController controller;

    @BeforeEach
    void setUp() {
        controller = new ReportController(reportService);
    }

    @Nested
    @DisplayName("generateFinancialReport")
    class Financial {
        @Test
        void whenSuccess_thenReturnsPdf() {
            byte[] pdf = "PDF content".getBytes();
            when(reportService.generateFinancialReport(eq("monthly"), any(), any())).thenReturn(pdf);

            ResponseEntity<?> response = controller.generateFinancialReport("monthly",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getContentType().toString()).contains("pdf");
        }

        @Test
        void whenEmptyResult_thenReturns500() {
            when(reportService.generateFinancialReport(eq("monthly"), any(), any())).thenReturn(new byte[0]);

            ResponseEntity<?> response = controller.generateFinancialReport("monthly",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }

        @Test
        void whenNullDates_thenUsesDefaults() {
            byte[] pdf = "PDF content".getBytes();
            when(reportService.generateFinancialReport(eq("monthly"), any(), any())).thenReturn(pdf);

            ResponseEntity<?> response = controller.generateFinancialReport("monthly", null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenException_thenReturns500() {
            when(reportService.generateFinancialReport(eq("monthly"), any(), any()))
                    .thenThrow(new RuntimeException("Generation failed"));

            ResponseEntity<?> response = controller.generateFinancialReport("monthly",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("generateInterventionReport")
    class Intervention {
        @Test
        void whenSuccess_thenReturnsPdf() {
            byte[] pdf = "PDF content".getBytes();
            when(reportService.generateInterventionReport(eq("summary"), any(), any())).thenReturn(pdf);

            ResponseEntity<?> response = controller.generateInterventionReport("summary",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenException_thenReturns500() {
            when(reportService.generateInterventionReport(eq("summary"), any(), any()))
                    .thenThrow(new RuntimeException("err"));

            ResponseEntity<?> response = controller.generateInterventionReport("summary", null, null);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("generateTeamReport")
    class Team {
        @Test
        void whenSuccess_thenReturnsPdf() {
            byte[] pdf = "PDF content".getBytes();
            when(reportService.generateTeamReport(eq("performance"), any(), any())).thenReturn(pdf);

            ResponseEntity<?> response = controller.generateTeamReport("performance",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }

    @Nested
    @DisplayName("generatePropertyReport")
    class Property {
        @Test
        void whenSuccess_thenReturnsPdf() {
            byte[] pdf = "PDF content".getBytes();
            when(reportService.generatePropertyReport(eq("occupancy"), any(), any())).thenReturn(pdf);

            ResponseEntity<?> response = controller.generatePropertyReport("occupancy",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }
    }
}
