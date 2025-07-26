const TutorialValidators = {
    /**
     * Checks that the assistant's two tasks no longer overlap.
     * Used in: Step 2
     */
    validateNoAssistantOverlap: function(simulation) {
        if (!simulation || !simulation.tasks) return false;
        
        const spillsTask = simulation.tasks.find(t => t.id.includes('clean_up_spills'));
        const ovenTask = simulation.tasks.find(t => t.id.includes('preheat_oven'));

        if (!spillsTask || !ovenTask) return false;

        const spillsStart = (spillsTask.start.split(':')[0] * 60) + Number(spillsTask.start.split(':')[1]);
        const spillsEnd = spillsStart + (spillsTask.duration || 0);
        
        const ovenStart = (ovenTask.start.split(':')[0] * 60) + Number(ovenTask.start.split(':')[1]);

        return ovenStart >= spillsEnd;
    },

    /**
     * Checks that baking happens after the oven is preheated.
     * Used in: Step 3
     */
    validateBakingDependency: function(simulation) {
        if (!simulation || !simulation.tasks) return false;

        const preheatTask = simulation.tasks.find(t => t.id.includes('preheat_oven'));
        const bakeTask = simulation.tasks.find(t => t.id.includes('bake_bread'));

        if (!preheatTask || !bakeTask) return false;

        const preheatStart = (preheatTask.start.split(':')[0] * 60) + Number(preheatTask.start.split(':')[1]);
        const preheatEnd = preheatStart + (preheatTask.duration || 0);

        const bakeStart = (bakeTask.start.split(':')[0] * 60) + Number(bakeTask.start.split(':')[1]);

        // The bake task must start at or after the preheat ends, AND must depend on it.
        return bakeStart >= preheatEnd && (bakeTask.depends_on || []).includes(preheatTask.id);
    },

    /**
     * Checks if the starting stock of flour is sufficient.
     * Used in: Step 4
     */
    validateSufficientFlour: function(simulation) {
        if (!simulation || !simulation.resources) return false;
        const flour = simulation.resources.find(r => r.id === 'flour');
        return flour && flour.starting_stock >= 10;
    },

    /**
     * Checks that the two shaping tasks no longer overlap on the single-capacity rack.
     * Used in: Step 5
     */
    validateRackCapacity: function(simulation) {
        if (!simulation || !simulation.tasks) return false;
        
        const task1 = simulation.tasks.find(t => t.id.includes('shape_batch_1'));
        const task2 = simulation.tasks.find(t => t.id.includes('shape_batch_2'));

        if (!task1 || !task2) return false;

        const start1 = (task1.start.split(':')[0] * 60) + Number(task1.start.split(':')[1]);
        const end1 = start1 + (task1.duration || 0);
        
        const start2 = (task2.start.split(':')[0] * 60) + Number(task2.start.split(':')[1]);

        // They are valid if one starts after the other finishes.
        return start2 >= end1 || (start1 >= (start2 + (task2.duration || 0)));
    },

    /**
     * Checks for the resolution of all three issues in the coffee shop capstone.
     * Used in: Step 6
     */
    validateCoffeeShopWorkflow: function(simulation) {
        if (!simulation || !simulation.tasks || !simulation.equipment) return false;
        
        const pullTask = simulation.tasks.find(t => t.id.includes('pull_espresso'));
        const steamTask = simulation.tasks.find(t => t.id.includes('steam_milk'));
        const pourTask = simulation.tasks.find(t => t.id.includes('pour_latte_art'));
        // Find the new cleaning task the user is supposed to add.
        const cleanTask = simulation.tasks.find(t => t.id.includes('clean') && t.equipment_interactions?.some(i => i.id === 'espresso_machine'));

        if (!pullTask || !steamTask || !pourTask || !cleanTask) return false;

        // 1. Check for scheduling overlap between pull and steam
        const pullStart = (pullTask.start.split(':')[0] * 60) + Number(pullTask.start.split(':')[1]);
        const pullEnd = pullStart + (pullTask.duration || 0);
        const steamStart = (steamTask.start.split(':')[0] * 60) + Number(steamTask.start.split(':')[1]);
        if (steamStart < pullEnd) return false; // Overlap check

        // 2. Check that the machine is cleaned before use
        const cleanStart = (cleanTask.start.split(':')[0] * 60) + Number(cleanTask.start.split(':')[1]);
        if (cleanStart >= pullStart) return false; // Cleaning must be first
        const cleanInteraction = cleanTask.equipment_interactions.find(i => i.id === 'espresso_machine');
        if (!cleanInteraction || cleanInteraction.from_state !== 'dirty' || cleanInteraction.to_state !== 'clean') return false; // Must be correct state change

        // 3. Check for dependency timing between steam and pour
        const steamEnd = steamStart + (steamTask.duration || 0);
        const pourStart = (pourTask.start.split(':')[0] * 60) + Number(pourTask.start.split(':')[1]);
        if (pourStart < steamEnd) return false; // Dependency timing check

        return true; // All conditions met
    }
};