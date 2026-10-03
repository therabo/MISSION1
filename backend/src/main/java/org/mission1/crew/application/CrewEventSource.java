package org.mission1.crew.application;

import org.mission1.crew.domain.*;

import java.net.URI;
import java.time.Instant;
import java.util.List;

/** Narrow station docking/undocking calendar capability. One bounded page per fetch. */
public interface CrewEventSource {
    record Request(URI url, Instant from, Instant until) {}

    record Catalog(List<CrewOperationalEvent> events, byte[] body) {
        public Catalog {
            events = List.copyOf(events);
            body = body.clone();
        }

        @Override
        public byte[] body() {
            return body.clone();
        }
    }

    Request request(Instant now);

    CrewSourceResult<Catalog> fetch(Request request);
}
