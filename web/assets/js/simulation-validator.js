/**
 * Universal Automation Wiki - Simulation Validator
 * Version: 2.0.0 (Universal Object Model Compliant)
 */
class SimulationValidator {
  constructor(simulationData) {
    this.simulationData = simulationData;  // Store full data
    this.simulation = simulationData ? simulationData.simulation : null;
    this.results = [];
  }

  runChecks(metricsCatalog, customValidatorCode = null) {
    this.results = [];
    if (!this.simulation) {
      this.addResult({ metricId: 'schema.integrity.missing_root', status: 'error', message: "The root 'simulation' object is missing." });
      return this.results;
    }
    
    const computationalMetrics = metricsCatalog.filter(m => m.validation_type === 'computational');
    for (const metric of computationalMetrics) {
      const funcName = metric.computation?.function_name || metric.function;
      
      // Handle built-in validation functions
      if (typeof this[funcName] === 'function') {
        try { this[funcName](metric); } 
        catch (e) { this.addResult({ metricId: metric.id, status: 'error', message: `Execution Error in ${funcName}: ${e.message}` }); }
      }
      // Handle custom validation functions
      else if (metric.source === 'custom' && customValidatorCode) {
        try {
          this.executeCustomValidation(metric, customValidatorCode);
        } catch (e) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Custom validation error in ${funcName}: ${e.message}` });
        }
      } else {
        this.addResult({ metricId: metric.id, status: 'error', message: `Internal Error: Validation function '${funcName}' not implemented.` });
      }
    }
    return this.results;
  }
  
  executeCustomValidation(metric, customValidatorCode) {
    const funcName = metric.function;
    
    // Create a sandboxed context for custom validation
    const sandbox = {
      simulation: JSON.parse(JSON.stringify(this.simulation)), // Deep copy for safety
      addResult: (result) => this.addResult(result),
      console: { 
        log: (...args) => console.log('[Custom Validator]', ...args), 
        warn: (...args) => console.warn('[Custom Validator]', ...args), 
        error: (...args) => console.error('[Custom Validator]', ...args) 
      }, // Allow console but prefix with identifier
      // Utility functions that custom validators can use
      _timeToMinutes: this._timeToMinutes.bind(this),
      // Prevent access to dangerous globals
      window: undefined,
      document: undefined,
      localStorage: undefined,
      sessionStorage: undefined,
      fetch: undefined,
      XMLHttpRequest: undefined,
      eval: undefined,
      Function: undefined
    };
    
    let timeoutId;
    
    try {
      // Enhanced timeout protection with proper cleanup
      let hasTimedOut = false;
      timeoutId = setTimeout(() => {
        hasTimedOut = true;
      }, 5000);
      
      // Create function in sandboxed context without 'with' statement (strict mode compatible)
      const func = new Function('sandbox', 'metric', `
        try {
          // Destructure sandbox properties for direct access
          const { simulation, addResult, console, _timeToMinutes } = sandbox;
          
          ${customValidatorCode}
          if (typeof ${funcName} === 'function') {
            return ${funcName}.call(sandbox, metric);
          } else {
            // Get available function names from the custom code
            const funcRegex = /function\\s+(\\w+)\\s*\\(/g;
            const matches = [];
            let match;
            while ((match = funcRegex.exec(\`\${customValidatorCode}\`)) !== null) {
              matches.push(match[1]);
            }
            throw new Error('Function "${funcName}" not found in custom validator code. Available functions: ' + matches.join(', '));
          }
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error('Syntax error in custom validator: ' + error.message);
          } else if (error instanceof ReferenceError) {
            throw new Error('Reference error in custom validator: ' + error.message + '. Check that all variables and functions are properly defined.');
          } else if (error instanceof TypeError) {
            throw new Error('Type error in custom validator: ' + error.message + '. Check that you are calling methods on the correct object types.');
          } else {
            throw error;
          }
        }
      `);
      
      // Execute with enhanced error handling
      const result = func(sandbox, metric);
      
      // Check for timeout after execution
      if (hasTimedOut) {
        throw new Error('Custom validation function exceeded 5 second time limit');
      }
      
      clearTimeout(timeoutId);
      
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      
      // Enhanced error messages based on error type
      let errorMessage = error.message;
      let errorStatus = 'error';
      
      if (error.message.includes('timeout') || error.message.includes('time limit')) {
        errorMessage = `Validation timeout: Function "${funcName}" took longer than 5 seconds to execute. Consider optimizing your validation logic.`;
      } else if (error.message.includes('Syntax error')) {
        errorMessage = `Syntax error in "${funcName}": ${error.message}. Check your JavaScript syntax in the validator editor.`;
      } else if (error.message.includes('not found')) {
        errorMessage = `Function "${funcName}" not found. Make sure the function is defined in your validator code with the exact same name.`;
      } else if (error.message.includes('Reference error')) {
        errorMessage = `Reference error in "${funcName}": ${error.message}`;
      } else {
        errorMessage = `Error in custom validation "${funcName}": ${error.message}`;
      }
      
      this.addResult({ 
        metricId: metric.id, 
        status: errorStatus, 
        message: errorMessage 
      });
    }
  }

  addResult(result) { this.results.push(result); }

  _timeToMinutes(timeStr) {
    if (typeof timeStr !== 'string' || !timeStr.match(/^\d{2}:\d{2}$/)) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // --- REFACTORED VALIDATION FUNCTIONS (Universal Object Model) ---

  validateRootObject(metric) {
    this.addResult({ metricId: metric.id, status: 'success', message: 'Root "simulation" object is present.' });
  }

  validateNegativeStock(metric) {
    const resources = (this.simulation.objects || []).filter(o => o.type === 'resource' || o.type === 'product');
    const tasks = this.simulation.tasks || [];
    let issueFound = false;
    const stocks = {};
    resources.forEach(r => { stocks[r.id] = r.properties?.quantity || 0; });

    const sortedTasks = [...tasks].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));

    for (const task of sortedTasks) {
      // Handle old-style consumes/produces
      Object.entries(task.consumes || {}).forEach(([resId, amount]) => {
        if (stocks[resId] === undefined) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' consumes undefined resource '${resId}'.` });
          issueFound = true; return;
        }
        stocks[resId] -= amount;
        if (stocks[resId] < -0.0001) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Resource '${resId}' stock became negative (${stocks[resId].toFixed(2)}) after task '${task.id}'.` });
          issueFound = true;
        }
      });
      Object.entries(task.produces || {}).forEach(([resId, amount]) => {
        if (stocks[resId] === undefined) stocks[resId] = 0; // Allows creation of new products
        stocks[resId] += amount;
      });
      
      // Handle new-style interactions that modify resource quantities
      for (const interaction of (task.interactions || [])) {
        const obj = resources.find(r => r.id === interaction.object_id);
        if (obj && (obj.type === 'resource' || obj.type === 'product')) {
          const quantityChanges = interaction.property_changes?.quantity;
          if (quantityChanges) {
            const deltaAmount = quantityChanges.delta || 0;
            if (stocks[obj.id] === undefined) {
              if (deltaAmount < 0) {
                this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' tries to reduce undefined resource '${obj.id}'.` });
                issueFound = true; 
                continue;
              }
              stocks[obj.id] = 0;
            }
            stocks[obj.id] += deltaAmount;
            if (stocks[obj.id] < -0.0001) {
              this.addResult({ metricId: metric.id, status: 'error', message: `Resource '${obj.id}' stock became negative (${stocks[obj.id].toFixed(2)}) after task '${task.id}'.` });
              issueFound = true;
            }
          }
        }
      }
    }

    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'Resource levels remained positive.' }); }
  }

  validateEquipmentState(metric) {
    const equipment = (this.simulation.objects || []).filter(o => o.type === 'equipment');
    const equipmentMap = new Map(equipment.map(e => [e.id, e]));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const [eqId, equipmentDef] of equipmentMap.entries()) {
      const capacity = equipmentDef.properties?.capacity || 1;
      
      // Support both old equipment_interactions and new interactions
      const relevantTasks = tasks
        .filter(t => {
          // Check for old-style equipment_interactions
          const hasOldStyle = (t.equipment_interactions || []).some(i => i.id === eqId);
          // Check for new-style interactions targeting this equipment
          const hasNewStyle = (t.interactions || []).some(i => i.object_id === eqId);
          return hasOldStyle || hasNewStyle;
        })
        .map(t => ({ ...t, startMinutes: this._timeToMinutes(t.start), endMinutes: this._timeToMinutes(t.start) + (t.duration || 0) }))
        .sort((a, b) => a.startMinutes - b.startMinutes);

      if (relevantTasks.length === 0) continue;
      
      for (let i = 0; i < relevantTasks.length; i++) {
        const currentTask = relevantTasks[i];
        
        // Get interaction for this equipment (try both old and new style)
        let interaction = (currentTask.equipment_interactions || []).find(i => i.id === eqId);
        let isNewStyle = false;
        
        if (!interaction) {
          // Look for new-style interactions
          const newInteraction = (currentTask.interactions || []).find(i => i.object_id === eqId);
          if (newInteraction) {
            // Convert new-style to old-style format for backward compatibility
            const stateChanges = newInteraction.property_changes?.state;
            if (stateChanges) {
              interaction = {
                id: eqId,
                from_state: stateChanges.from,
                to_state: stateChanges.to,
                revert_after: newInteraction.revert_after || false
              };
              isNewStyle = true;
            }
          }
        }
        
        if (!interaction) continue;
        
        let stateAtTaskStart = equipmentDef.properties?.state || 'available';
        for (let j = 0; j < i; j++) {
            const priorTask = relevantTasks[j];
            let priorInteraction = (priorTask.equipment_interactions || []).find(i => i.id === eqId);
            
            if (!priorInteraction) {
              // Handle new-style interactions for prior tasks too
              const newPriorInteraction = (priorTask.interactions || []).find(i => i.object_id === eqId);
              if (newPriorInteraction) {
                const stateChanges = newPriorInteraction.property_changes?.state;
                if (stateChanges) {
                  priorInteraction = {
                    id: eqId,
                    from_state: stateChanges.from,
                    to_state: stateChanges.to,
                    revert_after: newPriorInteraction.revert_after || false
                  };
                }
              }
            }
            
            if (priorInteraction) {
              if (priorTask.endMinutes <= currentTask.startMinutes) {
                  stateAtTaskStart = priorInteraction.revert_after === true ? priorInteraction.from_state : priorInteraction.to_state;
              } else {
                  stateAtTaskStart = priorInteraction.to_state;
              }
            }
        }
        
        if (stateAtTaskStart !== interaction.from_state) {
          this.addResult({ metricId: metric.id, status: 'error', message: `State Logic Error: Task '${currentTask.id}' requires '${eqId}' to be in state '${interaction.from_state}', but it was '${stateAtTaskStart}'.` });
          issueFound = true;
        }

        let concurrentUsage = 1;
        for (let j = 0; j < i; j++) {
          if (relevantTasks[j].endMinutes > currentTask.startMinutes) concurrentUsage++;
        }
        if (concurrentUsage > capacity) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Capacity Exceeded: Equipment '${eqId}' (capacity: ${capacity}) is used by ${concurrentUsage} tasks at ${currentTask.start}.`});
          issueFound = true;
        }
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'Equipment states and capacity are logical.' }); }
  }

  validateActorOverlap(metric) {
    // Phase 4: Extended Actors - Check overlap for all objects that can act as actors
    const actors = (this.simulation.objects || []);
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const actor of actors) {
      const actorTasks = tasks
        .filter(t => t.actor_id === actor.id)
        .sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));

      for (let i = 0; i < actorTasks.length - 1; i++) {
        const currentTask = actorTasks[i];
        const nextTask = actorTasks[i + 1];

        const currentStart = this._timeToMinutes(currentTask.start);
        const nextStart = this._timeToMinutes(nextTask.start);

        if (currentStart === null || nextStart === null) continue;

        const currentEnd = currentStart + (currentTask.duration || 0);

        if (currentEnd > nextTask.start) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Actor '${actor.id}' has an overlap between task '${currentTask.id}' (ends at ${Math.floor(currentEnd/60)}:${String(currentEnd%60).padStart(2,'0')}) and task '${nextTask.id}' (starts at ${nextTask.start}).`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'No actor scheduling conflicts found.' });
    }
  }

  validateDependencyTiming(metric) {
    const tasks = this.simulation.tasks || [];
    const taskMap = new Map(tasks.map(task => [task.id, task]));
    let issueFound = false;
    for (const task of tasks) {
      const taskStart = this._timeToMinutes(task.start);
      if (taskStart === null) continue;
      for (const depId of (task.depends_on || [])) {
        const depTask = taskMap.get(depId);
        if (!depTask) continue; // Handled by unreachable dependency check
        const depStart = this._timeToMinutes(depTask.start);
        if (depStart === null) continue;
        const depEnd = depStart + (depTask.duration || 0);
        if (taskStart < depEnd) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Timing violation: Task '${task.id}' (starts ${task.start}) begins before its dependency '${depTask.id}' finishes.` });
          issueFound = true;
        }
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'All task dependencies are temporally respected.' }); }
  }

  validateRecipeCompliance(metric) {
    const recipes = this.simulation.production_recipes || {};
    const tasks = this.simulation.tasks || [];
    let issueFound = false;
    if (Object.keys(recipes).length === 0) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'No production recipes defined; check skipped.' });
      return;
    }
    for (const task of tasks) {
      // Collect all consumed items (old and new style)
      const consumedItems = new Set(Object.keys(task.consumes || {}));
      for (const interaction of (task.interactions || [])) {
        const quantityChanges = interaction.property_changes?.quantity;
        if (quantityChanges && quantityChanges.delta < 0) {
          consumedItems.add(interaction.object_id);
        }
      }
      
      // Check produced items (old style)
      for (const producedItem in (task.produces || {})) {
        if (recipes[producedItem]) {
          const requiredIngredients = new Set(recipes[producedItem].consumes || []);
          const missingIngredients = [];
          for (const required of requiredIngredients) {
            if (!consumedItems.has(required)) missingIngredients.push(required);
          }
          if (missingIngredients.length > 0) {
            this.addResult({ metricId: metric.id, status: 'warning', message: `Recipe Violation: Task '${task.id}' produces '${producedItem}' but is missing required ingredient(s): ${missingIngredients.join(', ')}.` });
            issueFound = true;
          }
        }
      }
      
      // Check produced items (new style)
      for (const interaction of (task.interactions || [])) {
        const quantityChanges = interaction.property_changes?.quantity;
        if (quantityChanges && quantityChanges.delta > 0) {
          const producedItem = interaction.object_id;
          if (recipes[producedItem]) {
            const requiredIngredients = new Set(recipes[producedItem].consumes || []);
            const missingIngredients = [];
            for (const required of requiredIngredients) {
              if (!consumedItems.has(required)) missingIngredients.push(required);
            }
            if (missingIngredients.length > 0) {
              this.addResult({ metricId: metric.id, status: 'warning', message: `Recipe Violation: Task '${task.id}' produces '${producedItem}' but is missing required ingredient(s): ${missingIngredients.join(', ')}.` });
              issueFound = true;
            }
          }
        }
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'All tasks comply with defined production recipes.' }); }
  }

  validateMissingBufferTime(metric) {
    const minBuffer = metric.computation.params?.minimum_buffer_minutes || 5;
    // Phase 4: Extended Actors - Check buffer times for all objects that can act as actors
    const actors = (this.simulation.objects || []);
    const tasks = this.simulation.tasks || [];
    let issueFound = false;
    
    for (const actor of actors) {
        const schedule = tasks
            .filter(t => t.actor_id === actor.id)
            .sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));
        for (let i = 0; i < schedule.length - 1; i++) {
            const currentTask = schedule[i]; const nextTask = schedule[i+1];
            const currentEnd = this._timeToMinutes(currentTask.start) + (currentTask.duration || 0);
            const nextStart = this._timeToMinutes(nextTask.start);
            if (currentEnd === nextStart) {
                this.addResult({ metricId: metric.id, status: 'info', message: `Optimization: Consider a buffer between '${currentTask.id}' and '${nextTask.id}' for actor '${actor.id}'.` });
                issueFound = true;
            }
        }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'Schedules include sufficient buffer times.' }); }
  }

  validateUnassignedTasks(metric) {
    // Phase 4: Extended Actors - Accept any object as a potential actor
    const actorIds = new Set((this.simulation.objects || []).map(a => a.id));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
      if (!task.actor_id) {
        this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' is missing an 'actor_id'.` });
        issueFound = true;
      } else if (!actorIds.has(task.actor_id)) {
        this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' is assigned to an undefined object: '${task.actor_id}'.` });
        issueFound = true;
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'All tasks are assigned to valid objects (actors).' }); }
  }
  
  validateUnusedResources(metric) {
    const definedResources = new Set((this.simulation.objects || []).filter(o => o.type === 'resource' || o.type === 'product').map(r => r.id));
    const tasks = this.simulation.tasks || [];

    for (const task of tasks) {
      // Handle old-style consumes/produces
      Object.keys(task.consumes || {}).forEach(resId => definedResources.delete(resId));
      Object.keys(task.produces || {}).forEach(resId => definedResources.delete(resId));
      
      // Handle new-style interactions
      for (const interaction of (task.interactions || [])) {
        const obj = resources.find(r => r.id === interaction.object_id);
        if (obj && (obj.type === 'resource' || obj.type === 'product')) {
          if (interaction.property_changes?.quantity) {
            definedResources.delete(obj.id);
          }
        }
      }
    }

    if (definedResources.size > 0) {
      this.addResult({ metricId: metric.id, status: 'info', message: `Optimization: The following resources are defined but never used: ${Array.from(definedResources).join(', ')}.` });
    } else {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All defined resources are utilized.' });
    }
  }

  validateUnreachableDependencies(metric) {
    const tasks = this.simulation.tasks || [];
    const taskIds = new Set(tasks.map(t => t.id));
    let issueFound = false;
    for (const task of tasks) {
      for (const depId of (task.depends_on || [])) {
        if (!taskIds.has(depId)) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' has an unreachable dependency on a non-existent task: '${depId}'.` });
          issueFound = true;
        }
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'All task dependencies are reachable.' }); }
  }

  validateProfitability(metric) {
    // For profitability, we still focus on traditional actors for labor cost calculation
    const actors = (this.simulation.objects || []).filter(o => o.type === 'actor');
    const resources = (this.simulation.objects || []).filter(o => o.type === 'resource' || o.type === 'product');
    const tasks = this.simulation.tasks || [];
    const finalProductIds = metric.computation.params?.final_product_ids || [];
    
    let totalLaborCost = 0;
    const actorCostMap = new Map(actors.map(a => [a.id, a.properties?.cost_per_hour || 0]));
    for (const task of tasks) {
      const costPerHour = actorCostMap.get(task.actor_id) || 0;
      const durationHours = (task.duration || 0) / 60;
      totalLaborCost += costPerHour * durationHours;
    }

    let totalResourceCost = 0;
    let totalRevenue = 0;
    const resourceMap = new Map(resources.map(r => [r.id, r.properties]));
    
    for (const task of tasks) {
      // Handle old-style consumes/produces
      for (const [resId, amount] of Object.entries(task.consumes || {})) {
        totalResourceCost += (resourceMap.get(resId)?.cost_per_unit || 0) * amount;
      }
      for (const [resId, amount] of Object.entries(task.produces || {})) {
        if (finalProductIds.includes(resId)) {
            totalRevenue += (resourceMap.get(resId)?.revenue_per_unit || 0) * amount;
        }
      }
      
      // Handle new-style interactions
      for (const interaction of (task.interactions || [])) {
        const obj = resources.find(r => r.id === interaction.object_id);
        if (obj && (obj.type === 'resource' || obj.type === 'product')) {
          const quantityChanges = interaction.property_changes?.quantity;
          if (quantityChanges) {
            const deltaAmount = quantityChanges.delta || 0;
            if (deltaAmount < 0) {
              // Resource consumption (negative delta)
              totalResourceCost += (obj.properties?.cost_per_unit || 0) * Math.abs(deltaAmount);
            } else if (deltaAmount > 0) {
              // Resource production (positive delta)
              if (finalProductIds.includes(obj.id)) {
                totalRevenue += (obj.properties?.revenue_per_unit || 0) * deltaAmount;
              }
            }
          }
        }
      }
    }

    const totalCost = totalLaborCost + totalResourceCost;
    const profit = totalRevenue - totalCost;

    if (totalRevenue === 0 && totalCost === 0) { // Avoid false positives on empty/irrelevant simulations
        this.addResult({ metricId: metric.id, status: 'success', message: 'No economic data to analyze.' });
        return;
    }

    if (profit < 0) {
      this.addResult({ metricId: metric.id, status: 'warning', message: `Economic Warning: Simulation is unprofitable. Total Revenue: $${totalRevenue.toFixed(2)}, Total Costs: $${totalCost.toFixed(2)}, Loss: $${profit.toFixed(2)}.` });
    } else {
      this.addResult({ metricId: metric.id, status: 'success', message: `Simulation is profitable with a margin of $${profit.toFixed(2)}.` });
    }
  }

    // --- ADD THESE NEW FUNCTIONS ---

  validateObjectLocations(metric) {
    const locations = this.simulation.layout?.locations || [];
    const locationIds = new Set(locations.map(l => l.id));
    const objects = this.simulation.objects || [];
    let issueFound = false;

    for (const obj of objects) {
      const objLoc = obj.properties?.location;
      if (objLoc && !locationIds.has(objLoc)) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Object '${obj.id}' is assigned to an undefined location: '${objLoc}'.`
        });
        issueFound = true;
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All object locations are valid.' });
    }
  }

  validateTaskProximity(metric) {
    const objects = this.simulation.objects || [];
    const objectMap = new Map(objects.map(o => [o.id, o]));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
        if (!task.location) continue; // Skip tasks without a location

        // 1. Check the actor's location
        const actor = objectMap.get(task.actor_id);
        if (actor && actor.properties?.location !== task.location) {
            this.addResult({ metricId: metric.id, status: 'error', message: `Proximity Error: Actor '${actor.id}' must be in location '${task.location}' to perform task '${task.id}', but is in '${actor.properties.location}'.` });
            issueFound = true;
        }

        // 2. Check the location of all required equipment (support both old and new interaction styles)
        for (const interaction of (task.equipment_interactions || [])) {
            const equipment = objectMap.get(interaction.id);
            if (equipment && equipment.properties?.location !== task.location) {
                 this.addResult({ metricId: metric.id, status: 'error', message: `Proximity Error: Equipment '${equipment.id}' must be in location '${task.location}' for task '${task.id}', but is in '${equipment.properties.location}'.` });
                 issueFound = true;
            }
        }
        
        // Also check new-style interactions
        for (const interaction of (task.interactions || [])) {
            const obj = objectMap.get(interaction.object_id);
            if (obj && obj.type === 'equipment' && obj.properties?.location !== task.location) {
                 this.addResult({ metricId: metric.id, status: 'error', message: `Proximity Error: Equipment '${obj.id}' must be in location '${task.location}' for task '${task.id}', but is in '${obj.properties.location}'.` });
                 issueFound = true;
            }
        }
    }

    if (!issueFound) {
        this.addResult({ metricId: metric.id, status: 'success', message: 'All task proximity requirements are met.' });
    }
  }
  validateInteractions(metric) {
    const objects = this.simulation.objects || [];
    const objectMap = new Map(objects.map(o => [o.id, o]));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
      for (const interaction of (task.interactions || [])) {
        const targetObject = objectMap.get(interaction.object_id);
        if (!targetObject) {
          this.addResult({ 
            metricId: metric.id, 
            status: 'error', 
            message: `Task '${task.id}' has an interaction with undefined object '${interaction.object_id}'.` 
          });
          issueFound = true;
          continue;
        }

        // Validate property changes
        if (interaction.property_changes) {
          for (const [property, change] of Object.entries(interaction.property_changes)) {
            // Check if the property exists on the target object
            if (!targetObject.properties || !(property in targetObject.properties)) {
              if (!change.delta) { // Only warn if not using delta (which can create new properties)
                this.addResult({ 
                  metricId: metric.id, 
                  status: 'warning', 
                  message: `Task '${task.id}' tries to modify property '${property}' on object '${interaction.object_id}', but the property doesn't exist.` 
                });
              }
            }

            // Validate change structure
            if (change.from !== undefined && change.to !== undefined && change.delta !== undefined) {
              this.addResult({ 
                metricId: metric.id, 
                status: 'error', 
                message: `Task '${task.id}' has invalid property change for '${property}' on object '${interaction.object_id}': cannot specify both from/to and delta.` 
              });
              issueFound = true;
            }

            // Validate from/to changes
            if (change.from !== undefined && change.to !== undefined) {
              const currentValue = targetObject.properties?.[property];
              if (currentValue !== undefined && currentValue !== change.from) {
                this.addResult({ 
                  metricId: metric.id, 
                  status: 'warning', 
                  message: `Task '${task.id}' expects '${property}' on object '${interaction.object_id}' to be '${change.from}', but it is '${currentValue}'.` 
                });
              }
            }
          }
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All object interactions are valid.' });
    }
  }

  validateDisallowedTypes(metric) {
    const objects = this.simulation.objects || [];
    const disallowedTypes = metric.computation.params?.disallowed_types || [];
    let issueFound = false;

    for (const obj of objects) {
      if (disallowedTypes.includes(obj.type)) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Object '${obj.id}' uses disallowed type '${obj.type}'. This type is reserved for internal system use and may cause conflicts.`
        });
        issueFound = true;
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'No disallowed object types found.' });
    }
  }

  validateDisplayElementBounds(metric) {
    // Check multiple possible locations for displays
    let displays = [];
    
    // First try the root level of the full data (if available)
    if (this.simulationData && this.simulationData.displays) {
      displays = this.simulationData.displays;
    }
    // Then try inside simulation object
    else if (this.simulation.displays) {
      displays = this.simulation.displays;
    }
    // Then try display_space
    else if (this.simulation.display_space && this.simulation.display_space.displays) {
      displays = this.simulation.display_space.displays;
    }
    
    let issueFound = false;

    for (const display of displays) {
      const viewport = display.viewport || {};
      const viewportWidth = viewport.width || 0;
      const viewportHeight = viewport.height || 0;
      const elements = display.rectangles || [];

      for (const element of elements) {
        const bounds = element.bounds || {};
        const elementLeft = bounds.x || 0;
        const elementTop = bounds.y || 0;
        const elementWidth = bounds.width || 0;
        const elementHeight = bounds.height || 0;


        // Check if element extends beyond viewport bounds
        const elementRight = elementLeft + elementWidth;
        const elementBottom = elementTop + elementHeight;


        if (elementLeft < 0 || elementTop < 0 || 
            elementRight > viewportWidth || elementBottom > viewportHeight) {
          this.addResult({
            metricId: metric.id,
            status: 'warning',
            message: `Display element '${element.id || 'unnamed'}' in display '${display.id || 'unnamed'}' extends outside viewport bounds. Element bounds: (${elementLeft}, ${elementTop}, ${elementWidth}×${elementHeight}), Viewport: ${viewportWidth}×${viewportHeight}.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All display elements are within viewport bounds.' });
    }
  }

  validateTaskDuration(metric) {
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
      const duration = task.duration;
      
      // Check if duration exists and is valid
      if (duration === undefined || duration === null) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' is missing a duration value.`
        });
        issueFound = true;
      } else if (typeof duration === 'string') {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' has invalid duration '${duration}' - duration must be a number, not a string.`
        });
        issueFound = true;
      } else if (typeof duration !== 'number') {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' has invalid duration '${duration}' - duration must be a number.`
        });
        issueFound = true;
      } else if (!Number.isInteger(duration)) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' has invalid duration '${duration}' - duration must be an integer.`
        });
        issueFound = true;
      } else if (duration <= 0) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' has invalid duration '${duration}' - duration must be positive.`
        });
        issueFound = true;
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All task durations are valid positive integers.' });
    }
  }

  validateStartTimeFormat(metric) {
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
      const startTime = task.start;
      
      // Check if start time exists and is valid
      if (startTime === undefined || startTime === null) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' is missing a start time value.`
        });
        issueFound = true;
      } else if (typeof startTime !== 'string') {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' has invalid start time '${startTime}' - start time must be a string in HH:MM format.`
        });
        issueFound = true;
      } else if (!startTime.match(/^\d{2}:\d{2}$/)) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' has invalid start time format '${startTime}' - must be in HH:MM format (e.g., "09:30").`
        });
        issueFound = true;
      } else {
        // Additional check for valid time values
        const [hours, minutes] = startTime.split(':').map(Number);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Task '${task.id}' has invalid start time '${startTime}' - hours must be 00-23 and minutes must be 00-59.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All task start times are in valid HH:MM format.' });
    }
  }

  validateObjectReferences(metric) {
    const objects = this.simulation.objects || [];
    const objectIds = new Set(objects.map(o => o.id));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
      // Check actor_id reference
      if (task.actor_id !== undefined && task.actor_id !== null) {
        if (typeof task.actor_id !== 'string') {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Task '${task.id}' has invalid actor_id '${task.actor_id}' - actor_id must be a string.`
          });
          issueFound = true;
        } else if (!objectIds.has(task.actor_id)) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Task '${task.id}' references non-existent object '${task.actor_id}' as actor_id.`
          });
          issueFound = true;
        }
      }

      // Check interactions object_id references
      for (const interaction of (task.interactions || [])) {
        if (interaction.object_id !== undefined && interaction.object_id !== null) {
          if (typeof interaction.object_id !== 'string') {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Task '${task.id}' has interaction with invalid object_id '${interaction.object_id}' - object_id must be a string.`
            });
            issueFound = true;
          } else if (!objectIds.has(interaction.object_id)) {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Task '${task.id}' has interaction with non-existent object '${interaction.object_id}'.`
            });
            issueFound = true;
          }
        }
      }

      // Check equipment_interactions id references (legacy support)
      for (const interaction of (task.equipment_interactions || [])) {
        if (interaction.id !== undefined && interaction.id !== null) {
          if (typeof interaction.id !== 'string') {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Task '${task.id}' has equipment interaction with invalid id '${interaction.id}' - id must be a string.`
            });
            issueFound = true;
          } else if (!objectIds.has(interaction.id)) {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Task '${task.id}' has equipment interaction with non-existent object '${interaction.id}'.`
            });
            issueFound = true;
          }
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All task object references are valid strings pointing to existing objects.' });
    }
  }

  validateTaskIds(metric) {
    const tasks = this.simulation.tasks || [];
    const taskIds = new Set();
    let issueFound = false;

    for (const task of tasks) {
      // Check if task ID is missing, null, or empty
      if (task.id === undefined || task.id === null || task.id === '') {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task has missing, null, or empty ID. Task data: ${JSON.stringify(task, null, 2).substring(0, 200)}...`
        });
        issueFound = true;
        continue;
      }

      // Check if task ID is not a string
      if (typeof task.id !== 'string') {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task ID '${task.id}' is not a string. Task IDs must be strings.`
        });
        issueFound = true;
        continue;
      }

      // Check for duplicate task IDs
      if (taskIds.has(task.id)) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Duplicate task ID found: '${task.id}'. All task IDs must be unique.`
        });
        issueFound = true;
      } else {
        taskIds.add(task.id);
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All task IDs are valid, unique, non-empty strings.' });
    }
  }

  validateObjectIds(metric) {
    const objects = this.simulation.objects || [];
    const objectIds = new Set();
    let issueFound = false;

    for (const obj of objects) {
      // Check if object ID is missing, null, or empty
      if (obj.id === undefined || obj.id === null || obj.id === '') {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Object has missing, null, or empty ID. Object data: ${JSON.stringify(obj, null, 2).substring(0, 200)}...`
        });
        issueFound = true;
        continue;
      }

      // Check if object ID is not a string
      if (typeof obj.id !== 'string') {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Object ID '${obj.id}' is not a string. Object IDs must be strings.`
        });
        issueFound = true;
        continue;
      }

      // Check for duplicate object IDs
      if (objectIds.has(obj.id)) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Duplicate object ID found: '${obj.id}'. All object IDs must be unique.`
        });
        issueFound = true;
      } else {
        objectIds.add(obj.id);
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All object IDs are valid, unique, non-empty strings.' });
    }
  }

  validateRequiredProperties(metric) {
    const objects = this.simulation.objects || [];
    let issueFound = false;

    // Define required properties for each object type
    const requiredPropertiesByType = {
      'actor': ['name'],
      'resource': ['quantity'],
      'product': ['quantity'],
      'equipment': ['state'],
      'location': ['name'],
      'tool': ['name'],
      'material': ['quantity'],
      'ingredient': ['quantity']
    };

    for (const obj of objects) {
      const objType = obj.type;
      const requiredProps = requiredPropertiesByType[objType];

      // Skip validation if no required properties defined for this type
      if (!requiredProps) {
        continue;
      }

      // Check if properties object exists
      if (!obj.properties || typeof obj.properties !== 'object') {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Object '${obj.id}' of type '${objType}' is missing the properties object.`
        });
        issueFound = true;
        continue;
      }

      // Check each required property
      for (const requiredProp of requiredProps) {
        // Check if property exists at root level or in properties object
        const hasPropertyAtRoot = requiredProp in obj && obj[requiredProp] !== undefined && obj[requiredProp] !== null;
        const hasPropertyInProperties = obj.properties && requiredProp in obj.properties && obj.properties[requiredProp] !== undefined && obj.properties[requiredProp] !== null;

        if (!hasPropertyAtRoot && !hasPropertyInProperties) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Object '${obj.id}' of type '${objType}' is missing required property '${requiredProp}'.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All objects have their required properties defined.' });
    }
  }

  validatePropertyTypes(metric) {
    const objects = this.simulation.objects || [];
    let issueFound = false;

    // Define expected property types for each object type
    const expectedPropertyTypes = {
      'actor': {
        'name': 'string',
        'cost_per_hour': 'number',
        'location': 'string',
        'skill_level': 'number'
      },
      'resource': {
        'quantity': 'number',
        'cost_per_unit': 'number',
        'location': 'string',
        'name': 'string'
      },
      'product': {
        'quantity': 'number',
        'revenue_per_unit': 'number',
        'cost_per_unit': 'number',
        'location': 'string',
        'name': 'string'
      },
      'equipment': {
        'state': 'string',
        'capacity': 'number',
        'location': 'string',
        'name': 'string'
      },
      'location': {
        'name': 'string',
        'x': 'number',
        'y': 'number',
        'width': 'number',
        'height': 'number'
      },
      'tool': {
        'name': 'string',
        'location': 'string',
        'condition': 'string'
      },
      'material': {
        'quantity': 'number',
        'cost_per_unit': 'number',
        'location': 'string',
        'name': 'string'
      },
      'ingredient': {
        'quantity': 'number',
        'cost_per_unit': 'number',
        'location': 'string',
        'name': 'string'
      }
    };

    for (const obj of objects) {
      const objType = obj.type;
      const expectedTypes = expectedPropertyTypes[objType];

      // Skip validation if no type definitions for this object type
      if (!expectedTypes || !obj.properties) {
        continue;
      }

      // Check each property that exists on the object
      for (const [propName, propValue] of Object.entries(obj.properties)) {
        const expectedType = expectedTypes[propName];

        // Skip if no expected type defined for this property
        if (!expectedType) {
          continue;
        }

        // Skip null/undefined values (handled by required properties check)
        if (propValue === null || propValue === undefined) {
          continue;
        }

        const actualType = typeof propValue;

        if (actualType !== expectedType) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Object '${obj.id}' of type '${objType}' has invalid type for property '${propName}'. Expected ${expectedType}, but got ${actualType}. Value: '${propValue}'`
          });
          issueFound = true;
        }

        // Additional validation for numbers (check for NaN)
        if (expectedType === 'number' && actualType === 'number' && isNaN(propValue)) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Object '${obj.id}' of type '${objType}' has NaN value for numeric property '${propName}'.`
          });
          issueFound = true;
        }

        // Additional validation for strings (check for empty strings where meaningful)
        if (expectedType === 'string' && actualType === 'string' && propName === 'name' && propValue.trim() === '') {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Object '${obj.id}' of type '${objType}' has empty string for name property.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All object properties have valid data types.' });
    }
  }

  validateTaskEndTimeOverflow(metric) {
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
      const startTime = task.start;
      const duration = task.duration;

      // Skip if start time or duration is invalid (handled by other validations)
      if (!startTime || !duration || typeof startTime !== 'string' || typeof duration !== 'number') {
        continue;
      }

      const startMinutes = this._timeToMinutes(startTime);
      if (startMinutes === null) continue;

      const endMinutes = startMinutes + duration;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;

      // Check if task extends beyond 24:00 (1440 minutes)
      if (endMinutes >= 1440) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' ends at ${endHours}:${String(endMins).padStart(2, '0')}, which exceeds 24:00 and causes day boundary overflow.`
        });
        issueFound = true;
      }

      // Check if task extends beyond reasonable working hours (e.g., past 23:59)
      if (endMinutes > 1439) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' has invalid end time calculation (${endHours}:${String(endMins).padStart(2, '0')}).`
        });
        issueFound = true;
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All task end times are within valid daily boundaries.' });
    }
  }

  validateCircularDependencies(metric) {
    const tasks = this.simulation.tasks || [];
    const taskMap = new Map(tasks.map(task => [task.id, task]));
    let issueFound = false;

    // Depth-first search to detect cycles
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (taskId, path = []) => {
      if (recursionStack.has(taskId)) {
        // Found a cycle - construct the cycle path
        const cycleStart = path.indexOf(taskId);
        const cyclePath = path.slice(cycleStart).concat([taskId]);
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Circular dependency detected: ${cyclePath.join(' → ')}`
        });
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = taskMap.get(taskId);
      if (task && task.depends_on) {
        for (const depId of task.depends_on) {
          if (taskMap.has(depId)) {
            if (hasCycle(depId, [...path, taskId])) {
              return true;
            }
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    // Check each task for cycles
    for (const task of tasks) {
      if (!visited.has(task.id)) {
        if (hasCycle(task.id)) {
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'No circular dependencies found in task dependency chains.' });
    }
  }

  validateSelfReferencingDependencies(metric) {
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
      if (task.depends_on && task.depends_on.includes(task.id)) {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Task '${task.id}' has a self-referencing dependency (depends on itself).`
        });
        issueFound = true;
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'No self-referencing dependencies found.' });
    }
  }

  validateMissingTaskDependencies(metric) {
    const tasks = this.simulation.tasks || [];
    const taskIds = new Set(tasks.map(t => t.id));
    let issueFound = false;

    for (const task of tasks) {
      if (task.depends_on) {
        for (const depId of task.depends_on) {
          if (!taskIds.has(depId)) {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Task '${task.id}' depends on non-existent task '${depId}'.`
            });
            issueFound = true;
          }
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All task dependencies reference existing tasks.' });
    }
  }

  validateResourceQuantities(metric) {
    const objects = this.simulation.objects || [];
    const resources = objects.filter(o => o.type === 'resource' || o.type === 'product' || o.type === 'material' || o.type === 'ingredient');
    let issueFound = false;

    for (const resource of resources) {
      const quantity = resource.properties?.quantity;

      if (quantity !== undefined && quantity !== null) {
        if (typeof quantity !== 'number') {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Resource '${resource.id}' has invalid quantity '${quantity}' - quantity must be a number.`
          });
          issueFound = true;
        } else if (quantity < 0) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Resource '${resource.id}' has negative quantity '${quantity}' - quantities must be non-negative.`
          });
          issueFound = true;
        } else if (isNaN(quantity)) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Resource '${resource.id}' has NaN quantity value.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All resource quantities are valid non-negative numbers.' });
    }
  }

  validateEquipmentCapacity(metric) {
    const objects = this.simulation.objects || [];
    const equipment = objects.filter(o => o.type === 'equipment');
    let issueFound = false;

    for (const eq of equipment) {
      const capacity = eq.properties?.capacity;

      if (capacity !== undefined && capacity !== null) {
        if (typeof capacity !== 'number') {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Equipment '${eq.id}' has invalid capacity '${capacity}' - capacity must be a number.`
          });
          issueFound = true;
        } else if (!Number.isInteger(capacity)) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Equipment '${eq.id}' has non-integer capacity '${capacity}' - capacity must be an integer.`
          });
          issueFound = true;
        } else if (capacity <= 0) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Equipment '${eq.id}' has invalid capacity '${capacity}' - capacity must be positive.`
          });
          issueFound = true;
        } else if (isNaN(capacity)) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Equipment '${eq.id}' has NaN capacity value.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All equipment capacity values are valid positive integers.' });
    }
  }

  validateStateTransitions(metric) {
    const objects = this.simulation.objects || [];
    const equipment = objects.filter(o => o.type === 'equipment');
    const equipmentMap = new Map(equipment.map(e => [e.id, e]));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    // Define valid state transitions
    const validTransitions = {
      'available': ['in_use', 'maintenance', 'dirty'],
      'in_use': ['available', 'dirty', 'maintenance', 'broken'],
      'dirty': ['cleaning', 'maintenance'],
      'cleaning': ['available'],
      'maintenance': ['available'],
      'broken': ['maintenance']
    };

    for (const [eqId, equipmentDef] of equipmentMap.entries()) {
      const initialState = equipmentDef.properties?.state || 'available';

      // Find all tasks that interact with this equipment
      const relevantTasks = tasks
        .filter(t => {
          const hasOldStyle = (t.equipment_interactions || []).some(i => i.id === eqId);
          const hasNewStyle = (t.interactions || []).some(i => i.object_id === eqId && i.property_changes?.state);
          return hasOldStyle || hasNewStyle;
        })
        .sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));

      let currentState = initialState;

      for (const task of relevantTasks) {
        // Get interaction for this equipment (try both old and new style)
        let interaction = (task.equipment_interactions || []).find(i => i.id === eqId);

        if (!interaction) {
          // Look for new-style interactions
          const newInteraction = (task.interactions || []).find(i => i.object_id === eqId);
          if (newInteraction && newInteraction.property_changes?.state) {
            const stateChanges = newInteraction.property_changes.state;
            interaction = {
              id: eqId,
              from_state: stateChanges.from,
              to_state: stateChanges.to,
              revert_after: newInteraction.revert_after || false
            };
          }
        }

        if (!interaction) continue;

        const fromState = interaction.from_state;
        const toState = interaction.to_state;

        // Check if the transition is valid
        if (fromState && toState) {
          const allowedNextStates = validTransitions[fromState];
          if (allowedNextStates && !allowedNextStates.includes(toState)) {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Invalid state transition for equipment '${eqId}' in task '${task.id}': cannot transition from '${fromState}' to '${toState}'. Valid transitions from '${fromState}': ${allowedNextStates.join(', ')}.`
            });
            issueFound = true;
          }

          // Check if the expected from_state matches current state
          if (currentState !== fromState) {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `State transition error for equipment '${eqId}' in task '${task.id}': expected state '${fromState}' but equipment is in state '${currentState}'.`
            });
            issueFound = true;
          }

          // Update current state for next iteration
          currentState = interaction.revert_after ? fromState : toState;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All equipment state transitions are logically valid.' });
    }
  }

  validateResourceTypeConsistency(metric) {
    const objects = this.simulation.objects || [];
    const objectMap = new Map(objects.map(o => [o.id, o]));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    // Track type of each object throughout the simulation
    const objectTypes = new Map();

    // Initialize with original types
    for (const obj of objects) {
      objectTypes.set(obj.id, obj.type);
    }

    // Check interactions for type consistency
    for (const task of tasks) {
      // Check old-style consumes/produces
      for (const resId of Object.keys(task.consumes || {})) {
        const originalObj = objectMap.get(resId);
        if (originalObj && !['resource', 'product', 'material', 'ingredient'].includes(originalObj.type)) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Task '${task.id}' tries to consume '${resId}' which is of type '${originalObj.type}', but only resources, products, materials, and ingredients can be consumed.`
          });
          issueFound = true;
        }
      }

      for (const resId of Object.keys(task.produces || {})) {
        const originalObj = objectMap.get(resId);
        if (originalObj && !['resource', 'product', 'material', 'ingredient'].includes(originalObj.type)) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Task '${task.id}' tries to produce '${resId}' which is of type '${originalObj.type}', but only resources, products, materials, and ingredients can be produced.`
          });
          issueFound = true;
        }
      }

      // Check new-style interactions
      for (const interaction of (task.interactions || [])) {
        const obj = objectMap.get(interaction.object_id);
        if (!obj) continue; // Handled by other validation

        const expectedType = objectTypes.get(interaction.object_id);
        if (!expectedType) continue;

        // Check if interaction is appropriate for object type
        if (interaction.property_changes?.quantity) {
          if (!['resource', 'product', 'material', 'ingredient'].includes(expectedType)) {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Task '${task.id}' tries to modify quantity of '${interaction.object_id}' which is of type '${expectedType}', but only resources, products, materials, and ingredients can have quantity modifications.`
            });
            issueFound = true;
          }
        }

        if (interaction.property_changes?.state) {
          if (!['equipment', 'tool'].includes(expectedType)) {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Task '${task.id}' tries to modify state of '${interaction.object_id}' which is of type '${expectedType}', but only equipment and tools can have state modifications.`
            });
            issueFound = true;
          }
        }

        // Check for type changes (objects shouldn't change types)
        if (interaction.property_changes?.type) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Task '${task.id}' tries to change the type of object '${interaction.object_id}' from '${expectedType}' to '${interaction.property_changes.type}'. Object types should remain consistent.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All resources maintain consistent types throughout interactions.' });
    }
  }
}

// Export to global scope for playground usage
window.SimulationValidator = SimulationValidator;