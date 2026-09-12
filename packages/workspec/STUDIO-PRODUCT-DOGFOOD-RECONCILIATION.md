# WorkSpec 2.2 Studio product-dogfood reconciliation

Date: 10 September 2026

## 1. Findings reproduced from both runs

- **Canonical timing was the material playback defect.** Studio's local start-time calculation treated dependency-scheduled tasks as if they started at the document clock, truncating the steam-sterilisation story at 07:40. `playground-time-controller.js` now delegates 2.2 task timing to `WorkSpecRuntime.resolveTimings()`. The flagship scrubber ends at the resolved 10:30 horizon, and all seven Simulation Library templates resolve without timing diagnostics.
- **Project open could race editor initialisation.** The metrics/editor project-open listener could call `setValue()` before that editor existed. The guarded lifecycle path survives create, open, reopen, duplicate, and import without a console error.
- **Runtime errors needed a real user route.** Constraint violations now make Problems visible, make the overall status invalid, expose the runtime's structured evidence, and provide a click target that changes to the Timeline at the violation time and highlights the affected object.
- **The documentation needed a current authoring centre.** The current entry point teaches Starting State, Changes, Constraints, optional Generator, and Simulation as resolved observable history. Older `interactions` material remains available only with historical-version labelling.

## 2. Conflicting findings

- One run left arbitrary resolved properties largely invisible and treated Physical playback as disconnected; the other added generic property/location tooltips and connected the existing Physical renderer to runtime snapshots.
- One run suppressed `object.optimization.unused_resource` throughout 2.2; the other retained the steam template's five informational notices.
- The settings collision was repaired in one run and not identified in the other.
- Both runs wanted current 2.2 documentation, but their retained scope differed.

## 3. Implementations retained and why

| Question | Reconciliation |
| --- | --- |
| Resolved properties | Retain the generic live-object summary and tooltip. It lists arbitrary resolved properties and current location; it is not a sterilisation-specific inspector or gauge system. Browser verification at 08:55 showed Generator-produced chamber temperature `109.69999999999999`, pressure `259.2`, exposure `16`, and state `cooling`, rather than Starting State values. |
| Physical view | Retain the small integration that lets the existing renderer prefer the player's canonical runtime snapshot and live object map, with the legacy path as fallback. Authored `move()` and `set()` effects appeared during playback. No new map or physical-rendering architecture was introduced. |
| `object.optimization.unused_resource` | Reject blanket 2.2 suppression. The validator still reports this informational diagnostic. Its five steam-template notices are acknowledged false friends until cross-file consumption analysis receives an explicit validator-policy design; a flagship project is not sufficient evidence for a global rule change. |
| Constraint Library persistence | Retain the fix. Reusing `settings.customMetrics.catalog` was a real collision that polluted metrics and exports. New writes use `settings.constraintLibrary`; a narrow legacy read accepts the old location. A newly created project contained `constraintLibrary: "[]"` and did not acquire a custom-metrics catalog. |
| Documentation scope | Keep the targeted 2.2 authoring guide, navigation entry, terminology corrections, and historical notices. Do not rewrite the historical specification or tutorial corpus as part of the freeze. |

## 4. Fixes retained

- canonical runtime timing in Studio's 2.2 time model;
- generic resolved state, quantity, properties, and location visibility;
- existing Physical view connected to canonical resolved snapshots;
- visible runtime Problems, invalid status, structured evidence, time jump, and object highlight;
- project-open editor lifecycle guard;
- separate Constraint Library persistence with compatibility read;
- four-file project persistence through create, save/reopen, duplicate, export, and import;
- the generic steam-sterilisation Simulation Library template;
- focused WorkSpec 2.2 documentation and authoring labels.

## 5. Fixes reverted or deliberately rejected

- Reverted the 2.2-wide suppression of `object.optimization.unused_resource` and added a self-test proving a genuinely unused 2.2 resource remains diagnosable.
- Rejected richer property dashboards, property-specific gauges, a replacement physical renderer, runtime-created-object rendering, new provenance, a constraint query API or DSL, remediation, and timeline redesign.
- Rejected domain-specific Studio handling for steam sterilisation and broad presentation cleanup unrelated to the freeze-critical path.

## 6. Remaining known non-blockers

- The Gantt header retains a padded 06:40–11:40 presentation range while the canonical playback scrubber ends at 10:30.
- Generic tooltips expose raw resolved numeric precision; a richer inspector and formatting policy remain presentation work.
- Objects created dynamically at runtime do not automatically gain Physical-view artwork.
- The five steam-template unused-resource suggestions cannot understand consumption authored in Changes; they remain informational rather than being hidden globally.
- Some historical/tutorial material and auxiliary tests still need separate fixture or product decisions.
- Monaco emits one duplicate-module warning in this development page; the exercised workflows emitted no console errors.

## 7. Verification results

- `npm test` in `packages/workspec`: **pass**. This covered the validator self-test, playback state, Changes API, Generator/timing, three headless tests, integration checks, all seven 2.2 Studio templates, and package-to-web sync.
- `node scripts/check-sync.js`: **pass**; canonical WorkSpec assets and browser-served copies match.
- `git diff --check`: **pass**.
- Representative canonical timing: breadmaking 06:15–10:45, ecommerce 09:00–11:05, electronics 08:00–13:25, pharmaceutical 07:00–22:45, restaurant 16:00–22:00, multiperiod coffee 06:00 through its multi-day horizon, and steam sterilisation 06:40–10:30; no timing diagnostics.
- Steam template in Studio: **pass**. Playback showed readiness, decontamination, clean-side movement, inspection/packaging, steriliser operation, heating/exposure/cooling, quarantine/BI state, release, and two final released trays.
- Resolved properties: **pass** at 08:55 using Generator-produced values.
- Physical resolved movement/state: **pass** using the existing view.
- Deliberately induced runtime violation: **pass**. Problems showed two errors with structured observed/expected evidence; clicking the 07:30 violation jumped to 07:30 and exposed the affected negative tray state with the highlight route active.
- Project create/open/reopen, duplicate, Simulation Library creation, and persistence of Starting State, Changes, Generator, and Constraints: **pass**.
- Export/import: **pass**. All four WorkSpec files survived; script files were byte-identical and Starting State differed only by a trailing newline.
- Browser console during the exercised workflow: **zero errors**, one known Monaco warning.

Temporary projects and the exported archive created for manual verification were moved to Trash after the checks.

## 8. Final freeze assessment

**Yes.** The WorkSpec 2.2 representation/runtime is stable under the modelling, adversarial, constraint, package, template, and Studio evidence available here. Studio is now sufficiently wired to canonical timing and resolved state for the complete flagship story to be inspected, and runtime constraint failures are actionable without adding architecture.

Enter a course-safe hardening period with the architecture provisionally frozen: accept regression fixes, compatibility fixes, focused tests, and accurate labels/documentation; do not add new runtime, constraint, timeline, physical-rendering, remediation, provenance, or orchestration concepts without new evidence that invalidates the current model.
