package org.mission1.api.crew;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

/** Same ProblemDetail/URN conventions as the orbital read API, scoped to Crew. */
@RestControllerAdvice(assignableTypes = CrewController.class)
public final class CrewErrors {
    @ExceptionHandler(CrewReadException.class)
    ProblemDetail unavailable(CrewReadException failure) {
        return switch (failure.reason()) {
            case BAD_REQUEST ->
                    problem(
                            HttpStatus.BAD_REQUEST,
                            "bad-request",
                            "Invalid astronaut identifier",
                            "astronautId must be a canonical MISSION1 UUID.");
            case PERSON_NOT_FOUND ->
                    problem(
                            HttpStatus.NOT_FOUND,
                            "person-not-found",
                            "Crew person not found",
                            "No persisted MISSION1 person has this UUID.");
            case STATE_UNAVAILABLE ->
                    problem(
                            HttpStatus.SERVICE_UNAVAILABLE,
                            "crew-state-unavailable",
                            "Crew state unavailable",
                            "No usable Crew interpretation is available from persisted"
                                + " observations.");
            case PRIMARY_UNAVAILABLE ->
                    problem(
                            HttpStatus.SERVICE_UNAVAILABLE,
                            "crew-primary-unavailable",
                            "Structured expedition unavailable",
                            "No usable structured expedition outcome has been observed.");
        };
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail internal(Exception failure) {
        return problem(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "crew-internal-error",
                "Crew data unavailable",
                "The Crew read request could not be completed.");
    }

    private static ProblemDetail problem(
            HttpStatus status, String code, String title, String detail) {
        var p = ProblemDetail.forStatusAndDetail(status, detail);
        p.setType(URI.create("urn:mission1:problem:" + code));
        p.setTitle(title);
        return p;
    }
}
