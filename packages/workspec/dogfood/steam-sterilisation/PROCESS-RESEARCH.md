# Process research: reusable surgical-instrument steam sterilisation

Research date: 2026-09-09. This note identifies process facts suitable for a fresh WorkSpec 2.2 modelling dogfood. It deliberately does **not** design a WorkSpec model.

## Novelty and scope

`web/assets/static/simulation-library.json` currently contains six top-level examples: `breadmaking`, `ecommerce_order`, `electronics_assembly`, `pharmaceutical_production`, `restaurant_kitchen`, and `coffee-shop-multiperiod`. Reusable surgical-instrument steam sterilisation is not among them.

The defensible boundary is a hospital central-processing workflow for **reusable, heat- and moisture-compatible critical surgical instruments**, beginning when a contained, contaminated instrument set arrives and ending at load release to sterile storage. FDA describes the general path as point-of-use measures to prevent soil drying, transfer to a reprocessing area for thorough cleaning, then disinfection or sterilisation and storage/return to use. CDC says critical instruments that enter sterile tissue or the vascular system must be sterilised and steam is preferred where the item tolerates heat, steam, pressure, and moisture. Heat/moisture-sensitive devices, single-use-device reprocessing, immediate-use steam sterilisation, transport back to the operating room, and patient use are out of scope. ([FDA, “How are Reusable Medical Devices Reprocessed?”](https://www.fda.gov/medical-devices/reprocessing-reusable-medical-devices/how-are-reusable-medical-devices-reprocessed); [CDC recommendations 3.a and 14.a](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html))

## Smallest defensible process

1. **Receive and segregate.** Accept a contaminated set in the dirty/decontamination side; associate it with a set/load-traceability identity. Point-of-use staff should already have prevented soil from drying, and subsequent steps should avoid unnecessary delays because dried organic material impairs cleaning and sterilant penetration. Contaminated reusable sharps must be in puncture-resistant, labelled/colour-coded, leakproof containers and may not be stored or processed in a way that requires reaching into the container by hand. ([FDA guidance, pp. 18–19](https://www.fda.gov/media/80265/download); [CDC recommendation 2.b.ii](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html); [OSHA 29 CFR 1910.1030(d)(2)(viii), (d)(4)(ii)(E)](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1030))
2. **Disassemble and clean.** Follow the device-specific instructions for use (IFU), including explicit disassembly/reassembly and any required brushes, connectors, agents, concentrations, temperatures, rinse volumes, and repetitions. Cleaning with water plus detergent or enzymatic cleaner must precede sterilisation; either manual friction or mechanical cleaning (for example, an ultrasonic cleaner or washer-disinfector) is acceptable when used as directed. ([FDA guidance, pp. 18–21](https://www.fda.gov/media/80265/download); [CDC recommendations 2.b–2.e](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html))
3. **Dry, inspect, and assemble.** Instruments must be dry before packaging. Under adequate light (magnification where the IFU calls for it), check for residual soil and for damage or unacceptable deterioration; residual soil loops back to cleaning, while a device that cannot function or be cleaned properly routes to repair/disposal. Reassemble or arrange the set according to its device-specific IFU and count/list. ([FDA guidance, pp. 21 and 23](https://www.fda.gov/media/80265/download); [CDC recommendation 2.f](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html))
4. **Package and identify.** Arrange cleaned, dry, inspected items in a tray and use a compatible FDA-cleared wrap, pouch, or rigid container. Hinged instruments are open; removable parts are disassembled unless validated instructions say otherwise; concave surfaces permit drainage; heavy items do not damage delicate ones. Put a chemical indicator inside each package and an external indicator unless the internal result is visible. Give the package/load a traceable identity. ([CDC, “Sterilizing Practices,” packaging](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/sterilizing-practices.html); [CDC recommendations 15, 16.b, 18.c, and 19.e](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html))
5. **Configure and run a steam load.** Only batch packages that are compatible with the same validated device, packaging, and steriliser cycle. Load loosely so steam can circulate around every item; do not exceed IFU limits for tray weight, density, device characteristics, or chamber load. Run the identified gravity or dynamic-air-removal cycle, including its validated exposure and drying phases. ([CDC recommendations 14.c, 14.i, and 17.a](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html); [FDA guidance, pp. 22–23](https://www.fda.gov/media/80265/download); [CDC, “Sterilizing Practices,” loading](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/sterilizing-practices.html))
6. **Cool and hold.** Unload to a protected cooling/hold area and do not handle for operative use until cool. Moisture can compromise the sterile barrier, so a wet, torn, punctured, or otherwise compromised package is not releasable and loops to repack/reprocess. ([CDC recommendations 14.b and 18.e–18.f](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html); [FDA guidance, p. 23](https://www.fda.gov/media/80265/download))
7. **Review and release (or reject).** Review the cycle record and chemical indicators before release. Each load requires mechanical monitoring (time, temperature, pressure) and internal/external chemical monitoring; an inadequate result means the processed items must not be used. Biological indicators (BI) for steam use *Geobacillus stearothermophilus*: test at least weekly, and use a BI for every implant load with the implants quarantined, whenever possible, until the result is negative. Record steriliser/cycle, load ID and contents, exposure parameters, operator, and monitor results. Released, intact packages flow to protected sterile storage; failed packages/loads flow to investigation and reprocessing. ([CDC recommendations 16 and 19.d–19.e](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html); [CDC, “Steam Sterilization”](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/steam-sterilization.html))

## Minimum modelling vocabulary

### Roles

- **Decontamination technician:** receives, safely opens/handles the contained set, disassembles, cleans, rinses, and transfers only cleaned items to the clean side.
- **Preparation/packaging technician:** dries, inspects, resolves set completeness/function, assembles, adds indicators, packages, and labels.
- **Steriliser/release technician:** builds compatible loads, operates the steriliser, reviews monitors and package condition after cooling, records results, and releases or rejects the load.
- **Qualified maintenance person (exception-only):** inspects a failed steriliser; for a failed daily Bowie–Dick test, the steriliser stays unavailable until it has been inspected and passes a subsequent test. ([CDC, “Steam Sterilization”](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/steam-sterilization.html))

These are process responsibilities, not a sourced staffing ratio: one trained employee could hold more than one clean-side role if local separation, competency, and workload rules permit. CDC requires trained, competency-assessed reprocessing staff but does not prescribe this role split. ([CDC recommendation 19.a](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html))

### Equipment/resources

- Dirty receiving/holding position and compliant contaminated-sharps/set containers.
- Decontamination workstation: sink, compatible detergent/enzymatic agent, IFU-specific brushes/connectors, rinse and drying means; a washer-disinfector may be the primary batch cleaning resource.
- Lighted inspection/assembly bench, set list, packaging/rigid-container supply, internal and external chemical indicators, and labelling/traceability record.
- Steam steriliser plus loading cart/rack, protected cooling/hold positions, and BI test/reader service when required.
- Decontamination PPE: at minimum gloves for contaminated items; add mask plus eye/face protection and protective clothing where splash/spray exposure is reasonably anticipated. ([OSHA 29 CFR 1910.1030(d)(3)](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1030))

### Material/state flow

`contained contaminated set` → `disassembled set` → `cleaned/rinsed components` → `dry + visually clean + functional components` → `complete assembled tray` → `labelled package with chemical indicator` → `compatible steriliser load` → `processed load cooling/on hold` → either `released sterile packages` or `rework/repair/investigation`.

Detergent, rinse water, packaging, labels, and indicators are consumable inputs. Removed soil and spent process liquids are outputs outside this model boundary. Identity/traceability must persist from set/package through steriliser load and release record.

## Sequencing, capacity, timing, and safety invariants

- **Hard precedence:** thorough cleaning precedes inspection/assembly and sterilisation; drying and inspection precede packaging; packaging precedes loading; cooling and monitor review precede release. A failed cleanliness, function, packaging, or monitor gate prevents forward flow.
- **One-way contamination boundary:** keep dirty receiving/cleaning from clean inspection/packaging and released sterile goods. This is a defensible process-layout assumption derived from CDC's recommendation to centralise processing for quality control and its ordered cleaning-before-sterilisation rules; exact room/airflow architecture is local and should not be asserted by this model. ([CDC recommendations 2.a–2.b](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html))
- **Batch compatibility before utilisation:** steriliser capacity is constrained not only by chamber space but by the maximum validated tray weight/density, packaging, load configuration, and shared cycle. Items are placed loosely enough for steam circulation. Heavy metal mass and dense wraps raise wet-pack risk. ([FDA guidance, pp. 22–23](https://www.fda.gov/media/80265/download); [CDC, “Sterilizing Practices”](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/sterilizing-practices.html))
- **No universal numeric capacity:** washer batch size, workbench capacity, cooling positions, maximum tray mass, and chamber capacity must be explicit scenario/IFU parameters. The cited authorities do not provide one value valid across devices and sterilisers.
- **Promptness:** cleaning begins as soon as practical and delays between steps are minimised; no universal maximum queue time is established by these sources. Model delay sensitivity or a local service target separately from a regulatory invariant.
- **Exposure time is not total cycle time:** recognised minimum exposure for wrapped supplies is 30 minutes at 121°C in a gravity-displacement steriliser or 4 minutes at 132°C in a prevacuum steriliser, but actual time varies with item, wrapping, and steriliser. The authoritative operational value is the mutually compatible device, packaging, and steriliser IFU, including drying time; cooling time is also a local/validated parameter. ([CDC, “Steam Sterilization”](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/steam-sterilization.html); [FDA guidance, pp. 22–23](https://www.fda.gov/media/80265/download))
- **Prevacuum readiness gate:** on each day a vacuum-type steriliser is used, run the Bowie–Dick air-removal test before the first processed load, in an otherwise empty chamber (CDC describes 134°C for 3.5 minutes). A failure takes the steriliser out of service until inspection and a passing test. ([CDC, “Steam Sterilization”](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/steam-sterilization.html))
- **Occupational safety:** contaminated reusable sharps remain in puncture-resistant, leakproof, marked containers and are not retrieved by reaching into those containers. Gloves are required when handling contaminated items; splash-prone work requires face/eye and body protection appropriate to exposure. ([OSHA 29 CFR 1910.1030(d)(2), (d)(3), and (d)(4)](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1030))

## Decision and indicator set

The smallest useful decision graph is:

1. **Steam-compatible and reusable?** No → out-of-scope alternate pathway; yes → clean.
2. **Visually clean after cleaning?** No → repeat validated cleaning or dispose; yes → inspect function.
3. **Functional, intact, and complete?** No → repair/replace/resolve count; yes → package.
4. **Package/load compatible and within validated limits?** No → reconfigure; yes → run.
5. **Mechanical and chemical monitors acceptable?** No → reject/hold and investigate; yes → inspect cooled packages.
6. **Package dry and intact?** No → repack and reprocess; yes → apply BI rule.
7. **Implant load?** Yes → BI every load and quarantine until negative whenever possible; no → release under the facility's documented BI policy after the other gates pass.

Minimum observable indicators are: queue/set identity; soil-visible flag; damage/function/completeness outcome; package identity/integrity/dryness; load membership; selected cycle; time/temperature/pressure record; internal and external chemical-indicator outcomes; BI required/pending/result; steriliser ready/out-of-service; cooling complete; and final hold/release/rework disposition.

## Ambiguities the model must expose, not silently resolve

- The exact instrument family and its IFU: disassembly, agent, manual/mechanical cleaning steps, lumen treatment, lubrication, inspection tests, packaging, validated steam cycle, drying time, and reuse-life limits.
- Gravity versus prevacuum steriliser, chamber capacity, maximum tray/load constraints, and whether the daily Bowie–Dick readiness branch applies.
- Local staffing and whether clean-side preparation and load release require distinct people or merely distinct responsibilities.
- Arrival pattern and set mix, missing/damaged-instrument rates, cleaning failure/rework probability, packaging failure/wet-pack rate, equipment downtime, and repair replenishment time.
- Washer cycle/batch values, hands-on work times, total autoclave cycle time, BI incubation/result latency, cooling time, and finite hold/storage capacities.
- Non-implant BI-load release policy. CDC requires BI at least weekly and gives specific follow-up logic for positive steam BIs, but it does not require every ordinary load to wait for a BI result. A model should state its chosen facility policy. CDC says a single positive steam BI does not by itself require recall of non-implant items unless a steriliser/procedure defect is found; additional positive tests trigger nonsterile treatment, recall, and reprocessing. ([CDC recommendations 16.d–16.g](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html))
- Local sterile-storage/outdating policy and the downstream demand/operating-room interface, both outside this bounded run.

## Primary sources used

- [CDC — Recommendations for Disinfection and Sterilization in Healthcare Facilities](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html)
- [CDC — Steam Sterilization](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/steam-sterilization.html)
- [CDC — Sterilizing Practices](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/sterilizing-practices.html)
- [FDA — How are Reusable Medical Devices Reprocessed?](https://www.fda.gov/medical-devices/reprocessing-reusable-medical-devices/how-are-reusable-medical-devices-reprocessed)
- [FDA — Reprocessing Medical Devices in Health Care Settings: Validation Methods and Labeling](https://www.fda.gov/media/80265/download)
- [OSHA — 29 CFR 1910.1030, Bloodborne Pathogens](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1030)
