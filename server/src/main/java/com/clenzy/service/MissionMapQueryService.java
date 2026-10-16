package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;

@Service
@Transactional(readOnly = true)
public class MissionMapQueryService {
    public static final int PAGE_SIZE = 20;
    /** Écran Prestations : interventions et demandes ouvertes, dans une seule chronologie. */
    public static final String PRESTATIONS = "prestations";
    /** Profondeur maximale de la fusion paginée : au-delà, l'utilisateur affine ses filtres. */
    static final int MAX_PRESTATION_PAGE = 500;
    static final String INTERVENTION = "intervention";
    static final String REQUEST = "request";

    /**
     * Filtres communs. {@code category} (intervention|request) ne sert qu'aux prestations ;
     * {@code from}/{@code to} bornent la date de la mission (incluses) ; {@code assigneeType}
     * (user|team) et {@code assigneeId} désignent l'intervenant.
     */
    public record Filters(String search, String type, String status, String priority, Long propertyId,
                          Double north, Double south, Double east, Double west,
                          String category,
                          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                          String assigneeType, Long assigneeId) {}
    /**
     * Point d'une mission sur la carte. {@code state} colore l'épingle :
     * {@code late} (en retard), {@code today}, {@code planned}, {@code done}, {@code closed}.
     * {@code kind} vaut {@code intervention} ou {@code request} ; {@code propertyId} : son logement,
     * pour que la carte des logements regroupe les missions par épingle.
     */
    public record Marker(Long id, String name, Double lat, Double lng, String state, String kind, Long propertyId) {}
    public record Overview(List<Marker> markers, long total, long late, long today, long completed) {}
    public record Batch(List<?> content, long totalElements, int number, boolean last) {}
    /** Ligne de l'écran Prestations : la fiche de liste habituelle de son type, sous un id unique. */
    public record PrestationRow(String id, String kind, Object item) {}
    private record Scope(String from, String where, Map<String, Object> params, String date, boolean requests) {
        String kind() { return requests ? REQUEST : INTERVENTION; }
    }
    private record PrestationKey(Long id, boolean request, LocalDateTime date, String status) {}

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
        if (PRESTATIONS.equals(kind)) return prestationsOverview(filters, jwt);
        Scope scope = scope(kind, filters, jwt, false);
        return withAssignmentScope(scope, () -> overview(scope));
    }

    private Overview prestationsOverview(Filters filters, Jwt jwt) {
        List<Overview> parts = prestationScopes(filters, jwt, false).stream()
                .map(scope -> withAssignmentScope(scope, () -> overview(scope))).toList();
        return new Overview(parts.stream().flatMap(part -> part.markers().stream()).toList(),
                parts.stream().mapToLong(Overview::total).sum(), parts.stream().mapToLong(Overview::late).sum(),
                parts.stream().mapToLong(Overview::today).sum(), parts.stream().mapToLong(Overview::completed).sum());
    }

    private Overview overview(Scope scope) {
        // Projection scalaire : aucune fiche, photo, équipe ou description chargée pour les points.
        List<Object[]> points = query("SELECT x.id, x.title, p.latitude, p.longitude, cast(x.status as string), "
                + scope.date + ", p.id" + scope.from
                + scope.where + " AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL ORDER BY x.id",
                Object[].class, scope).getResultList();
        LocalDateTime now = LocalDateTime.now();
        List<Marker> markers = points.stream().map(row -> new Marker((Long) row[0], (String) row[1],
                ((Number) row[2]).doubleValue(), ((Number) row[3]).doubleValue(),
                markerState((String) row[4], (LocalDateTime) row[5], now), scope.kind(), (Long) row[6])).toList();
        Map<String, Object> parameters = new HashMap<>(scope.params);
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

    /** Même règle que les compteurs de l'aperçu : « en retard » = ni terminée ni annulée, date passée. */
    static String markerState(String status, LocalDateTime date, LocalDateTime now) {
        if ("COMPLETED".equals(status)) return "done";
        if ("CANCELLED".equals(status) || "REJECTED".equals(status)) return "closed";
        if (date == null) return "planned";
        if (date.isBefore(now)) return "late";
        if (date.toLocalDate().equals(now.toLocalDate())) return "today";
        return "planned";
    }

    /** Lot de la carte : seules les missions localisées dans la zone visible. */
    public Batch page(String kind, Filters filters, int page, Jwt jwt) {
        return read(kind, filters, page, jwt, true);
    }

    /** Page de la liste : toutes les missions filtrées, localisées ou non. */
    public Batch list(String kind, Filters filters, int page, Jwt jwt) {
        return read(kind, filters, page, jwt, false);
    }

    private Batch read(String kind, Filters filters, int page, Jwt jwt, boolean bounded) {
        if (page < 0 || page > Integer.MAX_VALUE / PAGE_SIZE) throw new IllegalArgumentException("Page invalide");
        if (PRESTATIONS.equals(kind)) return prestationsPage(filters, page, jwt, bounded);
        Scope scope = scope(kind, filters, jwt, bounded);
        return withAssignmentScope(scope, () -> page(scope, page));
    }

    private Batch page(Scope scope, int page) {
        long total = count(scope);
        Scope ordered = withNow(scope, LocalDateTime.now());
        List<?> content;
        if (scope.requests) {
            List<ServiceRequest> entities = query("SELECT x" + scope.from + scope.where + order(scope),
                    ServiceRequest.class, ordered).setFirstResult(page * PAGE_SIZE).setMaxResults(PAGE_SIZE).getResultList();
            content = requests.readDtosWithMissionAssignment(entities);
        } else {
            List<Intervention> entities = query("SELECT x" + scope.from + scope.where + order(scope),
                    Intervention.class, ordered).setFirstResult(page * PAGE_SIZE).setMaxResults(PAGE_SIZE).getResultList();
            content = entities.stream().map(entity -> interventionMapper.convertToListResponse(entity, null)).toList();
        }
        return new Batch(content, total, page, (long) (page + 1) * PAGE_SIZE >= total);
    }

    /**
     * Fusion paginée des deux files. Chacune est triée en base selon la même règle (en retard
     * d'abord, puis date croissante) : ses {@code (page + 1) × 20} premières clés suffisent à
     * composer exactement la page demandée de la suite commune. Seules les fiches de la page
     * sont ensuite chargées.
     */
    private Batch prestationsPage(Filters filters, int page, Jwt jwt, boolean bounded) {
        if (page > MAX_PRESTATION_PAGE) throw new IllegalArgumentException("Page invalide : affinez les filtres");
        LocalDateTime now = LocalDateTime.now();
        int depth = (page + 1) * PAGE_SIZE;
        List<Scope> scopes = prestationScopes(filters, jwt, bounded);
        long total = 0;
        List<PrestationKey> keys = new ArrayList<>();
        for (Scope scope : scopes) {
            total += withAssignmentScope(scope, () -> count(scope));
            keys.addAll(withAssignmentScope(scope, () -> topKeys(scope, depth, now)));
        }
        List<PrestationKey> slice = keys.stream().sorted(chronology(now))
                .skip((long) page * PAGE_SIZE).limit(PAGE_SIZE).toList();
        Map<String, Object> rows = new HashMap<>();
        for (Scope scope : scopes) {
            List<Long> ids = slice.stream().filter(key -> key.request() == scope.requests).map(PrestationKey::id).toList();
            if (!ids.isEmpty()) rows.putAll(withAssignmentScope(scope, () -> loadRows(scope, ids)));
        }
        List<PrestationRow> content = slice.stream()
                .map(key -> new PrestationRow(rowKey(key.request(), key.id()), key.request() ? REQUEST : INTERVENTION,
                        rows.get(rowKey(key.request(), key.id()))))
                .filter(row -> row.item() != null).toList();
        return new Batch(content, total, page, (long) (page + 1) * PAGE_SIZE >= total);
    }

    private List<Scope> prestationScopes(Filters filters, Jwt jwt, boolean bounded) {
        String category = filters.category == null ? "" : filters.category.strip().toLowerCase(Locale.ROOT);
        List<Scope> scopes = new ArrayList<>();
        if (category.isEmpty() || category.equals("all") || category.equals(INTERVENTION)) {
            scopes.add(scope("interventions", filters, jwt, bounded));
        }
        if (category.isEmpty() || category.equals("all") || category.equals(REQUEST)) {
            scopes.add(scope("service-requests", filters, jwt, bounded));
        }
        if (scopes.isEmpty()) throw new IllegalArgumentException("Type de prestation inconnu");
        return scopes;
    }

    private List<PrestationKey> topKeys(Scope scope, int depth, LocalDateTime now) {
        List<Object[]> rows = query("SELECT x.id, " + scope.date + ", cast(x.status as string)" + scope.from + scope.where + order(scope),
                Object[].class, withNow(scope, now)).setMaxResults(depth).getResultList();
        return rows.stream().map(row -> new PrestationKey((Long) row[0], scope.requests,
                (LocalDateTime) row[1], (String) row[2])).toList();
    }

    private Map<String, Object> loadRows(Scope scope, List<Long> ids) {
        Map<String, Object> rows = new HashMap<>();
        if (scope.requests) {
            List<ServiceRequest> entities = em.createQuery("SELECT x FROM ServiceRequest x WHERE x.id IN :ids", ServiceRequest.class)
                    .setParameter("ids", ids).getResultList();
            List<?> dtos = requests.readDtosWithMissionAssignment(entities);
            for (int index = 0; index < entities.size(); index++) rows.put(rowKey(true, entities.get(index).getId()), dtos.get(index));
        } else {
            em.createQuery("SELECT x FROM Intervention x WHERE x.id IN :ids", Intervention.class)
                    .setParameter("ids", ids).getResultList()
                    .forEach(entity -> rows.put(rowKey(false, entity.getId()), interventionMapper.convertToListResponse(entity, null)));
        }
        return rows;
    }

    private static String rowKey(boolean request, Long id) { return (request ? REQUEST : INTERVENTION) + ":" + id; }

    /** Même ordre que {@link #order(Scope)}, appliqué à la suite commune. */
    static Comparator<PrestationKey> chronology(LocalDateTime now) {
        Function<PrestationKey, Integer> lateFirst = key -> key.date() != null && key.date().isBefore(now)
                && !List.of("COMPLETED", "CANCELLED", "REJECTED").contains(key.status()) ? 0 : 1;
        return Comparator.comparing(lateFirst)
                .thenComparing(PrestationKey::date, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(PrestationKey::request)
                .thenComparing(PrestationKey::id);
    }

    private static String order(Scope scope) {
        return " ORDER BY CASE WHEN cast(x.status as string) NOT IN ('COMPLETED','CANCELLED','REJECTED') AND "
                + scope.date + " < :now THEN 0 ELSE 1 END, " + scope.date + " ASC NULLS LAST, x.id ASC";
    }

    private static Scope withNow(Scope scope, LocalDateTime now) {
        Map<String, Object> parameters = new HashMap<>(scope.params);
        parameters.put("now", now);
        return new Scope(scope.from, scope.where, parameters, scope.date, scope.requests);
    }

    private long count(Scope scope) {
        return query("SELECT count(x)" + scope.from + scope.where, Long.class, scope).getSingleResult();
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
        if (filters.from != null) {
            where.append(" AND ").append(date).append(" >= :periodStart"); params.put("periodStart", filters.from.atStartOfDay());
        }
        if (filters.to != null) {
            where.append(" AND ").append(date).append(" < :periodEnd"); params.put("periodEnd", filters.to.plusDays(1).atStartOfDay());
        }
        addAssigneeFilter(where, params, filters, isRequest);
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

    private static void addAssigneeFilter(StringBuilder where, Map<String, Object> params, Filters filters, boolean isRequest) {
        if (filters.assigneeId == null) return;
        boolean team = "team".equalsIgnoreCase(filters.assigneeType);
        if (!team && !"user".equalsIgnoreCase(filters.assigneeType)) throw new IllegalArgumentException("Type d'intervenant inconnu");
        String predicate = isRequest
                ? "(x.assignedToType = '" + (team ? "team" : "user") + "' AND x.assignedToId = :assigneeId)"
                : (team ? "x.teamId = :assigneeId" : "x.assignedUser.id = :assigneeId");
        where.append(" AND ").append(predicate);
        params.put("assigneeId", filters.assigneeId);
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
