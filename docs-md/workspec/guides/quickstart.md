# WorkSpec 2.2 Quickstart

Build and run a tiny WorkSpec project in Studio. The project packs one kit from
one part, so every source has an obvious role.

## 1. Learn the model

```text
Starting State    what exists initially
Changes           explicit things that happen
Constraints       things that must remain true
Generator         optional computational behaviour
Simulation        the resolved observable history
```

You do not need a Generator for this project—or for ordinary WorkSpec
authoring.

## 2. Start the guided tutorial

Open [WorkSpec Studio](/playground), choose **Start Tutorial**, and work through
the eight short lessons. They use one small packing project to show the Starting
State, an explicit Change, playback, a Constraint, and a traceable violation.

After the tutorial, use the Simulation Library templates as larger reference
projects. They deliberately contain more objects and tasks than this first
lesson, so inspect them only after the packing flow is familiar.

## 3. Inspect the project sources

Studio projects contain:

| File | Studio tab | Purpose |
| --- | --- | --- |
| `start.workspec.json` | Starting State | Declarative locations, objects, tasks, timing, and dependencies |
| `changes.workspec.js` | Changes | Explicit effects attached to task start or completion |
| `constraints.workspec.js` | Constraints | Rules evaluated against the resolved simulation |
| `generator.workspec.js` | Generator | Optional computed or simulated behaviour |

The simulation is not a fifth source file. Studio resolves it from those
sources.

## 4. Edit, validate, and simulate

1. In **Starting State**, change an initial object property such as a resource
   quantity.
2. Choose **Validate WorkSpec**. Fix errors before continuing; warnings and
   informational results remain clearly distinguished in **Problems**.
3. In **Changes**, inspect the handler attached to a task ID.
4. Open **Simulate**, press Play, then drag the red playhead to compare the
   initial state with a later state.
5. In **Constraints**, inspect a rule. If it reports a runtime violation, open
   **Problems** and select the result to jump to its time and affected object.

## 5. Save and reopen

Studio creates a folder-backed project. It writes the four files above and
remembers the folder in the browser. Use **Export** for a portable
`.workspec.zip`; imports restore Starting State, Changes, Constraints, Generator,
and the project seed.

Continue with the [WorkSpec 2.2 Authoring Guide](/docs/workspec/guides/authoring),
then keep the [WorkSpec 2.2 Cheatsheet](/docs/workspec/cheatsheet) nearby.

## Historical documents

WorkSpec 2.0 and 2.1 placed effects in task `interactions`. Those versioned
specifications remain available under **Historical specifications** in the docs
navigation, but that is not the 2.2 authoring model.
