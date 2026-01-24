package com.clenzy.repository;

import com.clenzy.model.Role;
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
public interface RoleRepository extends JpaRepository<Role, Long> {
    
    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT r FROM Role r WHERE r.name = :name")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Optional<Role> findByName(@Param("name") String name);
    
    @Query("SELECT r FROM Role r WHERE r.name IN :names")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Role> findByNameIn(@Param("names") List<String> names);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT r FROM Role r")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Role> findAllWithPagination(Pageable pageable);
    
    @Query("SELECT r FROM Role r WHERE r.name IN :names")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Role> findByNameInWithPagination(@Param("names") List<String> names, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(r) FROM Role r")
    long countAll();
    
    @Query("SELECT COUNT(r) FROM Role r WHERE r.name IN :names")
    long countByNameIn(@Param("names") List<String> names);
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(r) > 0 THEN true ELSE false END FROM Role r WHERE r.name = :name")
    boolean existsByName(@Param("name") String name);
    
    @Query("SELECT CASE WHEN COUNT(r) > 0 THEN true ELSE false END FROM Role r WHERE r.name IN :names")
    boolean existsByNameIn(@Param("names") List<String> names);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT r.id FROM Role r WHERE r.name IN :names")
    List<Long> findIdsByNameIn(@Param("names") List<String> names);
    
    @Query("SELECT r.id FROM Role r")
    List<Long> findAllIds();
}
