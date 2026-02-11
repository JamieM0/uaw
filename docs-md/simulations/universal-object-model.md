# Universal Object Model (UOM) for Simulations

The Universal Object Model (UOM) is the object + interaction schema used by UAW simulations. The canonical definitions live in WorkSpec; this page focuses on how the Simulation Playground uses the model and how legacy simulation fields map to the modern interaction format.

## Canonical Spec (WorkSpec)

- [WorkSpec v2.0: Schema](/docs/workspec/specification/v2.0/schema)
- [WorkSpec v2.0: Objects](/docs/workspec/specification/v2.0/objects)
- [WorkSpec v2.0: Interactions](/docs/workspec/specification/v2.0/interactions)
- [WorkSpec Migration Guide](/docs/workspec/guides/migration)

## UOM in the Playground

Most simulations follow this shape:

- `simulation.meta`: Human-facing metadata
- `simulation.layout`: Physical/digital spaces
- `simulation.objects`: Typed entities (actors, equipment, resources, products, and custom types)
- `simulation.tasks`: Scheduled work that changes object properties (and optionally moves actors)

## Objects

Objects are identified by `id` and carry arbitrary `properties`. A few properties are commonly used by the playground and validators:

- Actors: `cost_per_hour`, `location`
- Resources: `quantity`, `unit`, `cost_per_unit`
- Products: `quantity`, `revenue_per_unit`
- Equipment: `state`, `location`, `capacity`

See also: [WorkSpec Reference: Properties](/docs/workspec/reference/properties)

## Task Interactions

Preferred format is `tasks[].interactions[]` with `property_changes`.

```json
{
  "id": "mix_dough",
  "actor_id": "baker",
  "start": "09:00",
  "duration": 20,
  "interactions": [
    { "object_id": "flour", "property_changes": { "quantity": { "delta": -2 } } },
    { "object_id": "mixed_dough", "property_changes": { "quantity": { "delta": 1 } } },
    { "object_id": "mixer", "property_changes": { "state": { "from": "clean", "to": "dirty" } } }
  ]
}
```

### Legacy Compatibility

Some older simulations use fields like `consumes`, `produces`, and `equipment_interactions`. The playground may still support these in many places, but new docs and examples should prefer `interactions`.

## Movement

To model actor movement, either change an actor's `location` via `property_changes` or use a `type: "movement"` task.

See: [Actor Movement in Simulations](/docs/simulations/actor-movement)

## Validation + Economics

The validator consumes the UOM to check scheduling, resources, locations, and economics (labor/resource costs and product revenue).

See: [Simulation & Validation System](/docs/simulations/validation) and [Validation Rules Reference](/docs/simulations/validation-rules-reference)
