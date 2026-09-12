# WorkSpec 2.2 first-course readiness pass

Status: **course-ready for the frozen 2.2 architecture, with the bounded risks
listed below.**

## 1. First-time-user path inspected

The pass followed the normal public route from the docs landing page through
Quickstart, the guided Studio tutorial, the 2.2 Authoring Guide, the cheatsheet,
and the explicitly historical specifications. In Studio it covered Projects,
new/blank/template entry points, Starting State, Changes, Constraints,
Generator, validation/Problems, playback and scrubbing, violation navigation,
and folder-backed project persistence/export wiring.

## 2. Legacy or contradictory material found

- The active tutorial was a legacy multi-domain course that taught task
  `interactions` and did not teach the frozen architecture.
- Several current guides and the docs landing/navigation mixed current and
  historical routes or used old Script/interaction-oriented explanations.
- The visible task editor still offered an interaction-creation control.
- The tutorial normaliser treated only 2.0 as an already migrated document,
  silently rewriting its 2.2 Starting State to 2.1.
- An active unused-resource suggestion told learners to add
  "tasks/interactions."

Historical 2.0/2.1 material remains available, but is now grouped and labelled
as historical rather than presented as the default learning route.

## 3. Tutorial changes

The tutorial is now one eight-step packing project: inspect Starting State,
change parts from 2 to 3, validate, add a `pack_kit` completion Change, simulate
and scrub to 09:10, inspect a non-negative Constraint, deliberately produce and
follow a `-1` violation, restore the healthy state, then learn that Generator is
optional. It contains no task `interactions` and does not use the
steam-sterilisation model.

Tutorial source changes now re-run lesson validation, all four sources progress
between lessons, and exiting restores the project that was open before the
tutorial.

## 4. Documentation and navigation changes

The current route is now explicit:

```text
short introduction -> guided tutorial -> 2.2 Authoring Guide -> cheatsheet
                   -> historical specifications only when explicitly needed
```

Quickstart, Authoring Guide, cheatsheet, Studio guide, AI-generation guide, and
cookbook now use the frozen vocabulary without duplicating the whole conceptual
reference. The docs sidebar and landing page visibly separate current 2.2
guidance from 2.0/2.1 and legacy simulation material. Larger Simulation Library
templates are positioned as post-tutorial references, not the first lesson.

## 5. Studio comprehension fixes

- Projects shows the learning sequence: Project -> Starting State -> Changes ->
  Simulate/Constraints, with a visible **Start tutorial** action.
- Editor copy names all four sources and says Generator is optional.
- **Validate WorkSpec** is visible in the Editor command bar.
- Timeline, Problems, and Rules are persistent Simulate destinations.
- Problems explains structural, source-execution, and runtime Constraint
  evidence; runtime results include time, object, observed value, and expected
  value.
- Blank projects declare 2.2, include all four source files, and do not expose a
  visible legacy interaction editor.
- The canonical unused-resource suggestion now recommends a task or explicit
  Change, not `interactions`.

## 6. Beginner error flows tested

- **Malformed Starting State:** Studio immediately showed an invalid-JSON error
  and disabled tutorial progression.
- **Impossible dependency:** the canonical validator reported
  `task.reference.invalid_dependency`, named `pack_kit` and `missing_task`, and
  pointed to `/simulation/process/tasks/0/depends_on`.
- **Runtime Constraint violation:** zero initial parts became `-1` at 09:10;
  Problems showed "Parts must never become negative", affected object `parts`,
  observed `-1`, and expected `{ "min": 0 }`. Selecting the result moved the
  playhead to 09:10 and displayed the affected state. No success state was shown
  while the error existed.

## 7. Remaining course-facing risks

- Simulation Library projects remain intentionally richer than the tutorial;
  even a template labelled Basic is not as small as the packing lesson. The
  learning route now sets that expectation instead of changing core examples.
- A browser may require the learner to re-authorise or reconnect a project
  folder. Studio explains this, but the native permission prompt is necessarily
  browser-specific.
- Informational `object.optimization.unused_resource` results can still be a
  beginner false friend. They remain informational and were not suppressed.

## 8. Deliberately deferred non-blockers

The padded Gantt range, generic tooltip numeric precision, missing Physical
artwork for runtime-created objects, and the Monaco duplicate-module warning
were left unchanged. None blocked or contradicted the verified learning path.
No runtime abstraction, Constraint API, remediation, provenance, timeline
semantic, renderer, or orchestration concept was added.

## 9. Verification results

- Browser walkthrough completed all eight tutorial lessons from the normal
  Projects entry point.
- At 09:00 the walkthrough showed 3 parts/0 kits; at 09:10 it showed 2 parts/1
  kit.
- The deliberate violation and evidence jump behaved as described, and the
  lesson completed only after the Starting State was restored.
- Ending the tutorial restored the pre-tutorial sample; reloading confirmed the
  normal 2.2 sample and the persistent Timeline/Problems/Rules navigation.
- Folder creation/reopen tests round-tripped Starting State, Changes, and
  Constraints for all seven 2.2 templates. Integration checks confirm project
  persistence and ZIP import/export include Starting State, Changes,
  Constraints, Generator, and the seed/manifest data.
- `npm --prefix packages/workspec test` passed, including validator, Changes,
  Generator, playback, headless snapshot/Constraint, Studio integration, and
  all seven template tests. Canonical and browser-served package assets are in
  sync.

## 10. Assessment

**Yes.** A student with no knowledge of WorkSpec's development history can now
learn the frozen model without instructor correction: Starting State says what
exists, Changes say what explicitly happens, Constraints state what must remain
true, Generator is optional computation, and Simulation is the resolved
observable history. The current route teaches that model consistently and
places older interaction-based material behind explicit historical labels.
