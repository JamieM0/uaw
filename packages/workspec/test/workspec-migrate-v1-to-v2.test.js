'use strict';

const test = require('node:test');
const assert = require('assert/strict');

const migrator = require('../workspec-migrate-v1-to-v2.js');

test('migrator converts legacy flat v1 structures into canonical v2 layout', () => {
    const legacyDoc = {
        name: 'Legacy Bakery',
        description: 'Legacy simulation',
        domain: 'food-production',
        time_unit: 'mins',
        start_time: '07:30',
        end_time: '11:00',
        actors: [
            { id: 'Lead Baker', type: 'human', properties: { emoji: 'baker' } }
        ],
        equipment: [
            { id: 'Deck Oven', type: 'machine' }
        ],
        layout: {
            locations: [
                { id: 'Mix Station' }
            ]
        },
        tasks: [
            {
                id: 'Mix Dough',
                actor_id: 'Lead Baker',
                start: '08:00',
                duration: 30,
                interactions: [
                    {
                        target_id: 'Deck Oven',
                        state: 'preheating'
                    }
                ]
            }
        ]
    };

    const migrated = migrator.migrate(legacyDoc, {
        fallbackMetaDomain: 'fallback-domain'
    });

    assert.equal(migrated.$schema, migrator.WORKSPEC_V2_SCHEMA_URL);
    assert.equal(migrated.simulation.schema_version, '2.1');
    assert.equal(migrated.simulation.meta.title, 'Legacy Bakery');
    assert.equal(migrated.simulation.config.time_unit, 'minutes');
    assert.equal(Array.isArray(migrated.simulation.world.objects), true);
    assert.equal(Array.isArray(migrated.simulation.process.tasks), true);
    assert.equal(migrated.simulation.world.objects.some((obj) => obj.type === 'actor' && obj.id === 'lead_baker'), true);
    assert.equal(migrated.simulation.world.objects.some((obj) => obj.type === 'equipment' && obj.id === 'deck_oven'), true);
    assert.equal(migrated.simulation.world.layout.locations[0].id, 'mix_station');
    assert.equal(migrated.simulation.process.tasks[0].actor_id, 'lead_baker');
    assert.equal(migrated.simulation.process.tasks[0].interactions[0].target_id, 'deck_oven');
});
