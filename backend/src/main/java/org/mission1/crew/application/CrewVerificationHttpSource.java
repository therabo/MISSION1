package org.mission1.crew.application;

import org.mission1.crew.domain.CrewSourceResult;

import java.net.URI;
import java.time.Instant;

public interface CrewVerificationHttpSource {
    record Fetch(
            byte[] body,
            CrewSourceResult.Failure failure,
            Integer status,
            String contentType,
            String etag,
            String lastModified,
            Instant retrievedAt) {
        public Fetch {
            body = body == null ? null : body.clone();
        }

        @Override
        public byte[] body() {
            return body == null ? null : body.clone();
        }
    }

    Fetch fetch(URI url, String etag, String lastModified);
}
