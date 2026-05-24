package com.clenzy.integration.channex.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Attachment d'un message Channex (file_url + metadata).
 *
 * <p>Reference : {@code POST /api/v1/attachments} (upload base64 → recoit url).</p>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChannexAttachmentDto(
    String id,
    @JsonProperty("file_url") String fileUrl,
    @JsonProperty("file_name") String fileName,
    @JsonProperty("content_type") String contentType,
    @JsonProperty("size_bytes") Long sizeBytes
) {}
