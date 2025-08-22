const TutorialValidators = {
    /**
     * Advanced space design challenge validation
     * Used in: Step 2
     */
    validateAdvancedSpaceDesign: function(simulation) {
        if (!simulation || !simulation.layout || !simulation.layout.locations) return false;
        
        const locations = simulation.layout.locations;
        const pixelsPerMeter = simulation.layout.meta?.pixels_per_unit || 20;
        
        // Check for Prep Station with 5 meter length
        const prepStation = locations.find(loc => 
            loc.name === "Prep Station" && 
            loc.shape && 
            loc.shape.width === (5 * pixelsPerMeter)
        );
        
        // Check for Oven Zone with 3 meter length
        const ovenZone = locations.find(loc => 
            loc.name === "Oven Zone" && 
            loc.shape && 
            loc.shape.width === (3 * pixelsPerMeter)
        );
        
        // Must have at least 3 locations total (including the initial reception)
        return prepStation && ovenZone && locations.length >= 3;
    },

    /**
     * Playback experience validation - checks if user has experimented with controls
     * Used in: Step 4
     */
    validatePlaybackExperience: function(simulation) {
        // This is more of a behavioral validation - in a real implementation,
        // we could track user interactions with playback controls.
        // For now, we'll validate that the simulation has the required structure.
        return simulation && 
               simulation.objects && 
               simulation.objects.length >= 3 &&
               simulation.tasks && 
               simulation.tasks.length >= 3;
    },

    /**
     * Resource economics validation - checks sufficient rare minerals
     * Used in: Step 5
     */
    validateResourceEconomics: function(simulation) {
        if (!simulation || !simulation.objects) return false;
        const minerals = simulation.objects.find(o => 
            o.id === 'rare_minerals' && 
            o.type === 'resource_pile'
        );
        return minerals && minerals.properties && minerals.properties.quantity >= 15;
    },

    /**
     * JSON editing mastery validation - checks for added elements
     * Used in: Step 6
     */
    validateJsonEditingMastery: function(simulation) {
        if (!simulation || !simulation.objects || !simulation.tasks) return false;
        
        // Check for Data Analyst actor
        const analyst = simulation.objects.find(o => 
            o.type === 'actor' && 
            (o.name.includes('Data Analyst') || o.properties?.role.includes('Data Analyst'))
        );
        
        // Check for Server Capacity resource
        const serverCapacity = simulation.objects.find(o => 
            o.name && o.name.includes('Server Capacity')
        );
        
        // Check for data processing task
        const dataTask = simulation.tasks.find(t => 
            t.id && t.id.includes('data_processing')
        );
        
        return analyst && serverCapacity && dataTask;
    },

    /**
     * Emergency room capstone validation - complex multi-criteria check
     * Used in: Step 7
     */
    validateEmergencyRoomCapstone: function(simulation) {
        if (!simulation || !simulation.tasks || !simulation.objects) return false;
        
        // Check 1: No scheduling overlaps for Dr. Chen (triage appointments)
        const chenTasks = simulation.tasks.filter(t => t.actor_id === 'dr_chen').sort((a, b) => this.parseTime(a.start) - this.parseTime(b.start));
        for (let i = 0; i < chenTasks.length - 1; i++) {
            const task1 = chenTasks[i];
            const task2 = chenTasks[i + 1];
            
            const start1 = this.parseTime(task1.start);
            const end1 = start1 + (task1.duration || 0);
            const start2 = this.parseTime(task2.start);
            
            if (start2 < end1) return false; // Overlap detected
        }
        
        // Check 2: MRI machine state is ready
        const mriMachine = simulation.objects.find(o => o.id === 'mri_machine');
        if (!mriMachine || mriMachine.properties?.state !== 'ready') {
            return false;
        }
        
        // Check 3: Sufficient blood units for surgery (need at least 3)
        const bloodUnits = simulation.objects.find(o => o.id === 'blood_units');
        if (!bloodUnits || bloodUnits.properties?.quantity < 3) {
            return false;
        }
        
        // Check 4: Sufficient contrast dye for MRI (need at least 2)
        const contrastDye = simulation.objects.find(o => o.id === 'contrast_dye');
        if (!contrastDye || contrastDye.properties?.quantity < 2) {
            return false;
        }
        
        return true;
    },

    /**
     * Checks that the assistant's two tasks no longer overlap - updated for timeline mastery
     * Used in: Step 3 
     */
    validateNoAssistantOverlap: function(simulation) {
        if (!simulation || !simulation.tasks) return false;
        
        const spillsTask = simulation.tasks.find(t => t.id.includes('clean_up_spills'));
        const ovenTask = simulation.tasks.find(t => t.id.includes('preheat_oven'));

        if (!spillsTask || !ovenTask) return false;

        const spillsStart = this.parseTime(spillsTask.start);
        const spillsEnd = spillsStart + (spillsTask.duration || 0);
        const ovenStart = this.parseTime(ovenTask.start);

        return ovenStart >= spillsEnd;
    },

    /**
     * Helper function to parse time in HH:MM format to minutes
     */
    parseTime: function(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    },

};