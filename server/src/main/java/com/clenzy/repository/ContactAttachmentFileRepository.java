package com.clenzy.repository;

import com.clenzy.model.ContactAttachmentFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ContactAttachmentFileRepository extends JpaRepository<ContactAttachmentFile, Long> {

    Optional<ContactAttachmentFile> findByMessageIdAndAttachmentId(Long messageId, String attachmentId);
}
