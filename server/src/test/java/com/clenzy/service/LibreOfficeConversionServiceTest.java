package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LibreOfficeConversionServiceTest {

    @Mock private RestTemplate restTemplate;
    private LibreOfficeConversionService service;

    @BeforeEach
    void setUp() {
        service = new LibreOfficeConversionService("http://gotenberg:3000", restTemplate);
    }

    @Test
    void whenConvertSuccess_thenReturnsPdf() {
        byte[] odt = new byte[]{1, 2, 3};
        byte[] pdf = new byte[]{4, 5, 6};
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        ResponseEntity<byte[]> response = new ResponseEntity<>(pdf, headers, HttpStatus.OK);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(response);

        byte[] result = service.convertToPdf(odt, "test.odt");
        assertThat(result).isEqualTo(pdf);
    }

    @Test
    void whenConvertFails_thenThrows() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenThrow(new RuntimeException("Connection refused"));

        assertThatThrownBy(() -> service.convertToPdf(new byte[]{1}, "test.odt"))
                .isInstanceOf(DocumentGenerationException.class);
    }

    @Test
    void whenConvertReturnsNonPdf_thenThrows() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        ResponseEntity<byte[]> response = new ResponseEntity<>(new byte[]{1}, headers, HttpStatus.OK);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(response);

        assertThatThrownBy(() -> service.convertToPdf(new byte[]{1}, "test.odt"))
                .isInstanceOf(DocumentGenerationException.class);
    }

    @Test
    void whenConvertReturnsError_thenThrows() {
        ResponseEntity<byte[]> response = new ResponseEntity<>(null, HttpStatus.INTERNAL_SERVER_ERROR);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(response);

        assertThatThrownBy(() -> service.convertToPdf(new byte[]{1}, "test.odt"))
                .isInstanceOf(DocumentGenerationException.class);
    }

    @Test
    void whenIsAvailable_thenReturnsTrue() {
        when(restTemplate.getForEntity(anyString(), eq(String.class)))
                .thenReturn(new ResponseEntity<>("OK", HttpStatus.OK));

        assertThat(service.isAvailable()).isTrue();
    }

    @Test
    void whenIsNotAvailable_thenReturnsFalse() {
        when(restTemplate.getForEntity(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("Connection refused"));

        assertThat(service.isAvailable()).isFalse();
    }
}
