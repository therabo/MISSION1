# Frontend regression inputs

All files here are TEST ONLY. They are frozen observations or reviewed asset metadata,
never runtime seeds, live source authority or a data-unavailable fallback.

- `crew/crew-response.json` and `crew/person-response.json`: recorded persisted REST
  responses from 2026-10-03, consumed through the normal decoders by frontend tests.
- `orbital/real-samples.json` and `orbital/real-comparison.json`: recorded backend
  orbital responses used to verify physical/display isolation, camera reset,
  transitions and trajectory orientation. Embedded epochs, frames, units, source
  classifications and lineage describe those observations, not the current ISS.
- `model/iss-model-inventory.json` and `model/iss-semantic-review.json`: reviewed
  NASA VTAD model hierarchy and semantic mapping metadata used to compare the
  shipped GLB with its manifest. These are asset reference data, not ISS telemetry.

Source acknowledgments remain in [third-party notices](../../../../THIRD_PARTY_NOTICES.md),
the [model manifest](../../cesium/issModelManifest.json), and embedded
record metadata. JSON bytes are preserved from their original recordings/reviews.
