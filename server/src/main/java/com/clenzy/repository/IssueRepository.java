package com.clenzy.repository;

import com.clenzy.model.Issue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface IssueRepository extends JpaRepository<Issue, Long> {

    /** Liste org-scopée, filtres optionnels statut / logement. */
    @Query("SELECT i FROM Issue i WHERE i.organizationId = :orgId " +
           "AND (:status IS NULL OR i.status = :status) " +
           "AND (:propertyId IS NULL OR i.propertyId = :propertyId) " +
           "AND (:reportedBy IS NULL OR i.reportedBy = :reportedBy) " +
           "ORDER BY i.createdAt DESC")
    List<Issue> findByOrgWithFilters(@Param("orgId") Long orgId,
                                     @Param("status") Issue.IssueStatus status,
                                     @Param("propertyId") Long propertyId,
                                     @Param("reportedBy") Long reportedBy);

    /**
     * Transition de statut conditionnelle (UPDATE conditionnel — règle audit n°8 :
     * pas de check-then-act). Retourne 0 si le statut courant n'autorise pas la
     * transition (ex. double conversion concurrente).
     */
    @Modifying
    @Query("UPDATE Issue i SET i.status = :to WHERE i.id = :id AND i.status IN :from")
    int transitionStatus(@Param("id") Long id,
                         @Param("to") Issue.IssueStatus to,
                         @Param("from") Collection<Issue.IssueStatus> from);
}
