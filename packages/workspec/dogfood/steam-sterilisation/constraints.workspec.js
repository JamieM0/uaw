// WorkSpec 2.2 runtime constraints. Each comment states the retained domain intent.

const close = (left, right) => Math.abs(left - right) < 1e-9;
const firstTime = (ctx, predicate) => ctx.times().find(time => predicate(ctx.stateAt(time)));
const previousTime = (ctx, time) => ctx.times().filter(candidate => candidate < time).at(-1);

module.exports = {
    // Intent: tray identity is conserved through every processing stage; no stage may create, lose, or borrow trays.
    'flow.tray_conservation': (ctx) => {
        const ids = ['contaminated_trays', 'cleaned_trays', 'inspected_trays', 'packaged_trays', 'processed_trays', 'released_sterile_trays'];
        const start = Math.min(...ctx.times());
        const expected = ids.reduce((sum, id) => sum + ctx.getAt(start, id, 'quantity'), 0);
        for (const time of ctx.times()) {
            const quantities = Object.fromEntries(ids.map(id => [id, ctx.getAt(time, id, 'quantity')]));
            const total = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
            if (Object.values(quantities).some(quantity => !Number.isFinite(quantity) || quantity < 0) || !close(total, expected)) {
                return { time, objects: ids, property: 'quantity', observed: { quantities, total }, expected: { conserved_total: expected, minimum_each: 0 }, message: 'Tray quantities must remain non-negative and conserved across processing stages.' };
            }
        }
        if (!close(ctx.get('released_sterile_trays', 'quantity'), expected)) {
            return { objects: ids, property: 'quantity', observed: ctx.get('released_sterile_trays', 'quantity'), expected, message: 'The completed healthy run must account for every received tray at release.' };
        }
        return null;
    },

    // Intent: this scenario consumes one cleaning dose, wrap set, and internal indicator per tray, plus one BI for its implant load.
    'flow.load_consumables': (ctx) => {
        const start = Math.min(...ctx.times());
        const trays = ctx.get('released_sterile_trays', 'quantity');
        const used = {
            detergent_doses: ctx.getAt(start, 'detergent_doses', 'quantity') - ctx.get('detergent_doses', 'quantity'),
            wrap_sets: ctx.getAt(start, 'wrap_sets', 'quantity') - ctx.get('wrap_sets', 'quantity'),
            internal_chemical_indicators: ctx.getAt(start, 'internal_chemical_indicators', 'quantity') - ctx.get('internal_chemical_indicators', 'quantity'),
            biological_indicators: ctx.getAt(start, 'biological_indicators', 'quantity') - ctx.get('biological_indicators', 'quantity')
        };
        const expected = { detergent_doses: trays, wrap_sets: trays, internal_chemical_indicators: trays, biological_indicators: 1 };
        return Object.keys(expected).every(id => close(used[id], expected[id])) ? null : {
            objects: Object.keys(used), property: 'quantity', observed: used, expected,
            message: 'Consumed cleaning, packaging, and monitoring supplies must match the processed implant load.'
        };
    },

    // Intent: trays must be observably cleaned, inspected, packaged, processed, and released in that order, with no final WIP.
    'workflow.required_stages': (ctx) => {
        const ids = ['cleaned_trays', 'inspected_trays', 'packaged_trays', 'processed_trays', 'released_sterile_trays'];
        const observed = Object.fromEntries(ids.map(id => [id, firstTime(ctx, state => state.objects[id].properties.quantity > 0)]));
        const ordered = ids.every((id, index) => Number.isFinite(observed[id]) && (index === 0 || observed[id] > observed[ids[index - 1]]));
        const stranded = ids.slice(0, -1).filter(id => ctx.get(id, 'quantity') !== 0);
        return ordered && stranded.length === 0 ? null : {
            objects: ids, property: 'quantity', observed: { first_positive_time: observed, stranded }, expected: 'cleaned < inspected < packaged < processed < released; no final work in progress',
            message: 'Every tray must pass through the required observable stages in order.'
        };
    },

    // Intent: a pre-vacuum steriliser is not used for the first load until its daily empty-chamber air-removal test has passed.
    'sterilisation.daily_air_removal_gate': (ctx) => {
        for (const time of ctx.times()) {
            const state = ctx.stateAt(time);
            if (state.task_statuses.run_pre_vacuum_cycle !== 'active') continue;
            const result = state.objects.steam_steriliser.properties.daily_air_removal_test_result;
            const testStatus = state.task_statuses.daily_air_removal_test;
            if (result !== 'pass' || testStatus !== 'completed') return {
                time, objects: ['steam_steriliser'], property: 'daily_air_removal_test_result', observed: { result, testStatus }, expected: { result: 'pass', testStatus: 'completed' },
                message: 'The daily air-removal test must pass before the pre-vacuum processing cycle starts.'
            };
        }
        return null;
    },

    // Intent: the two-tray load fits both batch machines and uses a device/package/steriliser-compatible validated cycle.
    'sterilisation.capacity_and_compatibility': (ctx) => {
        const load = ctx.get('load_record', 'tray_count');
        const start = Math.min(...ctx.times());
        const received = ctx.getAt(start, 'contaminated_trays', 'quantity');
        const released = ctx.get('released_sterile_trays', 'quantity');
        const observed = {
            load,
            received,
            released,
            cleaner_capacity: ctx.get('ultrasonic_cleaner', 'capacity'),
            steriliser_capacity: ctx.get('steam_steriliser', 'capacity'),
            selected_cycle: ctx.get('load_record', 'selected_cycle'),
            validated_cycle: ctx.get('steam_steriliser', 'validated_cycle'),
            compatible: ctx.get('load_record', 'device_package_cycle_compatible')
        };
        const ok = load === received && load === released && load <= observed.cleaner_capacity && load <= observed.steriliser_capacity && observed.compatible === true && observed.selected_cycle === observed.validated_cycle;
        return ok ? null : {
            objects: ['load_record', 'ultrasonic_cleaner', 'steam_steriliser'], observed,
            expected: 'recorded count equals received and released count, load within both capacities, and selected_cycle === validated_cycle with compatibility confirmed',
            message: 'The recorded load must match physical tray flow, fit its equipment, and use one mutually compatible validated cycle.'
        };
    },

    // Intent: the observed exposure meets the selected equipment protocol (pre-vacuum 132 C/4m or gravity 121 C/30m) and records mechanical parameters.
    'sterilisation.minimum_exposure': (ctx) => {
        const cycleType = ctx.get('steam_steriliser', 'cycle_type');
        const protocol = {
            pre_vacuum: { temperature: 132, minutes: 4 },
            gravity_displacement: { temperature: 121, minutes: 30 }
        }[cycleType];
        const cycleTimes = ctx.times().filter(time => ctx.stateAt(time).task_statuses.run_pre_vacuum_cycle === 'active');
        const qualifying = cycleTimes.filter(time => {
            const state = ctx.stateAt(time);
            return protocol && state.task_statuses.run_pre_vacuum_cycle === 'active' && state.objects.steam_steriliser.properties.chamber_temperature_c >= protocol.temperature;
        });
        const final = ctx.state();
        const steriliser = final.objects.steam_steriliser.properties;
        const startPressure = ctx.getAt(Math.min(...ctx.times()), 'steam_steriliser', 'chamber_pressure_kpa');
        const pressures = cycleTimes.map(time => ctx.getAt(time, 'steam_steriliser', 'chamber_pressure_kpa'));
        const pressureRecorded = pressures.length > 0 && pressures.every(Number.isFinite) && Math.max(...pressures) > startPressure;
        const recorded = ctx.get('load_record', 'cycle_recorded') === true && steriliser.mechanical_result === 'pass' && pressureRecorded;
        return protocol && qualifying.length >= protocol.minutes && recorded ? null : {
            objects: ['steam_steriliser', 'load_record'], property: 'chamber_temperature_c', observed: { qualifying_minutes: qualifying, cycle_recorded: ctx.get('load_record', 'cycle_recorded'), mechanical_result: steriliser.mechanical_result, pressure_samples: pressures },
            expected: protocol ? { cycle_type: cycleType, minimum_temperature_c: protocol.temperature, minimum_exposure_minutes: protocol.minutes, mechanical_monitoring: 'recorded pass including pressure' } : { supported_cycle_types: ['pre_vacuum', 'gravity_displacement'] },
            message: 'The load must meet its declared steam-cycle protocol and have an acceptable mechanical record.'
        };
    },

    // Intent: cleaned trays cross to the clean assembly area before inspection; sterile output ends in protected storage.
    'workflow.processing_zones': (ctx) => {
        const inspectionTime = firstTime(ctx, state => state.objects.inspected_trays.properties.quantity > 0);
        if (!Number.isFinite(inspectionTime)) return {
            objects: ['cleaned_trays', 'inspected_trays'], observed: { inspectionTime }, expected: 'an observable clean-side inspection stage',
            message: 'Cleaned trays must cross to clean assembly before inspection.'
        };
        const beforeInspection = ctx.stateAt(previousTime(ctx, inspectionTime));
        const observed = {
            cleaned_state: beforeInspection.objects.cleaned_trays.properties.state,
            cleaned_location: beforeInspection.objects.cleaned_trays.location,
            released_location: ctx.state().objects.released_sterile_trays.location
        };
        return observed.cleaned_location === 'clean_assembly' && observed.released_location === 'sterile_storage' ? null : {
            time: inspectionTime, objects: ['cleaned_trays', 'released_sterile_trays'], observed,
            expected: { cleaned_location: 'clean_assembly', released_location: 'sterile_storage' },
            message: 'Only dry cleaned trays may enter clean-side inspection, and released trays must remain in sterile storage.'
        };
    },

    // Intent: an implant load remains quarantined until cycle, indicator, cooling/package, and authorised-review gates all pass.
    'release.implant_load_gates': (ctx) => {
        const releaseTime = firstTime(ctx, state => state.objects.released_sterile_trays.properties.quantity > 0);
        if (!Number.isFinite(releaseTime)) return {
            objects: ['released_sterile_trays', 'load_record'], property: 'quantity', observed: ctx.get('released_sterile_trays', 'quantity'), expected: 'released implant trays after completed review',
            message: 'The completed load must reach an observable authorised release decision.'
        };
        const before = previousTime(ctx, releaseTime);
        const prior = ctx.stateAt(before);
        const atRelease = ctx.stateAt(releaseTime);
        const reviewResources = prior.reservations.filter(reservation => reservation.task === 'review_and_release').map(reservation => reservation.resource);
        const authorised = reviewResources.some(id => prior.objects[id]?.properties?.release_authority === true);
        const observed = {
            releaseTime,
            prior_package_state: prior.objects.processed_trays.properties.state,
            cycle_recorded: prior.objects.load_record.properties.cycle_recorded,
            mechanical_result: prior.objects.steam_steriliser.properties.mechanical_result,
            chemical_indicator_result: prior.objects.load_record.properties.chemical_indicator_result,
            biological_indicator_result: prior.objects.load_record.properties.biological_indicator_result,
            authorised_review: authorised,
            final_record_state: ctx.get('load_record', 'state'),
            final_release_status: ctx.get('load_record', 'release_status'),
            released_by_role: ctx.get('load_record', 'released_by_role')
        };
        const reviewerRoles = reviewResources.map(id => prior.objects[id]?.properties?.role);
        const ok = prior.objects.load_record.properties.implant_load === true && observed.prior_package_state === 'cool_dry_intact' && observed.cycle_recorded === true && observed.mechanical_result === 'pass' && observed.chemical_indicator_result === 'pass' && observed.biological_indicator_result === 'negative' && authorised && observed.final_record_state === 'closed' && observed.final_release_status === 'released' && reviewerRoles.includes(observed.released_by_role);
        return ok ? null : {
            time: releaseTime, objects: ['processed_trays', 'load_record', 'steam_steriliser', ...reviewResources], observed,
            expected: 'implant load held until cool/dry/intact, all monitoring passes, BI is negative, and the authorised reviewer closes a released audit record',
            message: 'Implant trays may be released only after every quarantine and monitoring gate passes.'
        };
    },

    // Intent: dirty-side, clean-side, steriliser, and release work is performed by personnel qualified for that responsibility.
    'staffing.role_qualification': (ctx) => {
        const required = {
            receive_and_sort: ['qualified_for', 'decontamination'],
            ultrasonic_cleaning: ['qualified_for', 'decontamination'],
            rinse_and_dry: ['qualified_for', 'decontamination'],
            inspect_and_assemble: ['qualified_for', 'inspection_and_packaging'],
            package_and_label: ['qualified_for', 'inspection_and_packaging'],
            daily_air_removal_test: ['qualified_for', 'steam_sterilisation'],
            load_steriliser: ['qualified_for', 'steam_sterilisation'],
            run_pre_vacuum_cycle: ['qualified_for', 'steam_sterilisation'],
            unload_and_cool: ['qualified_for', 'steam_sterilisation'],
            review_and_release: ['release_authority', true]
        };
        for (const time of ctx.times()) {
            const state = ctx.stateAt(time);
            for (const reservation of state.reservations.filter(item => item.implicit && required[item.task])) {
                const [property, expected] = required[reservation.task];
                const observed = state.objects[reservation.resource]?.properties?.[property];
                if (observed !== expected) return {
                    time, objects: [reservation.resource], property, observed, expected,
                    message: `Task '${reservation.task}' requires personnel with the modelled qualification.`
                };
            }
        }
        return null;
    }
};
