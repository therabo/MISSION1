# Explicit local S10 validation runners

These are opt-in audit tools, not application startup code. The Java runners require
the canonical retained installation and the external investigation archive at the
paths documented in the dossier. The portable backend tests use frozen fixtures.
Expected labels are evaluation inputs only; none installs a canonical mapping.

From the repository root, with the accepted Java 21 runtime:

```sh
export JAVA_HOME=/Users/daniel/Library/Java/JavaVirtualMachines/corretto-21.0.3/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
mvn -f backend/pom.xml dependency:build-classpath -Dmdep.includeScope=test -Dmdep.outputFile=/Users/daniel/.codex/exports/mission1-s10-shadow/classpath.txt
S10_AUDIT_ROOT=/Users/daniel/.codex/exports/mission1-s10-shadow
S10_AUDIT_CP="$S10_AUDIT_ROOT:backend/target/classes:$(cat "$S10_AUDIT_ROOT/classpath.txt")"
javac -cp "$S10_AUDIT_CP" docs/crew/operational-subject-binding-shadow-validation/scripts/S10Validation.java -d "$S10_AUDIT_ROOT"
java -Djdk.attach.allowAttachSelf=true -cp "$S10_AUDIT_CP" S10Validation repeat
python3 docs/crew/operational-subject-binding-shadow-validation/scripts/compare-http.py
```

`S10Validation repeat` starts a temporary instrumented backend on 8081 with all source,
identity, membership and S10 schedulers disabled. It reuses cache, evaluates only S10,
forces mutable work eligibility for restart validation, compares detached policies,
and traces real HTTP/Current service reads before shutting down. Its initial mode
(without `repeat`) ingests original official captures after verifying their hashes;
run that mode only when intentionally validating initial intake. Intake does not use
the frozen test fixture or expected human labels.

`http-audit.py before` records the existing backend's 8080 HTTP/table baseline.
`ReadBaseline` independently traces baseline Current SQL; it requires the preserved
baseline classes before the S10 build. `compare-http.py` uses these existing baseline
files, excludes only the documented response-clock fields, and checks all preexisting
table fingerprints. Preserve baseline files instead of replacing them with final
responses. `HTTPProbe` makes one real bounded ESA acquisition through the new transport,
retains its result and evaluates the notified S10 work; it is an explicit network action.

Disable ordinary writers for the duration of fingerprint comparisons. ByteBuddy advice
is test-only instrumentation from the existing Mockito dependency. No Python or agent
instrumentation is needed by the application. Raw captures, full logs and post-commit
Git verification stay in the external audit directory.
