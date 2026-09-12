// WorkSpec 2.2 Changes — explicit authored work and decisions.

WorkSpec.task('daily_air_removal_test', task => {
    task.onStart(() => {
        set('steriliser_operator', 'state', 'testing_steriliser', { temporary: true });
        set('steam_steriliser', 'state', 'air_removal_test');
    });
    task.onComplete(() => {
        set('steam_steriliser', 'daily_air_removal_test_result', 'pass');
        set('steam_steriliser', 'state', 'available');
    });
});

WorkSpec.task('receive_and_sort', task => {
    task.onStart(() => set('decon_technician', 'state', 'working', { temporary: true }));
    task.onComplete(() => set('contaminated_trays', 'state', 'sorted_for_decontamination'));
});

WorkSpec.task('ultrasonic_cleaning', task => {
    task.onStart(() => {
        set('decon_technician', 'state', 'working', { temporary: true });
        set('ultrasonic_cleaner', 'state', 'running', { temporary: true });
        set('contaminated_trays', 'state', 'being_cleaned', { temporary: true });
    });
    task.onComplete(() => {
        change('contaminated_trays', 'quantity', -2);
        set('contaminated_trays', 'state', 'depleted');
        change('detergent_doses', 'quantity', -2);
        change('cleaned_trays', 'quantity', 2);
        set('cleaned_trays', 'state', 'wet');
    });
});

WorkSpec.task('rinse_and_dry', task => {
    task.onStart(() => {
        set('decon_technician', 'state', 'working', { temporary: true });
        set('cleaned_trays', 'state', 'rinsing_and_drying', { temporary: true });
    });
    task.onComplete(() => {
        set('cleaned_trays', 'state', 'dry');
    });
});

WorkSpec.task('inspect_and_assemble', task => {
    task.onStart(() => {
        set('assembly_technician', 'state', 'working', { temporary: true });
        set('cleaned_trays', 'state', 'under_inspection', { temporary: true });
    });
    task.onComplete(() => {
        change('cleaned_trays', 'quantity', -2);
        set('cleaned_trays', 'state', 'depleted');
        change('inspected_trays', 'quantity', 2);
        set('inspected_trays', 'state', 'clean_dry_functional');
    });
});

WorkSpec.task('package_and_label', task => {
    task.onStart(() => {
        set('assembly_technician', 'state', 'working', { temporary: true });
        set('inspected_trays', 'state', 'being_packaged', { temporary: true });
    });
    task.onComplete(() => {
        change('inspected_trays', 'quantity', -2);
        set('inspected_trays', 'state', 'depleted');
        change('wrap_sets', 'quantity', -2);
        change('internal_chemical_indicators', 'quantity', -2);
        change('packaged_trays', 'quantity', 2);
        set('packaged_trays', 'state', 'wrapped_labelled_with_internal_indicator');
    });
});

WorkSpec.task('load_steriliser', task => {
    task.onStart(() => set('steriliser_operator', 'state', 'working', { temporary: true }));
    task.onComplete(() => {
        move('packaged_trays', 'steriliser_area');
        set('packaged_trays', 'state', 'loaded');
        set('load_record', 'state', 'loaded');
    });
});

WorkSpec.task('run_pre_vacuum_cycle', task => {
    task.onStart(() => {
        set('steriliser_operator', 'state', 'monitoring_cycle', { temporary: true });
        set('steam_steriliser', 'state', 'running');
        set('steam_steriliser', 'mechanical_result', 'running');
    });
    task.onComplete(() => {
        change('packaged_trays', 'quantity', -2);
        set('packaged_trays', 'state', 'depleted');
        change('processed_trays', 'quantity', 2);
        set('processed_trays', 'state', 'hot_pending_cooling');
        move('processed_trays', 'quarantine');
        set('steam_steriliser', 'state', 'cooling');
        set('steam_steriliser', 'mechanical_result', 'pass');
        set('load_record', 'cycle_recorded', true);
        set('load_record', 'chemical_indicator_result', 'pass');
        set('load_record', 'state', 'processed_pending_release');
    });
});

WorkSpec.task('unload_and_cool', task => {
    task.onStart(() => {
        set('steriliser_operator', 'state', 'handling_hot_load', { temporary: true });
        set('processed_trays', 'state', 'cooling_undisturbed', { temporary: true });
    });
    task.onComplete(() => {
        set('processed_trays', 'state', 'cool_dry_intact');
        set('steam_steriliser', 'state', 'available');
    });
});

WorkSpec.task('incubate_biological_indicator', task => {
    task.onStart(() => {
        change('biological_indicators', 'quantity', -1);
        set('bi_incubator', 'state', 'incubating', { temporary: true });
        set('load_record', 'biological_indicator_result', 'incubating');
    });
    task.onComplete(() => set('load_record', 'biological_indicator_result', 'negative'));
});

WorkSpec.task('review_and_release', task => {
    task.onStart(() => set('spd_supervisor', 'state', 'reviewing_load', { temporary: true }));
    task.onComplete(() => {
        change('processed_trays', 'quantity', -2);
        set('processed_trays', 'state', 'depleted');
        change('released_sterile_trays', 'quantity', 2);
        set('released_sterile_trays', 'state', 'released_for_use');
        set('load_record', 'release_status', 'released');
        set('load_record', 'released_by_role', 'sterile_processing_supervisor');
        set('load_record', 'state', 'closed');
    });
});
