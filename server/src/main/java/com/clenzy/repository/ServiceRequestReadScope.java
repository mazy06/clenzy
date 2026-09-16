package com.clenzy.repository;

/** Périmètre de la file des besoins restant à accepter, partagé par liste et carte. */
public final class ServiceRequestReadScope {
    private ServiceRequestReadScope() {}

    public static final String OPEN = """
        cast(x.status as string) IN ('PENDING', 'ASSIGNED')
        AND (x.assignmentPhase IS NULL OR x.assignmentPhase <> 'CONVERTED')
        AND NOT EXISTS (SELECT i.id FROM Intervention i WHERE i.serviceRequest.id = x.id)
        """;
}
