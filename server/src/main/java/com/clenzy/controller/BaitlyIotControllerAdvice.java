package com.clenzy.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;

/** Never expose upstream response bodies, URLs or credentials through the PMS. */
@RestControllerAdvice(assignableTypes = BaitlyIotController.class)
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
public class BaitlyIotControllerAdvice {
    public record Error(String code, String message) {}

    @ExceptionHandler(RestClientException.class)
    ResponseEntity<Error> upstream(RestClientException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new Error("baitly_iot_unavailable", "Baitly IoT ne repond pas. Reessayez."));
    }
}
