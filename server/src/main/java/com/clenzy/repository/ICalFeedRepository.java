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

    List<ICalFeed> findBySyncEnabledTrue();

    @Query("SELECT f FROM ICalFeed f WHERE f.property.id = :propertyId AND f.url = :url AND f.organizationId = :orgId")
    ICalFeed findByPropertyIdAndUrl(@Param("propertyId") Long propertyId, @Param("url") String url, @Param("orgId") Long orgId);
}
