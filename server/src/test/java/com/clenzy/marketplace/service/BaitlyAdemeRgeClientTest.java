package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyAdemeRgeClientTest {
    final ObjectMapper mapper=new ObjectMapper();
    JsonNode json(String text)throws Exception{return mapper.readTree(text);}
    JsonNode metadata(int count)throws Exception{return json("""
        {"id":"rge-edition","status":"finalized","public":true,"count":%d,"dataUpdatedAt":"2026-10-20T03:00:00Z",
         "license":{"title":"Licence Ouverte / Open Licence"},"schema":[{"key":"siret"},{"key":"telephone"},{"key":"email"},{"key":"site_internet"}]}
        """.formatted(count));}
    BaitlyAdemeRgeClient source(JsonNode meta,JsonNode... pages){
        return new BaitlyAdemeRgeClient(mapper){int index;
            @Override public JsonNode metadata(){return meta;}
            @Override public JsonNode page(String after){return pages[index++];}
            @Override protected void pause(){}
        };
    }
    @Test void exactSiretsDeduplicateQualificationsAndConflictingFieldsDoNotOverwriteOthers()throws Exception {
        var result=source(metadata(3),json("""
            {"total":3,"results":[
              {"siret":"12345678900011","telephone":"01 02 03 04 05","email":"CONTACT@example.com","site_internet":"https://example.com"},
              {"siret":"12345678900011","telephone":"0102030405","email":"contact@example.com","site_internet":"https://example.com"},
              {"siret":"12345678900011","telephone":"0200000000","email":"not-an-email","site_internet":"javascript:alert(1)"}]}
            """)).download();
        assertThat(result.contacts()).containsExactly(new BaitlyAdemeRgeClient.Contact("12345678900011",null,"contact@example.com","https://example.com"));
    }
    @Test void followsOnlyValidatedCursorAndChecksTheWholeEdition()throws Exception {
        var first=json("""
            {"total":2,"results":[{"siret":"12345678900011"}],"next":"https://data.ademe.fr/data-fair/api/v1/datasets/rge-edition/lines?size=10000&after=cursor%2B1"}
            """);
        assertThat(BaitlyAdemeRgeClient.cursor(first,"rge-edition")).isEqualTo("cursor+1");
        assertThat(source(metadata(2),first,json("{\"results\":[{\"siret\":\"22345678900022\"}]}")).download().contacts()).hasSize(2);
        assertThatThrownBy(()->source(metadata(3),json("{\"total\":3,\"results\":[{\"siret\":\"12345678900011\"}]}")).download()).isInstanceOf(IOException.class);
    }
    @Test void rejectsRedirectedPaginationInvalidSiretAndNonOpenData()throws Exception {
        for(String url:List.of("https://evil.example/lines?after=1","http://data.ademe.fr/lines?after=1","https://data.ademe.fr/private?after=1")){
            var page=mapper.createObjectNode().put("next",url);
            assertThatThrownBy(()->BaitlyAdemeRgeClient.cursor(page,"rge-edition")).isInstanceOf(IOException.class);
        }
        assertThatThrownBy(()->source(metadata(1),json("{\"total\":1,\"results\":[{\"siret\":\"123456789\"}]}")).download()).isInstanceOf(IOException.class);
        var meta=(com.fasterxml.jackson.databind.node.ObjectNode)metadata(1);meta.put("public",false);
        assertThatThrownBy(()->source(meta).download()).isInstanceOf(IOException.class);
    }
    @Test void editionChangedDuringPaginationNeverReturnsPartialContacts()throws Exception {
        var start=metadata(1);var end=((com.fasterxml.jackson.databind.node.ObjectNode)metadata(1)).put("dataUpdatedAt","2026-10-21T03:00:00Z");
        var page=json("{\"total\":1,\"results\":[{\"siret\":\"12345678900011\"}]}");
        var client=new BaitlyAdemeRgeClient(mapper){int calls;
            @Override public JsonNode metadata(){return calls++==0?start:end;}
            @Override public JsonNode page(String after){return page;}
        };
        assertThatThrownBy(client::download).isInstanceOf(IOException.class);
    }
}
