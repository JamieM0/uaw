# WorkSpec 2.2 headless simulation-library dogfood

Run on 2026-09-08 against all six entries in `web/assets/static/simulation-library.json` using the packaged CLI as a subprocess. Each Starting State was written to a temporary project, validated with `workspec validate --json`, and executed with `workspec snapshot --changes ... --time ... --seed 1 --json`. Each broken variant used the same validator, CLI, and runtime path.

The executable regression is `scripts/test-headless-snapshot.js`; temporary project files are created under the operating system's temporary directory and are not retained.

## Results

| Simulation | Validation | Snapshot | Healthy resolved assertion | Broken authored input | Broken resolved assertion |
| --- | --- | ---: | --- | --- | --- |
| `breadmaking` | Valid; 0 errors, 1 warning, 3 info | `645` (`10:45`) | `baked_bread.quantity = 4` | Starting flour `50 → 2 kg` | `flour.quantity = -1` |
| `ecommerce_order` | Valid; 0 errors, 1 warning, 2 info | `665` (`11:05`) | `packed_order.quantity = 1` | Starting inventory `1000 → 0 items` | `inventory_stock.quantity = -1` |
| `electronics_assembly` | Valid; 0 errors, 1 warning, 7 info | `805` (`13:25`) | `finished_phones.quantity = 12` | Starting processors `200 → 10 units` | `processors.quantity = -4` |
| `pharmaceutical_production` | Valid; 0 errors, 1 warning, 9 info | `1365` (`22:45`) | `finished_drug_product.quantity = 380` | Starting coating solution `50 → 10 L` | `coating_solution.quantity = -2` |
| `restaurant_kitchen` | Valid; 0 errors, 1 warning, 10 info | `1320` (`22:00`) | `finished_entrees.quantity = 21` | Starting artisanal greens `5 → 1 kg` | `artisanal_greens.quantity = -0.5` |
| `coffee-shop-multiperiod` | Valid; 0 errors, 0 warnings, 2 info | `18180` (day 13, `15:00`) | `coffee_beans.quantity = 10` | Day 13 weekend demand `40 → 120` | `coffee_beans.quantity = -70` |

All healthy and broken snapshots completed with zero runtime errors. The broken results are intentionally bad observable world states, not validation or runtime failures. The same projects now run `inventory.non_negative` through the runtime constraint system: every healthy project passes, while every broken variant returns structured object/property/time evidence.

Additional runtime coverage exercises capacity, temperature range, impossible transition, incompatible location, and across-period rules. Those examples established the initial query interface: point queries (`stateAt`/`getAt`) plus resolved `times()` are sufficient without exposing authored Changes or Generator behavior.

## Validator output observed

The five single-day simulations report `economic.profitability.negative_margin` warnings. Starting State validation also reports `object.optimization.unused_resource` info for resources whose consumption is authored in Changes: flour/water/yeast; packing supplies/inventory; seven electronics inputs; nine pharmaceutical inputs; ten restaurant inputs; and coffee beans/milk. This is expected from validating the declarative Starting State alone and is useful evidence for the still-open question of what future runtime constraints can access.

## Generator and determinism coverage

The CLI integration test additionally runs a minimal project with Starting State, Changes, and Generator together. Two snapshots at `09:04` with seed `7` are deeply identical; Changes produces `item.quantity = 10`, Generator produces a numeric random sample, and four one-minute Generator updates are observable even though the last authored task completes at `09:02`. This verifies that a requested snapshot time, rather than Studio playback or the natural task end, controls headless Generator execution.

## Architectural boundary kept

No constraint execution API, constraint DSL, `WorkSpec.constraint(...)`, or public history-query API was added. The CLI returns only the existing runtime's serialized observable state plus runtime problems. The negative-inventory checks live in dogfood assertions so they can later be replaced by real runtime constraints after the access-model decision is made.
