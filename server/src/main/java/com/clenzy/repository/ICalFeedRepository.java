package com.clenzy.repository;

import com.clenzy.model.ICalFeed;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ICalFeedRepository extends JpaRepository<ICalFeed, Long> {

    List<ICalFeed> findByPropertyId(Long propertyId);

    @Query("SELECT f FROM ICalFeed f JOIN f.property p WHERE p.owner.id = :ownerId AND f.organizationId = :orgId ORDER BY f.createdAt DESC")
    List<ICalFeed> findByPropertyOwnerId(@Param("ownerId") Long ownerId, @Param("orgId") Long orgId);

    /**
     * Feeds actifs avec property ET owner fetches : {@code ICalImportService.syncFeeds}
     * (deliberement hors transaction, T-BP-06) lit {@code property.getOwner().getKeycloakId()}
     * sur des entites detachees — Property.owner etant LAZY, le owner doit etre charge ici.
     * Appele par le scheduler AVANT tout contexte tenant : le filtre org sur User ne
     * s'applique pas, le LEFT JOIN FETCH est sur.
     */
    @Query("SELECT f FROM ICalFeed f JOIN FETCH f.property p LEFT JOIN FETCH p.owner WHERE f.syncEnabled = true")
    List<ICalFeed> findBySyncEnabledTrue();

    @Query("SELECT f FROM ICalFeed f WHERE f.property.id = :propertyId AND f.url = :url AND f.organizationId = :orgId")
    ICalFeed findByPropertyIdAndUrl(@Param("propertyId") Long propertyId, @Param("url") String url, @Param("orgId") Long orgId);

    @Query("SELECT f FROM ICalFeed f WHERE f.url = :url AND f.property.id <> :propertyId AND f.organizationId = :orgId")
    List<ICalFeed> findByUrlAndDifferentProperty(@Param("url") String url, @Param("propertyId") Long propertyId, @Param("orgId") Long orgId);
}
