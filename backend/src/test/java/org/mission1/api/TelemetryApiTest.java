package org.mission1.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mission1.telemetry.TelemetryTestSupport.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.mission1.telemetry.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;

class TelemetryApiTest {
    TelemetryRepository repository;MockMvc mvc;
    @BeforeEach void setup() {
        repository=mock(TelemetryRepository.class);when(repository.selected(anyString(),any())).thenReturn(Map.of());
        mvc=MockMvcBuilders.standaloneSetup(new TelemetryController(new TelemetryQueryService(CATALOG,repository,Clock.fixed(NOW,ZoneOffset.UTC))))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(MAPPER)).build();
    }
    @Test void componentDefinitionAbsenceAndUnknownContracts() throws Exception {
        mvc.perform(get("/api/iss/components/QUEST/telemetry")).andExpect(status().isOk()).andExpect(jsonPath("$.parameters.length()").value(57)).andExpect(jsonPath("$.parameters[0].record").doesNotExist());
        mvc.perform(get("/api/iss/components/CUPOLA/telemetry")).andExpect(status().isOk()).andExpect(jsonPath("$.mappingStatus").value("NO_VERIFIED_MAPPING")).andExpect(jsonPath("$.parameters.length()").value(0));
        mvc.perform(get("/api/iss/components/NONE/telemetry")).andExpect(status().isNotFound());
        verify(repository,never()).store(any(),any());verify(repository,never()).initialize(any());verify(repository,never()).claimBootstrap(anyString(),any());
    }
    @Test void historicalUsesExactAcceptedTimeAndSourceSpecificRecord() throws Exception {
        Instant at=Instant.parse("2026-09-15T00:00:00Z"), t=Instant.parse("2026-09-14T14:10:29Z");
        var r=NORMALIZER.normalize(raw("NODE3000005","52",t,"SENSEDATA")).orElseThrow();when(repository.selected("TRANQUILITY",at)).thenReturn(Map.of(r.parameterId(),r));
        var response=mvc.perform(get("/api/iss/components/TRANQUILITY/telemetry").param("at",at.toString())).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.mode").value("HISTORICAL")).andReturn().getResponse().getContentAsString();
        assertTrue(response.contains(t.toString()));assertTrue(response.contains("SenseData"));assertTrue(response.contains(NOW.toString()));
        assertFalse(response.contains("STALE"));assertFalse(response.contains("NASA sample time"));verify(repository).selected("TRANQUILITY",at);
    }
    @Test void rawEnumsAndMalformedTimesHistoryBounds() throws Exception {
        for (String time:List.of("yesterday","2026-09-14T14:00:00+00:00","1997-01-01T00:00:00Z","2099-01-01T00:00:00Z"))
            mvc.perform(get("/api/iss/components/QUEST/telemetry").param("at",time)).andExpect(status().isBadRequest());
        String id=CATALOG.raw("NODE3000005").orElseThrow().parameterId();
        mvc.perform(get("/api/iss/telemetry/parameters/"+id+"/history").param("from","2026-09-01T00:00:00Z").param("to","2026-10-14T00:00:00Z")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/iss/telemetry/parameters/none/history").param("from","2026-09-01T00:00:00Z").param("to","2026-09-02T00:00:00Z")).andExpect(status().isNotFound());
    }
}
