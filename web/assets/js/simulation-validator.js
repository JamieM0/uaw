/**
 * Universal Automation Wiki - Simulation Validator
 * Version: 2.0.0 (Universal Object Model Compliant)
 */
class SimulationValidator {
  constructor(simulationData) {
    this.simulation = simulationData ? simulationData.simulation : null;
    this.results = [];
  }

  runChecks(metricsCatalog) {
    this.results = [];
    if (!this.simulation) {
      this.addResult({ metricId: 'schema.integrity.missing_root', status: 'error', message: "The root 'simulation' object is missing." });
      return this.results;
    }
    
    const computationalMetrics = metricsCatalog.filter(m => m.validation_type === 'computational');
    for (const metric of computationalMetrics) {
      const funcName = metric.computation.function_name;
      if (typeof this[funcName] === 'function') {
        try { this[funcName](metric); } 
        catch (e) { this.addResult({ metricId: metric.id, status: 'error', message: `Execution Error in ${funcName}: ${e.message}` }); }
      } else {
        this.addResult({ metricId: metric.id, status: 'error', message: `Internal Error: Validation function '${funcName}' not implemented.` });
      }
    }
    return this.results;
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
    const resources = (this.simulation.objects || []).filter(o => o.type === 'resource_pile' || o.type === 'product');
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
        if (obj && (obj.type === 'resource_pile' || obj.type === 'product')) {
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
    // Correctly get actors from the new 'objects' array
    const actors = (this.simulation.objects || []).filter(o => o.type === 'actor');
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
    const actors = (this.simulation.objects || []).filter(o => o.type === 'actor');
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
    const actorIds = new Set((this.simulation.objects || []).filter(o => o.type === 'actor').map(a => a.id));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
      if (!task.actor_id) {
        this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' is missing an 'actor_id'.` });
        issueFound = true;
      } else if (!actorIds.has(task.actor_id)) {
        this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' is assigned to an undefined actor: '${task.actor_id}'.` });
        issueFound = true;
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'All tasks are assigned to valid actors.' }); }
  }
  
  validateUnusedResources(metric) {
    const definedResources = new Set((this.simulation.objects || []).filter(o => o.type === 'resource_pile' || o.type === 'product').map(r => r.id));
    const tasks = this.simulation.tasks || [];

    for (const task of tasks) {
      // Handle old-style consumes/produces
      Object.keys(task.consumes || {}).forEach(resId => definedResources.delete(resId));
      Object.keys(task.produces || {}).forEach(resId => definedResources.delete(resId));
      
      // Handle new-style interactions
      for (const interaction of (task.interactions || [])) {
        const obj = resources.find(r => r.id === interaction.object_id);
        if (obj && (obj.type === 'resource_pile' || obj.type === 'product')) {
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
    const actors = (this.simulation.objects || []).filter(o => o.type === 'actor');
    const resources = (this.simulation.objects || []).filter(o => o.type === 'resource_pile' || o.type === 'product');
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
        if (obj && (obj.type === 'resource_pile' || obj.type === 'product')) {
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
}