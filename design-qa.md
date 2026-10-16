# Design QA — Directum Design hero spectrum

- Source visual truth: `/var/folders/tb/7m7lhk4j6_s4cnrs0h3wkk800000gn/T/codex-clipboard-ee858b42-27f3-42a7-859b-de606ca275d2.png`
- Rendered implementation: in-app Browser capture of `http://127.0.0.1:4173/`
- Viewport: 980 × 922 CSS px, desktop responsive state
- Source pixels: 434 × 450 px, density unknown
- Implementation pixels: 980 × 922 px at browser capture density 1
- Normalization: the supplied image is a visual-mood reference rather than a layout target, so comparison used palette, luminance rhythm, vertical light bars, glow and energy-line behavior rather than geometric 1:1 alignment.
- State: idle homepage, WebGL animation running, default pointer position

## Full-view comparison evidence

The reference's dark field, electric blue left side, hot orange right side and luminous vertical rhythm are present in the implementation. The field now spans almost the full viewport width at reduced luminance, keeping the Directum navigation, typography and glass sphere visually dominant. The former grid geometry remains removed.

## Focused-region comparison evidence

The optical-center region was checked separately because it carries the reference's main visual signature. The implemented line has a sharp white core, blue/orange outer glow, small irregular oscillations and intermittent sparks, but is now gated by a smooth five-second envelope. It fades almost completely between discharges instead of remaining continuously visible. The bars remain in gentle continuous motion.

## Required fidelity surfaces

- Fonts and typography: existing Directum hierarchy, weights, wrapping and large centered wordmark are preserved; the new light field remains behind the text through a separate overlay texture.
- Spacing and layout rhythm: header, intro, section links, footer and sphere proportions are unchanged; no new overflow or collision was introduced.
- Colors and visual tokens: the source's blue/orange split is reproduced with a dark navy base; orange remains aligned with the Directum accent while blue supplies contrast.
- Image quality and asset fidelity: the background is rendered procedurally in WebGL at the active viewport resolution, avoiding raster scaling or compression artifacts; the glass refraction incorporates the animated light field.
- Copy and content: all existing labels, navigation destinations and Russian copy are unchanged.

## Findings

No actionable P0/P1/P2 differences remain for the requested style transfer.

## Comparison history

- Earlier P2: the background retained a visible geometric grid, conflicting with the requested clean dark field. Fixed by removing the grid from the WebGL backdrop and fallback state.
- Earlier P2: the blue/orange bars were static. Fixed by moving them into the fragment shader with independent pulse phases and vertical drift.
- Earlier P2: the center axis was a flat glow. Fixed with a multi-frequency animated line, white electrical core, colored bloom and spark modulation.
- Post-fix evidence: two consecutive 980 × 922 in-app Browser captures show changed bar positions/brightness and a moving irregular electrical line; the console reported no errors.
- Publication check found the browser still serving the previous cached shader. Fixed by versioning the shader URL so the electric-motion build is fetched immediately on production.
- Latest refinement: spread the bar field from edge to edge, reduced bar and ambient-glow luminance, and changed the electrical core to one smooth pulse every five seconds.
- Current refinement: reduced grazing-angle reflection and internal absorption so the sphere edge reads as transparent glass; changed the hero wordmark to uppercase Montserrat in both WebGL and fallback rendering.
- Current motion refinement: added a broad blue-to-orange gradient wave that continuously travels left-to-right across the bar field while preserving the subdued base composition.
- Adaptive performance: full-capability devices retain the original 60 FPS, 1.55 DPR cap and seven-band refraction. Devices with at most 4 GB memory or 4 logical cores use a 30 FPS, 1.0 DPR, four-band profile with reduced ray-march and internal-bounce budgets. Rendering pauses while the page is hidden and reduced-motion mode renders a static frame.
- Palette refinement: replaced muted slate, brown and pastel glow mixtures with a deeper near-black navy field, pure electric blue and saturated Directum orange. Glass reflections remain transparent but use cleaner chromatic highlights.
- Bar reveal refinement: reduced the resting bar luminance to roughly 5.5% and tied both bar cores and bloom to the traveling gradient, creating a strong emergence-from-darkness effect with a soft leading and trailing edge.
- Gradient pacing: slowed the traveling reveal from a roughly 13-second pass to about 22 seconds so the bars feel atmospheric and secondary to the headline and glass sphere.
- Intro and footer copy: renamed the intro to “Дизайн-материалы Directum”, forced “в одном месте” onto its own line, and removed the bottom-left instruction while keeping the cursor hint aligned right.

## Primary interactions tested

- Homepage → icon catalog navigation works and opens `/icons.html`.
- Browser Back returns to the animated homepage.
- WebGL scene renders continuously with no console warnings or errors.
- Reduced-motion behavior remains available through the existing `uMotion` control.

## Follow-up polish

- P3: the pulse peak remains intentionally legible, while its long resting phase keeps the wordmark and sphere dominant.

final result: passed
