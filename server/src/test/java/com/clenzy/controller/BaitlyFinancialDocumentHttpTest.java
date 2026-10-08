package com.clenzy.controller;

import com.clenzy.service.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.*;
import org.springframework.web.bind.support.WebDataBinderFactory;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Contrat HTTP multipart réel. Les tests de sécurité vérifient séparément les proxys d'autorisation. */
class BaitlyFinancialDocumentHttpTest {
    BaitlyOtaSettlementService ota; BaitlySupplierPurchaseService supplier; MockMvc mvc;
    BaitlySupplierRegistration registration; LoginProtectionService protection;
    @BeforeEach void setup() {
        ota=mock(BaitlyOtaSettlementService.class);supplier=mock(BaitlySupplierPurchaseService.class);
        registration=mock(BaitlySupplierRegistration.class);protection=mock(LoginProtectionService.class);
        when(protection.tryAcquire(anyString(),anyInt(),any())).thenReturn(true);
        mvc=MockMvcBuilders.standaloneSetup(new BaitlyOtaSettlementController(ota),new BaitlySupplierPurchaseController(supplier),
            new BaitlySupplierRegistrationController(registration,protection),
            new OrganizationInvitationController(mock(OrganizationInvitationService.class),mock(OrganizationService.class)))
            .setControllerAdvice(new BaitlyFinancialDocumentAdvice()).setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                public boolean supportsParameter(MethodParameter p){return p.getParameterType()==Jwt.class;}
                public Object resolveArgument(MethodParameter p,ModelAndViewContainer m,NativeWebRequest r,WebDataBinderFactory b){return Jwt.withTokenValue("test").header("alg","none").subject("staff-test").build();}
            }).build();
    }
    MockMultipartFile json(String content){return new MockMultipartFile("request","request.json","application/json",content.getBytes(StandardCharsets.UTF_8));}
    MockMultipartFile pdf(String field){return new MockMultipartFile(field,"file.pdf","application/pdf",("%PDF-1.4 "+field).getBytes(StandardCharsets.UTF_8));}
    String otaRequest(){return """
        {"requestId":"7ccdcf97-27c9-493b-a230-e1b4fabc6667","otaReference":"OTA-1","bankReference":"BANK-1",
         "receivedOn":"2026-01-01","currency":"EUR","beneficiaryUserId":42,
         "lines":[{"reservationId":1,"gross":"100","fees":"10","refunds":"0","net":"90"}]}
        """;}
    @Test void decodesOtaJsonAndBothDocumentsWithAuthenticatedSubject() throws Exception {
        when(ota.record(any(),any(),any(),eq("staff-test"))).thenReturn(7L);
        mvc.perform(multipart("/api/finance/ota-settlements").file(json(otaRequest())).file(pdf("statement")).file(pdf("bankReceipt")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(7));
        verify(ota).record(argThat(r->r.lines().size()==1 && r.beneficiaryUserId()==42L),
            argThat(d->d.mime().equals("application/pdf")),argThat(d->d.sha256().length()==64),eq("staff-test"));
    }
    @Test void invalidOrMissingDocumentNeverReachesFinancialService() throws Exception {
        mvc.perform(multipart("/api/finance/ota-settlements").file(json(otaRequest())).file(pdf("statement")))
            .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/finance/ota-settlements").file(json(otaRequest())).file(pdf("statement"))
            .file(new MockMultipartFile("bankReceipt","fake.pdf","application/pdf","<script>not a PDF</script>".getBytes())))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_FINANCIAL_DOCUMENT"));
        verifyNoInteractions(ota);
    }
    @Test void combinedDocumentsLeaveSpaceForMultipartHeaders() throws Exception {
        mvc.perform(multipart("/api/finance/ota-settlements").file(json(otaRequest()))
            .file(new MockMultipartFile("statement",new byte[5*1024*1024]))
            .file(new MockMultipartFile("bankReceipt",new byte[5*1024*1024])))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("9 Mo")));
        verifyNoInteractions(ota);
    }
    @Test void supplierInvoiceAndReceiptUseDistinctMultipartContracts() throws Exception {
        when(supplier.create(any(),any(),eq("staff-test"))).thenReturn(8L);
        mvc.perform(multipart("/api/finance/supplier-purchases").file(json("""
            {"requestId":"7ccdcf97-27c9-493b-a230-e1b4fabc6667","propertyId":1,"supplierName":"Supplier",
             "supplierEmail":"supplier@test.invalid","invoiceReference":"F-1","description":"Linge","expenseDate":"2026-01-01",
             "amountHt":"50","taxRate":"0.20"}
            """)).file(pdf("invoice"))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(8));
        mvc.perform(multipart("/api/finance/supplier-purchases/8/external-receipt").file(json("""
            {"reference":"PAY-1","paidOn":"2026-01-02","amount":"60","currency":"EUR"}
            """)).file(pdf("receipt"))).andExpect(status().isOk());
        verify(supplier).recordExternal(eq(8L),argThat(r->r.amount().intValueExact()==60),any(),eq("staff-test"));
    }
    @Test void databaseConflictsDoNotExposeSqlOrPrivateDocumentContent() throws Exception {
        when(supplier.invite(8,"staff-test")).thenThrow(new DataIntegrityViolationException("secret-table SQL document bytes"));
        mvc.perform(post("/api/finance/supplier-purchases/8/invitation"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FINANCIAL_DOCUMENT_CONFLICT"))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret-table"))));
    }
    @Test void financialDocumentsDownloadAsAttachmentsWithSniffingDisabled() throws Exception {
        when(supplier.document(8,false,"staff-test")).thenReturn(BaitlyFinancialDocument.checked("%PDF-1.4 test".getBytes()));
        mvc.perform(get("/api/finance/supplier-purchases/8/documents/invoice"))
            .andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options","nosniff"))
            .andExpect(header().string("Content-Disposition","attachment; filename=\"baitly-fournisseur-8-invoice.pdf\""));
    }
    String registrationBody(){return """
        {"token":"00000000-0000-4000-8000-000000000001.00000000-0000-4000-8000-000000000002",
         "email":"supplier@test.invalid","firstName":"Jean","lastName":"Martin"}
        """;}
    @Test void supplierRegistrationSelectsItsExplicitRouteWithoutAnOrganizationOrPassword() throws Exception {
        mvc.perform(post("/api/invitations/register?kind=supplier").contentType("application/json").content(registrationBody()))
            .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("ACTIVATION_SENT"));
        verify(registration).register(anyString(),eq("supplier@test.invalid"),eq("Jean"),eq("Martin"));
    }
    @Test void registrationValidatesIdentityAndRateLimitsBeforeProvisioning() throws Exception {
        mvc.perform(post("/api/invitations/register?kind=supplier").contentType("application/json").content(registrationBody().replace("supplier@test.invalid","invalid")))
            .andExpect(status().isBadRequest());verifyNoInteractions(registration);
        when(protection.tryAcquire(anyString(),anyInt(),any())).thenReturn(false);
        mvc.perform(post("/api/invitations/register?kind=supplier").contentType("application/json").content(registrationBody()))
            .andExpect(status().isTooManyRequests());verifyNoInteractions(registration);
    }
}
