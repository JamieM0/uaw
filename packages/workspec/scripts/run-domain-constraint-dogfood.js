#!/usr/bin/env node
'use strict';

// Executable dogfood study, intentionally not part of the permanent test suite.
// Constraint sources are authored in the library; mutations are defined separately here.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const cli = path.join(repoRoot, 'packages', 'workspec', 'bin', 'workspec.js');
const library = require(path.join(repoRoot, 'web', 'assets', 'static', 'simulation-library.json')).simulations;

const scenarios = {
    breadmaking: { time: 645, headline: ['baked_bread', 4] },
    ecommerce_order: { time: 665, headline: ['packed_order', 1] },
    electronics_assembly: { time: 805, headline: ['finished_phones', 12] },
    pharmaceutical_production: { time: 1365, headline: ['finished_drug_product', 380] },
    restaurant_kitchen: { time: 1320, headline: ['finished_entrees', 21] },
    'coffee-shop-multiperiod': { time: 18180, headline: ['coffee_beans', 10] }
};

function object(project, id) {
    return project.simulation.world.objects.find((candidate) => candidate.id === id);
}

function task(project, id) {
    return project.simulation.process.tasks.find((candidate) => candidate.id === id);
}

const mutations = {
    breadmaking: [
        { id: 'no_initial_yeast', rule: 'Dough production requires available yeast stock.', mutate: (p) => { object(p, 'yeast').properties.quantity = 0; } },
        { id: 'knead_before_mix', rule: 'Mixing must precede kneading.', mutate: (p) => { task(p, 'knead_dough').depends_on = ['measure_flour', 'activate_yeast']; task(p, 'mix_dough').depends_on = ['knead_dough']; task(p, 'first_rise').depends_on = ['mix_dough']; } },
        { id: 'undersized_oven', rule: 'Oven capacity must cover the four-loaf batch.', mutate: (p) => { object(p, 'oven').properties.capacity = 1; } }
    ],
    ecommerce_order: [
        { id: 'pick_before_inventory_update', rule: 'Inventory must be reserved before items leave stock.', mutate: (p) => { task(p, 'pick_items').depends_on = ['confirm_order']; task(p, 'update_inventory').depends_on = ['pick_items']; task(p, 'transport_to_packing').depends_on = ['update_inventory']; } },
        { id: 'no_initial_boxes', rule: 'Packing requires available packing supplies.', mutate: (p) => { object(p, 'packing_supplies').properties.quantity = 0; } },
        { id: 'warehouse_worker_takes_payment', rule: 'Payment processing requires an authorized customer-service role.', mutate: (p) => { task(p, 'process_payment').actor_id = 'warehouse_worker'; } }
    ],
    electronics_assembly: [
        { id: 'remove_explicit_reflow_gate', rule: 'Final assembly explicitly depends on completed solder reflow.', mutate: (p) => { task(p, 'phone_assembly_batch_1').depends_on = ['final_assembly_setup', 'display_assembly_batch_1']; } },
        { id: 'insufficient_displays', rule: 'Display stock must cover both production batches.', mutate: (p) => { object(p, 'displays').properties.quantity = 10; } },
        { id: 'undersized_conveyor', rule: 'Conveyor capacity must cover each assembly batch.', mutate: (p) => { object(p, 'assembly_conveyor').properties.capacity = 1; } }
    ],
    pharmaceutical_production: [
        { id: 'purity_before_identity', rule: 'Identity confirmation precedes purity release testing.', mutate: (p) => { task(p, 'api_purity_assay').depends_on = ['crude_api_purification']; task(p, 'api_identity_testing').depends_on = ['api_purity_assay']; task(p, 'tablet_blend_preparation').depends_on = ['api_identity_testing', 'excipient_preparation']; } },
        { id: 'junior_chemist_synthesis', rule: 'Chemical synthesis requires the senior qualified chemist.', mutate: (p) => { task(p, 'chemical_synthesis').actor_id = 'chemist_junior'; } },
        { id: 'undersized_reactor', rule: 'Reactor working capacity must accommodate the batch charge.', mutate: (p) => { object(p, 'reactor_vessel').properties.capacity = '1L'; } }
    ],
    restaurant_kitchen: [
        { id: 'warm_walk_in', rule: 'Cold storage stays at or below 4 C.', mutate: (p) => { object(p, 'walk_in_refrigeration').properties.temperature = 10; } },
        { id: 'prep_cook_on_grill', rule: 'Grill service requires grill-qualified staff.', mutate: (p) => { task(p, 'grill_first_proteins').actor_id = 'prep_cook_1'; } },
        { id: 'four_minute_protein_cook', rule: 'The protein batch needs a safe cooking duration.', mutate: (p) => { task(p, 'grill_first_proteins').duration = '4m'; } }
    ],
    'coffee-shop-multiperiod': [
        { id: 'low_declared_opening_stock', rule: 'Declared opening stock must cover service through replenishment.', mutate: (p) => { object(p, 'coffee_beans').properties.quantity = 5; } },
        { id: 'barista_services_machine', rule: 'Equipment servicing requires the technician role.', mutate: (p) => { task(p, 'day_8_equipment_service').actor_id = 'barista_alice'; } },
        { id: 'abbreviated_machine_service', rule: 'The planned service scope requires its maintenance duration.', mutate: (p) => { task(p, 'day_8_equipment_service').duration = '18m'; } }
    ]
};

// Follow-up constraints are evaluated only after the locked-set score. They show
// whether obvious survivors are expressible without changing the runtime API.
const followUpSources = {
    breadmaking: `module.exports = {
        'inventory.non_negative': (ctx) => { for (const t of ctx.times()) for (const id of ['flour', 'water', 'yeast']) if (ctx.getAt(t, id, 'quantity') < 0) return { time: t, objects: [id], property: 'quantity', message: 'Ingredient stock may not become negative.' }; },
        'oven.batch_capacity': (ctx) => ctx.get('baked_bread', 'quantity') > ctx.get('oven', 'capacity') ? { objects: ['oven', 'baked_bread'], property: 'capacity', message: 'The oven must hold the baked batch.' } : null
    };`,
    ecommerce_order: `module.exports = {
        'inventory.non_negative': (ctx) => { for (const t of ctx.times()) for (const id of ['inventory_stock', 'packing_supplies']) if (ctx.getAt(t, id, 'quantity') < 0) return { time: t, objects: [id], property: 'quantity', message: 'Fulfilment stock may not become negative.' }; },
        'order.reserve_before_pick': (ctx) => { const ts = ctx.times(); for (let i = 1; i < ts.length; i += 1) if (ctx.getAt(ts[i], 'inventory_stock', 'quantity') < ctx.getAt(ts[i - 1], 'inventory_stock', 'quantity') && ctx.stateAt(ts[i]).task_statuses.pick_items === 'completed') return { time: ts[i], objects: ['inventory_stock'], message: 'Inventory must be reserved before picking completes.' }; },
        'order.payment_role': (ctx) => { for (const t of ctx.times()) for (const r of ctx.stateAt(t).reservations) if (r.task === 'process_payment' && ctx.stateAt(t).objects[r.resource]?.properties?.role !== 'Customer Support') return { time: t, objects: [r.resource], property: 'role', message: 'Payment requires the customer-support role.' }; }
    };`,
    electronics_assembly: `module.exports = {
        'inventory.non_negative': (ctx) => { for (const t of ctx.times()) for (const id of ['pcb_blanks', 'processors', 'memory_chips', 'displays', 'batteries', 'housings']) if (ctx.getAt(t, id, 'quantity') < 0) return { time: t, objects: [id], property: 'quantity', message: 'Component stock may not become negative.' }; },
        'conveyor.batch_capacity': (ctx) => { const ts = ctx.times(), capacity = ctx.get('assembly_conveyor', 'capacity'); for (let i = 1; i < ts.length; i += 1) { const batch = ctx.getAt(ts[i], 'partial_phones', 'quantity') - ctx.getAt(ts[i - 1], 'partial_phones', 'quantity'); if (batch > capacity) return { time: ts[i], objects: ['assembly_conveyor', 'partial_phones'], property: 'capacity', message: 'The conveyor must hold each assembly batch.' }; } }
    };`,
    pharmaceutical_production: `module.exports = {
        'drug.identity_before_purity': (ctx) => { for (const t of ctx.times()) { const s = ctx.stateAt(t).task_statuses; if (s.api_purity_assay === 'completed' && s.api_identity_testing !== 'completed') return { time: t, objects: ['tested_api'], message: 'Identity testing must complete before the purity assay.' }; } },
        'drug.synthesis_qualification': (ctx) => { for (const t of ctx.times()) for (const r of ctx.stateAt(t).reservations) if (r.task === 'chemical_synthesis' && ctx.stateAt(t).objects[r.resource]?.properties?.certification !== 'PhD Chemistry') return { time: t, objects: [r.resource], property: 'certification', message: 'Chemical synthesis requires the senior chemistry qualification.' }; },
        'reactor.charge_capacity': (ctx) => { const capacity = Number.parseFloat(ctx.get('reactor_vessel', 'capacity')), t0 = Math.min(...ctx.times()), charged = ctx.getAt(t0, 'solvent_methanol', 'quantity') - ctx.get('solvent_methanol', 'quantity'); return charged > capacity ? { objects: ['reactor_vessel', 'solvent_methanol'], property: 'capacity', message: 'The reactor must hold the liquid charge.' } : null; }
    };`,
    restaurant_kitchen: `module.exports = { 'grill.role_qualification': (ctx) => { for (const t of ctx.times()) for (const r of ctx.stateAt(t).reservations) if (r.task === 'grill_first_proteins' && ctx.stateAt(t).objects[r.resource]?.properties?.specialization !== 'Grill') return { time: t, objects: [r.resource], property: 'specialization', message: 'Grill service requires grill-qualified staff.' }; } };`
};

function run(args) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    let json = null;
    try { json = JSON.parse(result.stdout); } catch (_error) {}
    return { status: result.status, json, stderr: result.stderr };
}

function execute(entry, project, changes, label, constraintSource = entry.constraints) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `workspec-domain-${entry.id}-`));
    const startPath = path.join(directory, `${label}.start.workspec.json`);
    const changesPath = path.join(directory, `${label}.changes.workspec.js`);
    const constraintsPath = path.join(directory, 'constraints.workspec.js');
    fs.writeFileSync(startPath, JSON.stringify(project, null, 2));
    fs.writeFileSync(changesPath, changes);
    fs.writeFileSync(constraintsPath, constraintSource);
    const scenario = scenarios[entry.id];
    const validation = run(['validate', startPath, '--json']);
    const snapshot = run(['snapshot', startPath, '--changes', changesPath, '--time', String(scenario.time), '--seed', '1', '--json']);
    const constraints = run(['constraints', startPath, '--changes', changesPath, '--constraints', constraintsPath, '--time', String(scenario.time), '--seed', '1', '--json', '--yes']);
    const [headlineId, expected] = scenario.headline;
    return {
        validationPasses: validation.status === 0 && !(validation.json?.problems || []).some((p) => p.severity === 'error'),
        runtimeSucceeds: snapshot.status === 0 && !(snapshot.json?.problems || []).some((p) => p.severity === 'error'),
        headlineSurvives: snapshot.json?.state?.objects?.[headlineId]?.properties?.quantity === expected,
        caught: (constraints.json?.violations || []).length > 0,
        constraintIds: (constraints.json?.violations || []).map((v) => v.constraint_id),
        observedHeadline: snapshot.json?.state?.objects?.[headlineId]?.properties?.quantity
    };
}

const results = [];
const mutatedProjects = new Map();
for (const entry of library) {
    const healthy = execute(entry, { simulation: structuredClone(entry.simulation) }, entry.changes, 'healthy');
    if (!healthy.validationPasses || !healthy.runtimeSucceeds || !healthy.headlineSurvives || healthy.caught) {
        throw new Error(`${entry.id} healthy baseline failed: ${JSON.stringify(healthy)}`);
    }
    for (const mutation of mutations[entry.id]) {
        const project = { simulation: structuredClone(entry.simulation) };
        mutation.mutate(project);
        mutatedProjects.set(`${entry.id}/${mutation.id}`, { entry, project, mutation });
        results.push({ simulation: entry.id, mutation: mutation.id, rule: mutation.rule, ...execute(entry, project, entry.changes, mutation.id) });
    }
}

const followUps = [];
for (const [simulation, source] of Object.entries(followUpSources)) {
    const entry = library.find((candidate) => candidate.id === simulation);
    const healthy = execute(entry, { simulation: structuredClone(entry.simulation) }, entry.changes, 'follow-up-healthy', source);
    if (healthy.caught || !healthy.validationPasses || !healthy.runtimeSucceeds) throw new Error(`${simulation} follow-up constraint rejects healthy model`);
    for (const mutation of mutations[simulation]) {
        const record = mutatedProjects.get(`${simulation}/${mutation.id}`);
        const outcome = execute(entry, record.project, entry.changes, `follow-up-${mutation.id}`, source);
        followUps.push({ simulation, mutation: mutation.id, caught: outcome.caught, constraintIds: outcome.constraintIds });
    }
}

process.stdout.write(`${JSON.stringify({ seed: 1, results, followUps }, null, 2)}\n`);
