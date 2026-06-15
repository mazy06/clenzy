package com.clenzy.booking.repository;

import com.clenzy.booking.model.GuestWishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GuestWishlistItemRepository extends JpaRepository<GuestWishlistItem, Long> {

    List<GuestWishlistItem> findByKeycloakIdAndOrganizationIdOrderByCreatedAtDesc(String keycloakId, Long organizationId);

    Optional<GuestWishlistItem> findByKeycloakIdAndOrganizationIdAndPropertyId(String keycloakId, Long organizationId, Long propertyId);

    boolean existsByKeycloakIdAndOrganizationIdAndPropertyId(String keycloakId, Long organizationId, Long propertyId);
}
