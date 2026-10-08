package com.clenzy.service.migration;

import com.clenzy.model.PmsMigrationPlan;
import com.clenzy.repository.PmsImportBatchRepository;
import com.clenzy.repository.PmsMigrationPlanRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PmsMigrationPlanServiceTest {
    private final PmsMigrationPlanRepository plans = mock(PmsMigrationPlanRepository.class);
    private final PmsImportBatchRepository batches = mock(PmsImportBatchRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-07T08:00:00Z"), ZoneOffset.UTC);
    private final PmsMigrationPlanService service = new PmsMigrationPlanService(plans, batches, new ObjectMapper(), clock);
    private final PmsImportService.Actor actor = new PmsImportService.Actor(1L, "owner", false);

    @Test void deadlinesDeriveFromContractEndAndImportStepFromCompletedBatches() {
        when(plans.findByOrganizationIdAndCreatedBy(1L, "owner")).thenReturn(Optional.empty());
        when(plans.save(any())).thenAnswer(call -> call.getArgument(0));
        when(batches.existsByOrganizationIdAndCreatedByAndStatus(1L, "owner", "COMPLETED")).thenReturn(true);
        var view = service.save(new PmsMigrationPlanService.Update("guesty", LocalDate.of(2026, 12, 31), 30,
            Map.of("EXPORT_RESERVATIONS", true, "EXPORT_GUESTS", false)), actor);
        assertThat(view.noticeDeadline()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(view.exportDeadline()).isEqualTo(LocalDate.of(2026, 12, 24));
        assertThat(view.daysUntilExportDeadline()).isEqualTo(78);
        assertThat(view.steps()).filteredOn(s -> s.key().equals("IMPORT_COMMITTED")).singleElement()
            .satisfies(s -> assertThat(s.done() && s.derived()).isTrue());
        assertThat(view.nextStep()).isEqualTo("EXPORT_GUESTS");
    }

    @Test void derivedOrUnknownStepsCannotBeTickedByHand() {
        when(plans.findByOrganizationIdAndCreatedBy(1L, "owner")).thenReturn(Optional.of(new PmsMigrationPlan()));
        assertThatThrownBy(() -> service.save(new PmsMigrationPlanService.Update(null, null, null,
            Map.of("IMPORT_COMMITTED", true)), actor)).hasMessage("PLAN_INVALID");
        assertThatThrownBy(() -> service.save(new PmsMigrationPlanService.Update(null, null, 9999, Map.of()), actor))
            .hasMessage("PLAN_INVALID");
        verify(plans, never()).save(any());
    }
}
