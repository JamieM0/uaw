# Steam sterilisation dogfood: minimal world model

This model follows one two-tray implant load through a hospital sterile-processing department. It intentionally stops at release to sterile storage; transport to the operating room, use on a patient, and long-term inventory are outside scope.

## Structure retained

- **People:** a decontamination technician, an assembly technician, a qualified steriliser operator, and a sterile-processing supervisor.
- **Locations:** receiving, decontamination, clean assembly, steriliser area, quarantine/incubation, and sterile storage.
- **Constrained equipment:** a two-tray ultrasonic cleaner, a two-tray pre-vacuum steam steriliser, and a biological-indicator incubator.
- **Consumables and flow:** two contaminated implant trays become cleaned, inspected, packaged, processed, and finally released trays; detergent, wrap sets, internal chemical indicators, and one biological indicator are consumed.
- **Load state:** the load record carries implant-load identity, cycle record status, chemical and biological indicator results, and release status.
- **Dynamic process state:** steriliser chamber temperature and accumulated qualifying exposure minutes are observable properties updated by the Generator while the explicit sterilisation task is active.

## Planned stages

1. Pass the pre-vacuum steriliser's daily empty-chamber air-removal test.
2. Receive and sort the returned trays.
3. Clean them in the decontamination area.
4. Rinse and dry them.
5. Inspect and assemble them in the clean area.
6. Package, label, and place an internal chemical indicator in each tray.
7. Load the steriliser within its tray capacity.
8. Run a pre-vacuum steam cycle while the Generator models chamber temperature and pressure.
9. Unload and cool the load in quarantine.
10. Incubate the load's biological indicator.
11. Review the recorded cycle and indicator results before release.

The Starting State owns this structure and schedule. Changes will own authored transformations and recorded decisions. The Generator will own minute-by-minute chamber behaviour. Constraints will inspect only resolved state and history.
