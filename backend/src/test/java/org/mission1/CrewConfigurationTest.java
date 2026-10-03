package org.mission1;

import static org.junit.jupiter.api.Assertions.*;
import java.net.InetSocketAddress;
import java.time.Clock;
import java.util.concurrent.atomic.AtomicInteger;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.mission1.source.crew.ll2.LaunchLibrary2CrewSource;
import org.mission1.source.crew.nasa.NasaCrewDocumentSource;

class CrewConfigurationTest {
    @Test void registeringCrewCapabilitiesMakesZeroStartupRequests() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var requests = new AtomicInteger();
        server.createContext("/", exchange -> { requests.incrementAndGet(); exchange.sendResponseHeaders(500, -1); exchange.close(); });
        server.start();
        try {
            new ApplicationContextRunner().withUserConfiguration(CrewConfiguration.class)
                    .withInitializer(context -> context.getBeanFactory().setConversionService(
                            org.springframework.boot.convert.ApplicationConversionService.getSharedInstance()))
                    .withBean(Clock.class, Clock::systemUTC)
                    .withPropertyValues("mission1.crew.ll2.base-url=http://127.0.0.1:" + server.getAddress().getPort() + "/2.3.0/")
                    .run(context -> {
                        assertNull(context.getStartupFailure());
                        assertNotNull(context.getBean(LaunchLibrary2CrewSource.class));
                        assertNotNull(context.getBean(NasaCrewDocumentSource.class));
                        assertEquals(0, requests.get());
                        assertTrue(context.getBeansOfType(org.springframework.scheduling.TaskScheduler.class).isEmpty());
                    });
        } finally { server.stop(0); }
    }
}
