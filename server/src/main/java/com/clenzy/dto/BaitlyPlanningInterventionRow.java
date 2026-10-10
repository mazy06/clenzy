package com.clenzy.dto;

import com.clenzy.model.InterventionStatus;
import com.clenzy.model.PaymentStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/** Projection de l'index Baitly, sans hydratation des entités et de leurs coordonnées. */
public record BaitlyPlanningInterventionRow(Long id, Long propertyId, String propertyName,
        String serviceItemCode, String type, InterventionStatus status, String priority,
        String title, String description, LocalDateTime scheduledDate, Integer estimatedDurationHours,
        String notes, Long assigneeId,
        Long teamId, String teamName, Long serviceReservationId, PaymentStatus paymentStatus,
        BigDecimal estimatedCost, BigDecimal actualCost, LocalDateTime paidAt) {

    /** Conserver le contrat historique de l'index, y compris les fins après minuit. */
    public Map<String, Object> toPlanningMap(Long explicitReservationId, String resolvedAssigneeName) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", id); map.put("propertyId", propertyId);
        map.put("propertyName", propertyName != null ? propertyName : "");
        map.put("serviceItemCode", serviceItemCode);
        map.put("type", type != null ? type.toLowerCase(java.util.Locale.ROOT) : "cleaning");
        map.put("status", status == InterventionStatus.IN_PROGRESS ? "in_progress"
                : status == InterventionStatus.COMPLETED ? "completed"
                : status == InterventionStatus.CANCELLED ? "cancelled" : "scheduled");
        map.put("priority", priority != null ? priority.toLowerCase(java.util.Locale.ROOT) : "medium");
        map.put("title", title); map.put("description", description);
        String startDate = scheduledDate != null ? scheduledDate.toLocalDate().toString() : null;
        LocalDateTime end = scheduledDate != null && estimatedDurationHours != null
                ? scheduledDate.plusHours(estimatedDurationHours) : null;
        map.put("startDate", startDate);
        map.put("endDate", end != null ? end.toLocalDate().toString() : startDate);
        map.put("startTime", scheduledDate != null ? scheduledDate.toLocalTime().toString() : "11:00");
        map.put("endTime", end != null ? end.toLocalTime().toString() : null);
        map.put("estimatedDurationHours", estimatedDurationHours); map.put("notes", notes);
        String assigneeName = assigneeId != null
                ? resolvedAssigneeName
                : teamId != null ? teamName != null ? teamName : "Equipe #" + teamId : null;
        map.put("assigneeName", assigneeName);
        map.put("linkedReservationId", explicitReservationId != null ? explicitReservationId : serviceReservationId);
        map.put("paymentStatus", paymentStatus != null ? paymentStatus.name() : null);
        map.put("estimatedCost", estimatedCost); map.put("actualCost", actualCost); map.put("paidAt", paidAt);
        return map;
    }
}
