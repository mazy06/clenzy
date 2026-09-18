package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class MissionMapQueryService {
    public static final int PAGE_SIZE = 20;
    public record Filters(String search, String type, String status, String priority, Long propertyId,
                          Double north, Double south, Double east, Double west) {}
    public record Marker(Long id, String name, Double lat, Double lng) {}
    public record Overview(List<Marker> markers, long total, long late, long today, long completed) {}
    public record Batch(List<?> content, long totalElements, int number, boolean last) {}
    private record Scope(String from, String where, Map<String, Object> params, String date, boolean requests) {}

    private final EntityManager em;
    private final TenantContext tenant;
    private final UserRepository users;
    private final ServiceRequestService requests;
    private final InterventionMapper interventionMapper;

    public MissionMapQueryService(EntityManager em, TenantContext tenant, UserRepository users,
                                  ServiceRequestService requests, InterventionMapper interventionMapper) {
        this.em = em; this.tenant = tenant; this.users = users;
        this.requests = requests; this.interventionMapper = interventionMapper;
    }

    public Overview overview(String kind, Filters filters, Jwt jwt) {
        Scope scope = scope(kind, filters, jwt, false);
        return withAssignmentScope(scope, () -> overview(scope));
    }

    private Overview overview(Scope scope) {
        // Projection scalaire : aucune fiche, photo, équipe ou description chargée pour les points.
        List<Object[]> points = query("SELECT x.id, x.title, p.latitude, p.longitude" + scope.from
                + scope.where + " AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL ORDER BY x.id",
                Object[].class, scope).getResultList();
        List<Marker> markers = points.stream().map(row -> new Marker((Long) row[0], (String) row[1],
                ((Number) row[2]).doubleValue(), ((Number) row[3]).doubleValue())).toList();
        Map<String, Object> parameters = new HashMap<>(scope.params);
        LocalDateTime now = LocalDateTime.now();
        parameters.put("now", now);
        parameters.put("dayStart", now.toLocalDate().atStartOfDay());
        parameters.put("dayEnd", now.toLocalDate().plusDays(1).atStartOfDay());
        parameters.put("weekStart", now.minusDays(7));
        Scope statsScope = new Scope(scope.from, scope.where, parameters, scope.date, scope.requests);
        String state = "cast(x.status as string)";
        Object[] stats = query("SELECT count(x), "
                + "sum(case when " + state + " NOT IN ('COMPLETED','CANCELLED','REJECTED') AND " + scope.date + " < :now then 1 else 0 end), "
                + "sum(case when " + state + " NOT IN ('CANCELLED','REJECTED') AND " + scope.date + " >= :dayStart AND " + scope.date + " < :dayEnd then 1 else 0 end), "
                + "sum(case when " + state + " = 'COMPLETED' AND " + scope.date + " >= :weekStart AND " + scope.date + " <= :now then 1 else 0 end)"
                + scope.from + scope.where, Object[].class, statsScope).getSingleResult();
        return new Overview(markers, number(stats[0]), number(stats[1]), number(stats[2]), number(stats[3]));
    }

    public Batch page(String kind, Filters filters, int page, Jwt jwt) {
        if (page < 0 || page > Integer.MAX_VALUE / PAGE_SIZE) throw new IllegalArgumentException("Page invalide");
        Scope scope = scope(kind, filters, jwt, true);
        return withAssignmentScope(scope, () -> page(scope, page));
    }

    private Batch page(Scope scope, int page) {
        long total = query("SELECT count(x)" + scope.from + scope.where, Long.class, scope).getSingleResult();
        Map<String, Object> parameters = new HashMap<>(scope.params);
        parameters.put("now", LocalDateTime.now());
        Scope ordered = new Scope(scope.from, scope.where, parameters, scope.date, scope.requests);
        String order = " ORDER BY CASE WHEN cast(x.status as string) NOT IN ('COMPLETED','CANCELLED','REJECTED') AND "
                + scope.date + " < :now THEN 0 ELSE 1 END, " + scope.date + " ASC NULLS LAST, x.id ASC";
        List<?> content;
        if (scope.requests) {
            List<ServiceRequest> entities = query("SELECT x" + scope.from + scope.where + order,
                    ServiceRequest.class, ordered).setFirstResult(page * PAGE_SIZE).setMaxResults(PAGE_SIZE).getResultList();
            content = requests.readDtosWithMissionAssignment(entities);
        } else {
            List<Intervention> entities = query("SELECT x" + scope.from + scope.where + order,
                    Intervention.class, ordered).setFirstResult(page * PAGE_SIZE).setMaxResults(PAGE_SIZE).getResultList();
            content = entities.stream().map(entity -> interventionMapper.convertToListResponse(entity, null)).toList();
        }
        return new Batch(content, total, page, (long) (page + 1) * PAGE_SIZE >= total);
    }

    /** Les lectures inter-organisations restent limitées au prédicat explicite utilisateur/équipe. */
    private <T> T withAssignmentScope(Scope scope, java.util.function.Supplier<T> read) {
        if (scope.requests || scope.params.containsKey("orgId")) return read.get();
        org.hibernate.Session session = em.unwrap(org.hibernate.Session.class);
        org.hibernate.Filter filter = session.getEnabledFilter("organizationFilter");
        if (filter == null) return read.get();
        Object organizationId = ((org.hibernate.internal.FilterImpl) filter).getParameter("orgId");
        session.disableFilter("organizationFilter");
        try {
            return read.get();
        } finally {
            session.enableFilter("organizationFilter").setParameter("orgId", organizationId);
        }
    }

    private Scope scope(String kind, Filters filters, Jwt jwt, boolean bounded) {
        if (jwt == null) throw new AccessDeniedException("Authentification requise");
        boolean isRequest = switch (kind) {
            case "service-requests" -> true;
            case "interventions" -> false;
            default -> throw new IllegalArgumentException("Type de carte inconnu");
        };
        String from = " FROM " + (isRequest ? "ServiceRequest" : "Intervention") + " x LEFT JOIN x.property p";
        String date = isRequest ? "x.desiredDate" : "x.scheduledDate";
        Map<String, Object> params = new HashMap<>();
        params.put("orgId", tenant.getRequiredOrganizationId());
        StringBuilder where = new StringBuilder(" WHERE x.organizationId = :orgId");
        if (isRequest) where.append(" AND ").append(com.clenzy.repository.ServiceRequestReadScope.OPEN);
        UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        if (!role.isPlatformStaff()) {
            User user = users.findByKeycloakId(jwt.getSubject())
                    .orElseThrow(() -> new AccessDeniedException("Utilisateur inconnu"));
            params.put("userId", user.getId());
            if (role == UserRole.HOST) {
                where.append(" AND p.owner.id = :userId");
            } else {
                // Comme la liste d'interventions : un prestataire conserve l'accès
                // à ses missions attribuées par une autre organisation.
                if (!isRequest) {
                    where = new StringBuilder(" WHERE 1 = 1");
                    params.remove("orgId");
                }
                String assignment = isRequest
                        ? "((x.assignedToType = 'user' AND x.assignedToId = :userId) OR (x.assignedToType = 'team' AND EXISTS (SELECT tm.id FROM TeamMember tm WHERE tm.team.id = x.assignedToId AND tm.user.id = :userId)))"
                        : "(x.assignedUser.id = :userId OR EXISTS (SELECT tm.id FROM TeamMember tm WHERE tm.team.id = x.teamId AND tm.user.id = :userId))";
                where.append(" AND ").append(assignment);
            }
        }
        addFilter(where, params, "type", isRequest ? "cast(x.serviceType as string)" : "x.type", filters.type);
        addFilter(where, params, "status", "cast(x.status as string)", filters.status);
        addFilter(where, params, "priority", "cast(x.priority as string)", filters.priority);
        if (filters.propertyId != null) {
            where.append(" AND p.id = :propertyId"); params.put("propertyId", filters.propertyId);
        }
        if (filters.search != null && !filters.search.isBlank()) {
            where.append(" AND (locate(:search, lower(coalesce(x.title,''))) > 0 OR locate(:search, lower(coalesce(x.description,''))) > 0 OR locate(:search, lower(coalesce(p.name,''))) > 0)");
            params.put("search", filters.search.toLowerCase(Locale.ROOT).strip());
        }
        if (bounded) {
            where.append(" AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL");
            if (filters.north != null || filters.south != null || filters.east != null || filters.west != null) {
                validateBounds(filters);
                where.append(" AND p.latitude BETWEEN :south AND :north AND ");
                where.append(filters.west > filters.east
                        ? "(p.longitude >= :west OR p.longitude <= :east)"
                        : "p.longitude BETWEEN :west AND :east");
                params.put("south", java.math.BigDecimal.valueOf(filters.south)); params.put("north", java.math.BigDecimal.valueOf(filters.north));
                params.put("west", java.math.BigDecimal.valueOf(filters.west)); params.put("east", java.math.BigDecimal.valueOf(filters.east));
            }
        }
        return new Scope(from, where.toString(), params, date, isRequest);
    }

    static void validateBounds(Filters f) {
        if (f.north == null || f.south == null || f.east == null || f.west == null
                || !Double.isFinite(f.north) || !Double.isFinite(f.south) || !Double.isFinite(f.east) || !Double.isFinite(f.west)
                || f.south < -90 || f.north > 90 || f.south > f.north
                || f.west < -180 || f.west > 180 || f.east < -180 || f.east > 180)
            throw new IllegalArgumentException("Zone géographique invalide");
    }

    private static void addFilter(StringBuilder where, Map<String, Object> params, String name, String field, String value) {
        if (value != null && !value.isBlank() && !value.equalsIgnoreCase("all")) {
            where.append(" AND upper(").append(field).append(") = :").append(name);
            params.put(name, value.toUpperCase(Locale.ROOT));
        }
    }
    private <T> TypedQuery<T> query(String jpql, Class<T> type, Scope scope) {
        TypedQuery<T> query = em.createQuery(jpql, type);
        scope.params.forEach(query::setParameter);
        return query;
    }
    private static long number(Object value) { return value == null ? 0 : ((Number) value).longValue(); }
}
