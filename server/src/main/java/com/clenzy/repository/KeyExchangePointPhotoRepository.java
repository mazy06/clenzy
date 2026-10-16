package com.clenzy.repository;

import com.clenzy.model.KeyExchangePointPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface KeyExchangePointPhotoRepository extends JpaRepository<KeyExchangePointPhoto, Long> {

    List<KeyExchangePointPhoto> findByPointIdOrderByIdAsc(Long pointId);

    List<KeyExchangePointPhoto> findByPointIdInOrderByIdAsc(Collection<Long> pointIds);

    long countByPointId(Long pointId);
}
