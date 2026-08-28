'use strict';

// Focused G008 slices of six Batch 1 scenarios. These deliberately model only
// authored interruption, captured progress and recovery timing; they do not
// claim runtime spawning, quantification, dispatch, route search or optimisation.
function fixture(id, title, objects, tasks) {
    return {
        simulation: {
            schema_version: '2.1',
            meta: { title, description: `Focused ${id} G008 regression.`, domain: 'benchmark regression' },
            config: { time_unit: 'minutes', start_time: '09:00', end_time: '12:00', currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London' },
            world: { layout: { locations: [{ id: 'worksite', name: 'Worksite', properties: { capacity: 4 } }] }, objects },
            process: { tasks }
        }
    };
}

const actor = (id, name = id) => ({ id, type: 'actor', name, properties: { state: 'ready' } });
const equipment = (id, properties = {}) => ({ id, type: 'equipment', name: id, properties: { state: 'ready', ...properties } });
const resource = (id, properties = {}) => ({ id, type: 'resource', name: id, properties: { quantity: 1, ...properties } });
const fault = (id, actorId, target, property, value) => ({ id, actor_id: actorId, start: '09:10', duration: '10m', interactions: [{ target_id: target, property_changes: { [property]: { set: value } } }] });
const recovery = (id, actorId, source) => ({ id, actor_id: actorId, duration: '10m', when: { '==': [`@${source}.status`, 'interrupted'] }, timing: [{ relation: 'offset', event: 'start', relative_to: `@${source}.actual_end`, min_offset: '0m' }] });

module.exports = {
    'B1-05': fixture('B1-05', 'Transfusion reaction', [actor('clinician'), actor('monitor'), resource('blood_unit_42', { reaction_absent: true, infused_ml: 180 })], [
        { id: 'transfuse', actor_id: 'clinician', start: '09:00', duration: '60m', while: { '==': ['@blood_unit_42.reaction_absent', true] }, progress: '@blood_unit_42.infused_ml' },
        fault('reaction', 'monitor', 'blood_unit_42', 'reaction_absent', false),
        recovery('assess_reaction', 'monitor', 'transfuse')
    ]),
    'B1-06': fixture('B1-06', 'Blocked chilled route', [actor('driver'), actor('controller'), equipment('forklift'), resource('pallet', { route_open: true, exposure_minutes: 12 })], [
        { id: 'move_pallet', actor_id: 'driver', start: '09:00', duration: '60m', while: { '==': ['@pallet.route_open', true] }, progress: '@pallet.exposure_minutes', reservations: [{ resource: 'forklift', mode: 'exclusive' }] },
        fault('block_route', 'controller', 'pallet', 'route_open', false),
        { ...recovery('quarantine_pallet', 'controller', 'move_pallet'), continues: { task: 'move_pallet' }, reservations: [{ resource: 'forklift', mode: 'exclusive' }] }
    ]),
    'B1-09': fixture('B1-09', 'Pump failure during concrete pour', [actor('crew'), actor('supervisor'), equipment('pump'), resource('slab', { pump_available: true, placed_m3: 42 })], [
        { id: 'pour_slab', actor_id: 'crew', start: '09:00', duration: '90m', while: { '==': ['@slab.pump_available', true] }, progress: '@slab.placed_m3', interactions: [{ at: 'start', target_id: 'slab', property_changes: { placed_m3: { set: 42 } } }] },
        fault('pump_failure', 'supervisor', 'slab', 'pump_available', false),
        recovery('form_joint', 'crew', 'pour_slab')
    ]),
    'B1-12': fixture('B1-12', 'Railway emergency curtailment', [actor('controller'), actor('work_group'), resource('possession', { authority_valid: true, cleared_metres: 600 })], [
        { id: 'track_work', actor_id: 'work_group', start: '09:00', duration: '90m', while: { '==': ['@possession.authority_valid', true] }, progress: '@possession.cleared_metres' },
        fault('curtail', 'controller', 'possession', 'authority_valid', false),
        recovery('withdraw_group', 'work_group', 'track_work')
    ]),
    'B1-14': fixture('B1-14', 'Theatre exclusion-zone intrusion', [actor('fly_operator'), actor('stage_manager'), equipment('fly_line'), resource('scene', { exclusion_clear: true, height_m: 4 })], [
        { id: 'fly_scenery', actor_id: 'fly_operator', start: '09:00', duration: '45m', while: { '==': ['@scene.exclusion_clear', true] }, progress: '@scene.height_m', reservations: [{ resource: 'fly_line', mode: 'exclusive' }] },
        fault('intrusion', 'stage_manager', 'scene', 'exclusion_clear', false),
        { ...recovery('make_safe', 'stage_manager', 'fly_scenery'), continues: { task: 'fly_scenery' } }
    ]),
    'B1-19': fixture('B1-19', 'Active wildfire work invalidation', [actor('crew'), actor('command'), resource('sector', { assignment_safe: true, line_built_m: 250 })], [
        { id: 'build_line', actor_id: 'crew', start: '09:00', duration: '120m', while: { '==': ['@sector.assignment_safe', true] }, progress: '@sector.line_built_m' },
        fault('fire_front_change', 'command', 'sector', 'assignment_safe', false),
        recovery('withdraw_to_safety', 'crew', 'build_line')
    ])
};
