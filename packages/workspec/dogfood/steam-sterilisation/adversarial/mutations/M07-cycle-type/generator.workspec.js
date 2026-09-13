// WorkSpec 2 Generator — computational chamber behaviour.
// The deterministic seed controls small in-band temperature variation after heat-up.

WorkSpec.onStart(({ set }) => {
    set('steam_steriliser', 'chamber_temperature_c', 22);
    set('steam_steriliser', 'chamber_pressure_kpa', 101.3);
    set('steam_steriliser', 'qualifying_exposure_minutes', 0);
});

WorkSpec.onUpdate(({ get, set, change, random }) => {
    const state = get('steam_steriliser', 'state');
    const current = get('steam_steriliser', 'chamber_temperature_c');

    if (state === 'running') {
        const next = current < 132
            ? Math.min(132, current + 22)
            : Math.round((132 + random() * 2) * 10) / 10;
        set('steam_steriliser', 'chamber_temperature_c', next);
        set('steam_steriliser', 'chamber_pressure_kpa', Math.round((101.3 + (next - 22) * 1.8) * 10) / 10);
        if (next >= 132) change('steam_steriliser', 'qualifying_exposure_minutes', 1);
    } else if (state === 'cooling') {
        const next = Math.max(22, current - 4);
        set('steam_steriliser', 'chamber_temperature_c', next);
        set('steam_steriliser', 'chamber_pressure_kpa', Math.round((101.3 + (next - 22) * 1.8) * 10) / 10);
    }
});
