package com.clenzy.service.voucher;

import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import com.clenzy.exception.VoucherException;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.Organization;
import com.clenzy.model.Property;
import com.clenzy.model.VoucherPropertyScope;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherCreatorOrgType;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import com.clenzy.repository.BookingVoucherRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.VoucherPropertyScopeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Service CRUD pour les {@link BookingVoucher}.
 *
 * <h3>Permissions</h3>
 * Deux cas distincts a l'autorisation de creation/edition :
 * <ul>
 *   <li><b>HOST</b> : le user est le proprietaire des properties cibles
 *       ({@code property.owner_id == requester.userId}). Toujours autorise.</li>
 *   <li><b>MANAGEMENT_ORG</b> : le user est un member de l'org qui gere les
 *       properties (typiquement une conciergerie). Autorise UNIQUEMENT si :
 *     <ol>
 *       <li>{@code organization.has_voucher_contract = true} : contrat signe
 *           globalement avec Baitly.</li>
 *       <li>{@code property.org_can_create_vouchers = true} pour CHAQUE
 *           property cible : consentement explicite du host pour ce logement.</li>
 *     </ol>
 *   </li>
 * </ul>
 *
 * <p>Le controller decide du {@link VoucherCreatorOrgType} en fonction de
 * l'identite du requester (typiquement : si requester est proprietaire de
 * toutes les properties cibles, c'est HOST ; sinon MANAGEMENT_ORG).</p>
 *
 * <h3>Multi-tenant</h3>
 * Toutes les queries sont automatiquement scopees via Hibernate
 * {@code @Filter(organizationFilter)} pose par {@code TenantFilter}.
 * Le service additionnel verifie explicitement que les properties cibles
 * appartiennent a l'org du voucher (defense en profondeur).
 */
@Service
@Transactional
public class BookingVoucherService {

    private static final Logger logger = LoggerFactory.getLogger(BookingVoucherService.class);

    /** Statuts modifiables : DRAFT, ACTIVE, PAUSED. EXPIRED est immuable. */
    private static final Set<VoucherStatus> MUTABLE_STATUSES =
        EnumSet.of(VoucherStatus.DRAFT, VoucherStatus.ACTIVE, VoucherStatus.PAUSED);

    private final BookingVoucherRepository voucherRepo;
    private final VoucherPropertyScopeRepository scopeRepo;
    private final PropertyRepository propertyRepo;
    private final OrganizationRepository orgRepo;

    // Constructeur unique → Spring l'utilise automatiquement, pas besoin
    // de @Autowired (interdit par CLAUDE.md Code Quality §1 DIP).
    public BookingVoucherService(
        BookingVoucherRepository voucherRepo,
        VoucherPropertyScopeRepository scopeRepo,
        PropertyRepository propertyRepo,
        OrganizationRepository orgRepo
    ) {
        this.voucherRepo = voucherRepo;
        this.scopeRepo = scopeRepo;
        this.propertyRepo = propertyRepo;
        this.orgRepo = orgRepo;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD principal
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Cree un nouveau voucher.
     *
     * @param orgId        org du voucher (= org qui aura la propriete logique)
     * @param userId       user createur (pour created_by_user_id)
     * @param creatorType  HOST ou MANAGEMENT_ORG (decide par le controller selon le requester)
     * @param payload      donnees du voucher a creer
     * @throws UnauthorizedException  si permissions insuffisantes
     * @throws VoucherException        si payload invalide ou property hors org
     */
    public BookingVoucher create(
        Long orgId,
        Long userId,
        VoucherCreatorOrgType creatorType,
        VoucherCreatePayload payload
    ) {
        validatePayload(payload);
        List<Property> targetProperties = resolveAndCheckProperties(orgId, payload.propertyIds());
        checkCreatePermissions(orgId, userId, creatorType, targetProperties);
        checkCodeUniqueness(orgId, payload.code(), null);

        BookingVoucher v = new BookingVoucher();
        v.setOrganizationId(orgId);
        v.setName(payload.name().trim());
        v.setDescription(payload.description());
        v.setCode(normalizeCode(payload.code()));
        v.setType(payload.type());
        v.setDiscountType(payload.discountType());
        v.setDiscountValue(payload.discountValue());
        v.setValidFrom(payload.validFrom());
        v.setValidUntil(payload.validUntil());
        v.setMinStayNights(payload.minStayNights());
        v.setMinTotalAmount(payload.minTotalAmount());
        v.setMaxStayNights(payload.maxStayNights());
        v.setMaxUsesTotal(payload.maxUsesTotal());
        v.setMaxUsesPerGuest(payload.maxUsesPerGuest());
        v.setChannelScope(payload.channelScope() != null ? payload.channelScope() : VoucherChannelScope.ALL);
        v.setStatus(payload.status() != null ? payload.status() : VoucherStatus.DRAFT);
        v.setCreatedByOrgType(creatorType);
        v.setCreatedByUserId(userId);

        BookingVoucher saved = voucherRepo.save(v);
        replaceScope(saved.getId(), orgId, payload.propertyIds());
        logger.info("Voucher created : id={}, code={}, orgId={}, by user={}, type={}, status={}",
            saved.getId(), saved.getCode(), orgId, userId, saved.getCreatedByOrgType(), saved.getStatus());
        return saved;
    }

    /**
     * Met a jour un voucher existant. Le {@code type} et {@code createdBy*}
     * ne sont pas modifiables. Verifie les permissions de la meme maniere que
     * la creation.
     */
    public BookingVoucher update(
        Long voucherId,
        Long orgId,
        Long userId,
        VoucherCreatorOrgType creatorType,
        VoucherUpdatePayload payload
    ) {
        BookingVoucher v = findOrThrow(voucherId, orgId);

        if (!MUTABLE_STATUSES.contains(v.getStatus())) {
            throw new VoucherException(
                "Voucher " + voucherId + " en statut " + v.getStatus() + " (non modifiable)");
        }

        // Fix H-NEW-2 : on revalide TOUJOURS les permissions a l'update sur
        // le scope effectif (nouveau si modifie, sinon existant). Le fix H3
        // initial introduisait un bypass d'autorisation pour MANAGEMENT_ORG
        // sur les vouchers "all properties" : un MANAGEMENT_ORG sans
        // has_voucher_contract pouvait alors editer un voucher cree par le
        // HOST original. La regle securisee : si le voucher cible "all
        // properties" et que le requester est MANAGEMENT_ORG, on exige le
        // contrat (sinon l'utilisateur doit explicitement restreindre le
        // scope, ce qui re-active resolveAndCheckProperties + consentement
        // org_can_create_vouchers).
        List<Long> nextScope = payload.propertyIds() != null
            ? payload.propertyIds()
            : List.copyOf(scopeRepo.findPropertyIdsByVoucherId(voucherId));
        List<Property> targets = resolveAndCheckProperties(orgId, nextScope);
        checkCreatePermissions(orgId, userId, creatorType, targets);

        if (payload.code() != null) {
            checkCodeUniqueness(orgId, payload.code(), voucherId);
            v.setCode(normalizeCode(payload.code()));
        }
        if (payload.name() != null) v.setName(payload.name().trim());
        if (payload.description() != null) v.setDescription(payload.description());
        if (payload.discountType() != null) v.setDiscountType(payload.discountType());
        if (payload.discountValue() != null) v.setDiscountValue(payload.discountValue());
        if (payload.validFrom() != null) v.setValidFrom(payload.validFrom());
        if (payload.validUntil() != null) v.setValidUntil(payload.validUntil());
        if (payload.minStayNights() != null) v.setMinStayNights(payload.minStayNights());
        if (payload.minTotalAmount() != null) v.setMinTotalAmount(payload.minTotalAmount());
        if (payload.maxStayNights() != null) v.setMaxStayNights(payload.maxStayNights());
        if (payload.maxUsesTotal() != null) v.setMaxUsesTotal(payload.maxUsesTotal());
        if (payload.maxUsesPerGuest() != null) v.setMaxUsesPerGuest(payload.maxUsesPerGuest());
        if (payload.channelScope() != null) v.setChannelScope(payload.channelScope());
        if (payload.status() != null) {
            checkStatusTransition(v.getStatus(), payload.status());
            v.setStatus(payload.status());
        }

        if (payload.propertyIds() != null) {
            replaceScope(voucherId, orgId, payload.propertyIds());
        }

        logger.info("Voucher updated : id={}, code={}", voucherId, v.getCode());
        return voucherRepo.save(v);
    }

    /** Supprime un voucher. Les rows {@code voucher_usage} sont preservees (RESTRICT). */
    public void delete(Long voucherId, Long orgId) {
        BookingVoucher v = findOrThrow(voucherId, orgId);
        if (v.getUsageCount() > 0) {
            throw new VoucherException(
                "Voucher " + voucherId + " a deja ete utilise " + v.getUsageCount()
                + " fois. Mettez-le en PAUSED plutot que de le supprimer.");
        }
        voucherRepo.delete(v);
        logger.info("Voucher deleted : id={}, code={}", voucherId, v.getCode());
    }

    /** Pause/Resume rapide d'un voucher (raccourci sans full update). */
    public BookingVoucher setStatus(Long voucherId, Long orgId, VoucherStatus newStatus) {
        BookingVoucher v = findOrThrow(voucherId, orgId);
        VoucherStatus oldStatus = v.getStatus();
        checkStatusTransition(oldStatus, newStatus);
        v.setStatus(newStatus);
        logger.info("Voucher status change : id={}, {} -> {}", voucherId, oldStatus, newStatus);
        return voucherRepo.save(v);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // READ
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public BookingVoucher findOrThrow(Long voucherId, Long orgId) {
        BookingVoucher v = voucherRepo.findById(voucherId)
            .orElseThrow(() -> new NotFoundException("Voucher " + voucherId + " introuvable"));
        if (!v.getOrganizationId().equals(orgId)) {
            // Defense in depth : Hibernate @Filter devrait deja avoir filtre,
            // mais on verifie explicitement au cas ou le filtre n'est pas active
            // dans ce contexte (ex: scheduler en mode SUPER_ADMIN).
            throw new UnauthorizedException("Voucher " + voucherId + " hors de votre organisation");
        }
        return v;
    }

    @Transactional(readOnly = true)
    public List<BookingVoucher> listByOrg(Long orgId, VoucherStatus statusFilter) {
        if (statusFilter != null) {
            return voucherRepo.findByOrganizationIdAndStatusOrderByCreatedAtDesc(orgId, statusFilter);
        }
        return voucherRepo.findByOrganizationIdOrderByCreatedAtDesc(orgId);
    }

    @Transactional(readOnly = true)
    public Set<Long> getScopedPropertyIds(Long voucherId) {
        return scopeRepo.findPropertyIdsByVoucherId(voucherId);
    }

    /**
     * Detecte le {@link VoucherCreatorOrgType} pour un voucher existant,
     * sur la base de son scope deja persiste. Evite la double-lecture
     * du scope dans le pattern {@code controller.update → service.update}
     * (fix M-NEW-2 du code review).
     *
     * <p>Semantique identique au helper {@code detectCreatorOrgType} du
     * controller : si toutes les properties du scope appartiennent au user,
     * c'est HOST ; sinon MANAGEMENT_ORG. Scope vide = HOST par defaut (le
     * service refusera ensuite si MANAGEMENT_ORG sans contrat).</p>
     */
    @Transactional(readOnly = true)
    public VoucherCreatorOrgType detectCreatorOrgTypeForExistingScope(Long voucherId, Long userId) {
        Set<Long> scope = scopeRepo.findPropertyIdsByVoucherId(voucherId);
        if (scope.isEmpty()) return VoucherCreatorOrgType.HOST;
        List<Property> properties = propertyRepo.findAllById(scope);
        for (Property p : properties) {
            var owner = p.getOwner();
            if (owner == null || owner.getId() == null || !owner.getId().equals(userId)) {
                return VoucherCreatorOrgType.MANAGEMENT_ORG;
            }
        }
        return VoucherCreatorOrgType.HOST;
    }

    /**
     * Batch lookup : pour une liste de vouchers, retourne map voucher_id →
     * Set<property_id>. Fix H2 du code review (N+1) : remplace N appels a
     * getScopedPropertyIds par un seul SQL.
     *
     * <p>Les vouchers sans aucune row de scope (scope = "toutes les properties")
     * ne sont PAS dans la map → le caller doit fallback sur empty set.</p>
     */
    @Transactional(readOnly = true)
    public java.util.Map<Long, Set<Long>> getScopedPropertyIdsBatch(
        java.util.Collection<Long> voucherIds
    ) {
        if (voucherIds == null || voucherIds.isEmpty()) return java.util.Map.of();
        return scopeRepo.findByVoucherIdIn(voucherIds).stream()
            .collect(java.util.stream.Collectors.groupingBy(
                com.clenzy.model.VoucherPropertyScope::getVoucherId,
                java.util.stream.Collectors.mapping(
                    com.clenzy.model.VoucherPropertyScope::getPropertyId,
                    java.util.stream.Collectors.toSet()
                )
            ));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Permission helper (utile aussi pour le controller en checkAccess)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Verifie si une org peut creer un voucher sur une property donnee
     * en fonction de son type de createur.
     *
     * <ul>
     *   <li>HOST : OK si {@code property.organization_id == orgId} (l'org
     *       du requester possede la property).</li>
     *   <li>MANAGEMENT_ORG : OK si meme org-property ET
     *       {@code org.has_voucher_contract = true} ET
     *       {@code property.org_can_create_vouchers = true}.</li>
     * </ul>
     */
    @Transactional(readOnly = true)
    public boolean canCreateVoucherForProperty(
        Long orgId,
        Property property,
        VoucherCreatorOrgType creatorType
    ) {
        if (property == null || !orgId.equals(property.getOrganizationId())) return false;
        if (creatorType == VoucherCreatorOrgType.HOST) {
            return true;
        }
        // MANAGEMENT_ORG : besoin des deux flags
        Organization org = orgRepo.findById(orgId).orElse(null);
        if (org == null || !org.isHasVoucherContract()) return false;
        return property.isOrgCanCreateVouchers();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────────────────

    private void validatePayload(VoucherCreatePayload p) {
        if (p == null) throw new VoucherException("Payload manquant");
        if (p.name() == null || p.name().isBlank()) throw new VoucherException("name requis");
        if (p.type() == null) throw new VoucherException("type requis");
        if (p.discountType() == null) throw new VoucherException("discountType requis");
        if (p.discountValue() == null || p.discountValue().signum() <= 0) {
            throw new VoucherException("discountValue > 0 requis");
        }
        if (p.discountType() == VoucherDiscountType.PERCENTAGE
            && p.discountValue().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new VoucherException("PERCENTAGE doit etre entre 0 et 100");
        }
        if (p.type() == VoucherType.MANUAL_CODE && (p.code() == null || p.code().isBlank())) {
            throw new VoucherException("code requis pour MANUAL_CODE");
        }
        if (p.validFrom() != null && p.validUntil() != null
            && p.validFrom().isAfter(p.validUntil())) {
            throw new VoucherException("validFrom doit etre avant validUntil");
        }
    }

    /**
     * Resout la liste des Property cibles et verifie qu'elles appartiennent
     * a l'org. Tolere une liste null ou vide (= applicable a toutes les
     * properties de l'org).
     */
    private List<Property> resolveAndCheckProperties(Long orgId, List<Long> propertyIds) {
        if (propertyIds == null || propertyIds.isEmpty()) {
            return List.of();
        }
        List<Property> resolved = propertyRepo.findAllById(propertyIds);
        if (resolved.size() != propertyIds.size()) {
            throw new VoucherException(
                "Property ids introuvables : demande " + propertyIds.size()
                + ", trouve " + resolved.size());
        }
        for (Property p : resolved) {
            if (!orgId.equals(p.getOrganizationId())) {
                throw new UnauthorizedException(
                    "Property " + p.getId() + " hors de l'organisation " + orgId);
            }
        }
        return resolved;
    }

    /**
     * Verifie les permissions de creation/edition sur le scope demande.
     * Pour MANAGEMENT_ORG, chaque property doit avoir
     * {@code org_can_create_vouchers = true}.
     */
    private void checkCreatePermissions(
        Long orgId,
        Long userId,
        VoucherCreatorOrgType creatorType,
        List<Property> targets
    ) {
        if (creatorType == VoucherCreatorOrgType.HOST) {
            // HOST : pas de restriction supplementaire au-dela de la propriete-org
            return;
        }
        // MANAGEMENT_ORG : flag global obligatoire
        Organization org = orgRepo.findById(orgId)
            .orElseThrow(() -> new NotFoundException("Organization " + orgId + " introuvable"));
        if (!org.isHasVoucherContract()) {
            throw new UnauthorizedException(
                "Organization " + orgId + " n'a pas de contrat voucher actif");
        }
        // Chaque property doit avoir le consentement explicite. Si targets vide
        // (= toutes les properties de l'org), il faudrait verifier sur toutes
        // les properties de l'org — pour V1 on impose un scope explicite quand
        // creator est MANAGEMENT_ORG (impossible d'avoir un voucher 'all props'
        // car certaines properties pourraient ne pas avoir consenti).
        if (targets.isEmpty()) {
            throw new UnauthorizedException(
                "MANAGEMENT_ORG doit cibler explicitement les properties consenties (scope non vide)");
        }
        for (Property p : targets) {
            if (!p.isOrgCanCreateVouchers()) {
                throw new UnauthorizedException(
                    "Le host de la property " + p.getId()
                    + " n'a pas autorise l'organisation a creer des vouchers");
            }
        }
        logger.info("MANAGEMENT_ORG voucher create OK : orgId={}, user={}, properties={}",
            orgId, userId, targets.stream().map(Property::getId).toList());
    }

    /** Empeche les doublons (orgId, UPPER(code)) hors voucher courant. */
    private void checkCodeUniqueness(Long orgId, String code, Long excludeVoucherId) {
        if (code == null || code.isBlank()) return;
        var existing = voucherRepo.findByOrgAndCodeIgnoreCase(orgId, code.trim());
        if (existing.isPresent() && !existing.get().getId().equals(excludeVoucherId)) {
            throw new VoucherException("Code " + code + " deja utilise dans votre organisation");
        }
    }

    /**
     * Verifie qu'une transition de statut est autorisee. EXPIRED ne peut pas
     * etre cible manuellement (transition irreversible faite par le scheduler).
     */
    private void checkStatusTransition(VoucherStatus from, VoucherStatus to) {
        if (from == VoucherStatus.EXPIRED) {
            throw new VoucherException("Voucher EXPIRED non modifiable");
        }
        if (to == VoucherStatus.EXPIRED) {
            throw new VoucherException("EXPIRED est applique automatiquement par le scheduler, pas manuellement");
        }
        // Transitions autres : DRAFT <-> ACTIVE <-> PAUSED toutes autorisees
    }

    private void replaceScope(Long voucherId, Long orgId, List<Long> propertyIds) {
        scopeRepo.deleteByVoucherId(voucherId);
        if (propertyIds == null || propertyIds.isEmpty()) return;
        // organization_id denormalise pour le @Filter Hibernate (fix C-NEW-3).
        Set<Long> dedup = new HashSet<>(propertyIds);
        for (Long pid : dedup) {
            scopeRepo.save(new VoucherPropertyScope(voucherId, pid, orgId));
        }
    }

    private String normalizeCode(String code) {
        return code == null ? null : code.trim().toUpperCase();
    }
}
