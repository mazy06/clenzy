package com.clenzy.repository;

import com.clenzy.model.IssuePhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface IssuePhotoRepository extends JpaRepository<IssuePhoto, Long> {

    List<IssuePhoto> findByIssueIdOrderByCreatedAtAsc(Long issueId);

    long countByIssueId(Long issueId);

    /**
     * Couples (issueId, photoId) : construire une URL ne demande pas de charger
     * le BYTEA de chaque photo.
     */
    @Query("SELECT p.issueId, p.id FROM IssuePhoto p WHERE p.issueId IN :issueIds ORDER BY p.createdAt ASC")
    List<Object[]> findIdPairsByIssueIds(@Param("issueIds") List<Long> issueIds);

    @Query("SELECT p.id FROM IssuePhoto p WHERE p.issueId = :issueId ORDER BY p.createdAt ASC")
    List<Long> findIdsByIssueId(@Param("issueId") Long issueId);
}
