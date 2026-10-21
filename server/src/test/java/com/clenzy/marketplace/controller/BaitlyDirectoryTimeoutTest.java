package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.BaitlyProfessionalDirectory;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BaitlyDirectoryTimeoutTest {
    @Test void timedOutDirectoryRequestReturnsSafeRetryableResponse()throws Exception {
        var directory=mock(BaitlyProfessionalDirectory.class);
        when(directory.list("",0,"","","SA")).thenThrow(new QueryTimeoutException("SELECT confidential_column FROM internal_table"));
        var mvc=MockMvcBuilders.standaloneSetup(new BaitlyProfessionalDirectoryController(directory)).build();
        mvc.perform(get("/api/professional-directory").param("country","SA"))
            .andExpect(status().isGatewayTimeout()).andExpect(header().string("Retry-After","2"))
            .andExpect(jsonPath("$.code").value("DIRECTORY_QUERY_TIMEOUT"))
            .andExpect(jsonPath("$.status").value(504))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("internal_table"))));
    }
}
