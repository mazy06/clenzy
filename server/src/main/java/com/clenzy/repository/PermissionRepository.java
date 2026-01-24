package com.clenzy.repository;

import com.clenzy.model.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import jakarta.persistence.QueryHint;
import java.util.List;
import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    
    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT p FROM Permission p WHERE p.name = :name")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Optional<Permission> findByName(@Param("name") String name);
    
    @Query("SELECT p FROM Permission p WHERE p.module = :module")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Permission> findByModule(@Param("module") String module);
    
    @Query("SELECT p FROM Permission p WHERE p.name IN :names")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Permission> findByNameIn(@Param("names") List<String> names);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT p FROM Permission p WHERE p.module = :module")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Permission> findByModuleWithPagination(@Param("module") String module, Pageable pageable);
    
    @Query("SELECT p FROM Permission p")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Permission> findAllWithPagination(Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(p) FROM Permission p WHERE p.module = :module")
    long countByModule(@Param("module") String module);
    
    @Query("SELECT COUNT(p) FROM Permission p")
    long countAll();
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END FROM Permission p WHERE p.name = :name")
    boolean existsByName(@Param("name") String name);
    
    @Query("SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END FROM Permission p WHERE p.module = :module")
    boolean existsByModule(@Param("module") String module);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT p.id FROM Permission p WHERE p.module = :module")
    List<Long> findIdsByModule(@Param("module") String module);
    
    @Query("SELECT p.id FROM Permission p WHERE p.name IN :names")
    List<Long> findIdsByNameIn(@Param("names") List<String> names);
}
