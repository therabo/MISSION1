package org.mission1.api;

import java.net.URI;

import org.mission1.orbital.application.CurrentOrbitalStateCalculationException;
import org.mission1.orbital.application.NoCurrentOrbitalStateException;
import org.mission1.orbital.domain.OrbitalQualityReason;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Safe, stable HTTP failures for the current-state read path. */
@RestControllerAdvice(assignableTypes = CurrentOrbitalStateController.class)
public final class CurrentOrbitalStateErrors {
    @ExceptionHandler(NoCurrentOrbitalStateException.class)
    ProblemDetail noData(NoCurrentOrbitalStateException failure) {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "no-orbital-elements", "Orbital state unavailable",
                "No usable orbital elements had been observed by the evaluation time.");
    }

    @ExceptionHandler(CurrentOrbitalStateCalculationException.class)
    ProblemDetail calculation(CurrentOrbitalStateCalculationException failure) {
        if (failure.reason() == OrbitalQualityReason.INVALID_ORBITAL_ELEMENTS) {
            return problem(HttpStatus.INTERNAL_SERVER_ERROR, "invalid-orbital-elements",
                    "Stored orbital elements invalid", "The selected stored orbital elements could not be validated.");
        }
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "orbital-calculation-failed",
                "Orbital calculation failed", "A current orbital state could not be computed.");
    }

    @ExceptionHandler({DataAccessException.class, IllegalArgumentException.class})
    ProblemDetail persistedData(Exception failure) {
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "orbital-data-integrity-error",
                "Orbital data unavailable", "Stored orbital data could not be read or validated.");
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail internal(Exception failure) {
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "orbital-internal-error",
                "Orbital state unavailable", "The current orbital state request could not be completed.");
    }

    private static ProblemDetail problem(HttpStatus status, String code, String title, String detail) {
        ProblemDetail result = ProblemDetail.forStatusAndDetail(status, detail);
        result.setTitle(title);
        result.setType(URI.create("urn:mission1:problem:" + code));
        return result;
    }
}
