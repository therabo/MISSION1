# New binary runtime assets

All six are 4096×4096 RGB uint8 lossless WebP (VP8L), derived once from the authoritative [NASA GSFC SVS Tycho II TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a003500/a003572/TychoSkymapII.t5_16384x08192.tif). Original TIFF SHA-256 `2eb9baf5796c62bb04d8c87625b93356cd5ff4172bc56d6b731df554393de04f`, 402,653,312 bytes, 16384×8192. Historical January 2009 catalogue visualization, attribution retained; [NASA media usage guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/), no endorsement. No generated physical detail or additional third-party texture was introduced.

| Repository path | Bytes | SHA-256 |
| --- | ---: | --- |
| `frontend/public/skybox/tycho-positiveX.webp` | 4300948 | `0c1f7a0e5c908afb9fe99fa1c015d2ff367090fdf2161726a11f703cb6ecae7e` |
| `frontend/public/skybox/tycho-negativeX.webp` | 3938734 | `f3d2d5af961a48da9f0f610182301ed30d17f202d2427bdf913c0fe2ed5f4735` |
| `frontend/public/skybox/tycho-positiveY.webp` | 6501276 | `f0fad9f0ffb8baa39041231b21bc07387b4289c291b074efd5ee19cb618fd0fa` |
| `frontend/public/skybox/tycho-negativeY.webp` | 6679566 | `e6e33a3bddfd1fa724492465c8df8ad3dc8081c411d4a9d0e5a72be1975e26fc` |
| `frontend/public/skybox/tycho-positiveZ.webp` | 5844548 | `1fa29fe30a6021c9a6b7607b4b1f67a9f7b93d5e7243511cce811515e9972d80` |
| `frontend/public/skybox/tycho-negativeZ.webp` | 7186608 | `384d47c872b7507d2c7440a99572f66d4ccd78024f92f316666008084a9a2388` |

Total: **34,451,680 bytes**. These are the only new runtime binary assets; six replaced 2048² PNG faces totalled 17,421,296 bytes. Every new file uses the same source/provenance/dimensions/format above. Decoded RGBA hashes are pinned individually in the manifest and matched in Chromium by `evidence/decoded-sky.json`; lossless packing is not a claim that bilinear cubemap projection itself is pixel-identical to the original plate-carree TIFF. All 12 common cube edges match exactly.

Screenshot PNGs in this dossier are QA evidence, not runtime source assets. Their original pixels reflect a real browser, scene clock and NASA textures; they are inventoried with hashes in `evidence/evidence-manifest.json`. They are not fabricated station/telemetry images. The untouched model and local night JPEG retain their existing provenance and hashes recorded in the main report. Downloaded source GLB/TIFF, rejected cube PNGs, baseline copied build and all production `dist/` files remain outside Git.
