package com.clenzy.booking.service;

import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.service.agent.kb.IngestionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Ingestion auto des hébergements dans la KB (2.13) : sourcePath stable par org, un chunk markdown
 * par hébergement, skip si aucun hébergement.
 */
@ExtendWith(MockitoExtension.class)
class PropertyKbIngestionServiceTest {

    @Mock private PublicBookingService bookingService;
    @Mock private IngestionService ingestionService;

    private PropertyKbIngestionService service() {
        return new PropertyKbIngestionService(bookingService, ingestionService);
    }

    private static PublicPropertyDto property(String name, String city, List<String> amenities) {
        return new PublicPropertyDto(
                1L, name, "Appartement", city, "France",
                2, 1, 4, 60,
                BigDecimal.valueOf(120), BigDecimal.valueOf(40), 2,
                "EUR", null, List.<String>of(), amenities,
                "15:00", "11:00", 7, 12, null, 0L, null);
    }

    @Test
    void ingestForOrg_buildsOneSectionPerPropertyAndIngestsWithStableSourcePath() {
        when(bookingService.resolveOrgById(7L)).thenReturn(new PublicBookingService.OrgContext(null, null));
        when(bookingService.getProperties(any())).thenReturn(List.of(
                property("Villa Azur", "Nice", List.of("Piscine", "Wifi")),
                property("Studio Centre", "Lyon", List.of("Wifi"))));

        when(ingestionService.ingestMarkdownIfChanged(eq("auto/properties/7"), anyString(), eq(7L), eq("fr")))
                .thenReturn(true);

        boolean ingested = service().ingestForOrg(7L);

        assertThat(ingested).isTrue();
        ArgumentCaptor<String> md = ArgumentCaptor.forClass(String.class);
        verify(ingestionService).ingestMarkdownIfChanged(eq("auto/properties/7"), md.capture(), eq(7L), eq("fr"));
        String doc = md.getValue();
        // Un ## par hébergement (= un chunk vectoriel propre) + détails publics.
        assertThat(doc).contains("## Villa Azur").contains("## Studio Centre");
        assertThat(doc).contains("Nice").contains("Piscine").contains("jusqu'à 4 voyageurs");
    }

    @Test
    void ingestForOrg_noProperties_skipsIngestion() {
        when(bookingService.resolveOrgById(9L)).thenReturn(new PublicBookingService.OrgContext(null, null));
        when(bookingService.getProperties(any())).thenReturn(List.of());

        assertThat(service().ingestForOrg(9L)).isFalse();
        verify(ingestionService, never()).ingestMarkdownIfChanged(anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void ingestForOrg_nullOrg_isNoOp() {
        assertThat(service().ingestForOrg(null)).isFalse();
        verify(ingestionService, never()).ingestMarkdownIfChanged(anyString(), anyString(), anyLong(), anyString());
    }
}
