# WorkSpec 2.2 Single Authoritative Run

This note records the runtime pipeline immediately before the Single
Authoritative Run milestone and the execution contract implemented by the
milestone. It complements `WORKSPEC-2.2-VALIDATION-LAYER-AUDIT.md`.

## Previous execution model

1. `buildIndex()` reads the Starting State and indexes the declared objects,
   locations, tasks, collections, types, and State Libraries.
2. `makeInitialState()` clones indexed objects and locations, gives every task a
   `pending` status, and creates empty active-task, reservation, temporary-write,
   and usage collections.
3. `applyChanges()` compiles Changes callbacks into ordinary task interactions.
4. `replay()` resolves authored timing, then `replayWithTimings()` processes
   task start/completion events through the requested `until` value.
5. At a task start, dependencies are checked, the actor is selected, `when`,
   `requires`, `while`, and continuation conditions are checked, reservations
   are evaluated and acquired, and Changes `onStart` interactions are committed.
6. At a task completion, temporary writes are restored, Changes `onComplete`
   interactions are committed, the task is marked `completed`, and actor/resource
   reservations are released. A failed effect does not currently prevent the
   unqualified `completed` status.
7. Simultaneous Changes writes are prepared against one snapshot. Numeric deltas
   to the same property combine; other same-property writes and lifecycle/property
   combinations conflict and are rejected.
8. History contains the initial state and one point after each task/cutoff event.
   `snapshotAt()` replays through the requested time and serialises the last point.
9. Only after the entire task replay, `runGenerator()` walks the finished base
   history. Generator `onStart` runs at configured simulation start and
   `onUpdate` runs at every following whole minute through the horizon/natural
   end. It overlays Generator writes on the already-decided task history.
   Generator writes win same-time Generator/Changes conflicts with a warning.
10. `runConstraints()` calls `runProject()` itself. Constraint `stateAt()` calls
    `snapshotProjectAt()`, which calls `runProject()` yet again for another
    horizon. Consequently validation state, Constraint state, and historical
    snapshots can come from distinct Generator executions.
11. Runtime static validation also emits authored contention and declarative
    syntax diagnostics. These are returned with runtime/resolved-history
    provenance even when no task executes.

The key defect is causal: Generator output is a final-history overlay, so tasks
cannot observe it. The second defect is identity: there is no single run object
reused by validation, Constraints, and snapshots.

## Milestone execution contract

`runProject()` returns the authoritative resolved run. Its evolving state,
history, task statuses/runtime records, usage, diagnostics, seed, and horizon are
the only inputs used by snapshots and Constraints.

At each logical time the order is:

1. finish tasks and apply their Changes `onComplete` writes;
2. run Generator (`onStart` at simulation start, otherwise `onUpdate`) and apply
   its writes, with Generator winning a same-target conflict and a deterministic
   warning;
3. evaluate active-task invariants and create runtime task instances;
4. evaluate scheduled task dependencies and guards, then actor selection and
   reservations, against that post-Generator state;
5. apply accepted tasks' Changes `onStart` writes, acquire reservations, and make
   those tasks active;
6. record one authoritative post-event history point.

The ordering makes Generator state at time T visible to decisions and task-start
effects at T while retaining completion-before-start behavior. Changes
`onComplete` occurs before Generator at the same time; task `onStart` occurs
after Generator. Cross-source same-target writes are deterministic and reported.

A finite horizon means “resolve through T”. Work not reached by T remains
`pending`; active work remains `active`. A dependency that is incomplete only
because its predecessor or dependent start lies beyond T is future work, not a
runtime failure.

Document/source syntax diagnostics are produced before execution and retain
`document` or `source` provenance. Runtime diagnostics describe events actually
attempted by the resolved run. Constraints inspect an existing run and never
cause Starting State, Changes, or Generator to execute again.

“Used through T” means read by a resolved expression or Generator `get()`,
written, created, removed, or named by a resolved reservation attempt through
T. Boolean operators short-circuit, so unreachable operands do not count.
Constraint reads query evidence after execution and do not change this execution
usage set. Merely appearing in authored work outside the horizon does not count.

## Bounded execution

The evaluator schedules work incrementally and no longer allocates an array for
every minute up to `until`. A run stops with `runtime.execution.event_limit`
after 10,000 work units by default; trusted callers may supply `maxEvents` up to
1,000,000. Work units include task starts/completions, Generator callbacks and
writes, Changes interactions, reservations, active guards, and dynamic
collection work. Invalid or clamped limits produce explicit configuration
diagnostics. The run records both the requested horizon and its actual
`resolvedThrough` boundary. Snapshots and Constraints refuse later times.

Generator and Constraint callbacks are synchronous ordinary JavaScript. The
shared browser/Node runtime can reject thrown and async callbacks, and the event
limit bounds callbacks that return, but it cannot pre-empt a callback that never
returns. Hosts that execute untrusted code still need worker/process isolation
with a wall-clock timeout. Adding a cross-platform sandbox is intentionally out
of scope for this milestone.
