package com.clenzy.repository;

import com.clenzy.model.DocumentTemplateTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentTemplateTagRepository extends JpaRepository<DocumentTemplateTag, Long> {

    List<DocumentTemplateTag> findByTemplateId(Long templateId);

    void deleteByTemplateId(Long templateId);
}
