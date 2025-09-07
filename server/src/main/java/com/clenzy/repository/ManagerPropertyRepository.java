package com.clenzy.repository;

import com.clenzy.model.ManagerProperty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ManagerPropertyRepository extends JpaRepository<ManagerProperty, Long> {
    
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.managerId = :managerId")
    List<ManagerProperty> findByManagerId(@Param("managerId") Long managerId);
    
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.propertyId = :propertyId")
    List<ManagerProperty> findByPropertyId(@Param("propertyId") Long propertyId);
    
    @Query("SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.propertyId = :propertyId")
    boolean existsByManagerIdAndPropertyId(@Param("managerId") Long managerId, @Param("propertyId") Long propertyId);
    
    @Query("SELECT mp FROM ManagerProperty mp WHERE mp.managerId = :managerId AND mp.propertyId = :propertyId")
    ManagerProperty findByManagerIdAndPropertyId(@Param("managerId") Long managerId, @Param("propertyId") Long propertyId);
    
    @Query("SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM ManagerProperty mp WHERE mp.propertyId = :propertyId")
    boolean existsByPropertyId(@Param("propertyId") Long propertyId);
}
