# Adversarial WorkSpec 2 review

Scope was limited to the healthy `start.workspec.json`, `changes.workspec.js`,
`generator.workspec.js`, `constraints.workspec.js`, and the canonical CLI. Each
mutant was run independently with these exact commands (paths substituted for
the mutant directory):

```text
workspec validate <mutant>/start.workspec.json --json
workspec snapshot <mutant>/start.workspec.json --changes <mutant>/changes.workspec.js --generator <mutant>/generator.workspec.js --time 10:30 --seed 17 --json
workspec constraints <mutant>/start.workspec.json --constraints <mutant>/constraints.workspec.js --changes <mutant>/changes.workspec.js --generator <mutant>/generator.workspec.js --time 10:30 --seed 17 --yes --json
```

All mutants returned validation exit 0 with the same five informational
`object.optimization.unused_resource` notices (zero errors). All snapshots
returned exit 0, zero runtime problems, and released quantity `2` at 10:30.

## Mutations

### M01 — understated tray count

Changed `start.workspec.json`: `load_record.properties.tray_count` from `2` to
`1`. This understates the implant load in the record while the physical flow
still processes and releases two trays. `validate`: passed (0 errors);
`snapshot`: passed, released `2`; `constraints`: passed, 0 violations. The
headline output was preserved. No existing constraint caught it: capacity only
checks an upper bound and consumable/workflow checks derive their counts from
the actual released quantity.

### M02 — mutually matching but clinically wrong cycle identifier

Changed `start.workspec.json`: both `selected_cycle` and `validated_cycle` to
`gravity_displacement_121c_textiles`. This can select a cycle validated for a
different load class while satisfying the equality check. `validate`: passed
(0 errors); `snapshot`: passed, released `2`; `constraints`: passed, 0
violations. The headline output was preserved. No existing constraint caught
it: compatibility is a boolean and the constraint only requires the two
strings to match.

### M03 — five-minute cooling instead of thirty

Changed `start.workspec.json`: `unload_and_cool.duration` from `30m` to `5m`.
The load can be handled/released before wrapped packages have cooled and dried
adequately. `validate`: passed (0 errors); `snapshot`: passed, released `2`;
`constraints`: passed, 0 violations. The headline output was preserved. No
existing constraint caught it; the release gate checks the final state label,
not elapsed cooling time.

### M04 — release record status never closed/released

Changed `changes.workspec.js`: removed the completion write setting
`load_record.release_status` to `released`. The run releases trays while its
audit record remains `not_released` (and the task still sets the world state to
`closed`). `validate`: passed (0 errors); `snapshot`: passed, released `2`;
`constraints`: passed, 0 violations. The headline output was preserved. No
existing constraint caught it; release gating does not inspect
`release_status`.

### M05 — one-minute BI incubation

Changed `start.workspec.json`: `incubate_biological_indicator.duration` from
`60m` to `1m`. A biological indicator can be declared negative without the
modelled incubation interval. `validate`: passed (0 errors); `snapshot`:
passed, released `2`; `constraints`: passed, 0 violations. The headline output
was preserved. No existing constraint caught it; it checks the result value and
task ordering, not incubation duration.

### M06 — supervisor performs BI incubation

Changed `start.workspec.json`: `incubate_biological_indicator.actor_id` from
`bi_incubator` to `spd_supervisor`. This assigns biological-indicator work to a
release authority rather than the incubator/equipment actor. `validate`: passed
(0 errors); `snapshot`: passed, released `2`; `constraints`: passed, 0
violations. The headline output was preserved. No existing constraint caught
it: staffing qualification has no requirement for the BI task, and the
incubator reservation remains available.

### M07 — steriliser cycle type contradicts the validated cycle

Changed `start.workspec.json`: `steam_steriliser.properties.cycle_type` from
`pre_vacuum` to `gravity_displacement`, while retaining the pre-vacuum
validated/selected cycle identifier. This permits the machine's declared mode
to disagree with the cycle used for wrapped implants. `validate`: passed (0
errors); `snapshot`: passed, released `2`; `constraints`: passed, 0 violations.
The headline output was preserved. No existing constraint caught it; cycle
type is not compared with the selected/validated cycle.

### M08 — cycle record omitted

Changed `changes.workspec.js`: removed the completion write setting
`load_record.cycle_recorded` to `true`. `validate`: passed (0 errors);
`snapshot`: passed, released `2`; `constraints`: failed with two structured
violations:

```json
[
  {
    "objects": ["steam_steriliser", "load_record"],
    "property": "chamber_temperature_c",
    "observed": {"cycle_recorded": false, "mechanical_result": "pass", "pressure_kpa": 101.3},
    "expected": {"minimum_temperature_c": 132, "minimum_exposure_minutes": 4, "mechanical_monitoring": "recorded pass including pressure"},
    "message": "The pre-vacuum load must achieve its minimum steam exposure and have an acceptable mechanical record."
  },
  {
    "objects": ["processed_trays", "load_record", "steam_steriliser", "spd_supervisor"],
    "observed": {"cycle_recorded": false, "mechanical_result": "pass", "chemical_indicator_result": "pass", "biological_indicator_result": "negative", "authorised_review": true},
    "expected": "implant load held until cool/dry/intact, all monitoring passes, BI is negative, and an authorised reviewer performs release",
    "message": "Implant trays may be released only after every quarantine and monitoring gate passes."
  }
]
```

The headline snapshot output was preserved, and the existing minimum-exposure
and implant-release gates caught it.

### M09 — clean trays never transferred to clean assembly

Changed `changes.workspec.js`: removed `move('cleaned_trays', 'clean_assembly')`
from `rinse_and_dry` completion. Inspection/assembly still produces the normal
downstream quantities even though the cleaned product remains on the dirty-side
location. `validate`: passed (0 errors); `snapshot`: passed, released `2`;
`constraints`: passed, 0 violations. The headline output was preserved. No
existing constraint caught it; workflow checks quantities/states, not product
locations.

### M10 — one-minute rinse/dry

Changed `start.workspec.json`: `rinse_and_dry.duration` from `15m` to `1m`.
Trays can enter clean assembly without the modelled rinse/dry time. `validate`:
passed (0 errors); `snapshot`: passed, released `2`; `constraints`: passed, 0
violations. The headline output was preserved. No existing constraint caught
it; the workflow only observes the resulting `dry` state and ordering.

## Survivor list

`M01-tray-count`, `M02-cycle-id`, `M03-short-cooling`, `M04-release-status`,
`M05-short-bi`, `M06-bi-actor`, `M07-cycle-type`, `M09-no-move-clean`, and
`M10-short-rinse` all survived validation, snapshot, and runtime constraints
with two released trays. `M08-no-cycle-record` was caught by existing runtime
constraints.
