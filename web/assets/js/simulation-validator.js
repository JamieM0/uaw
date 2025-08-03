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
      
      const relevantTasks = tasks
        .filter(t => (t.equipment_interactions || []).some(i => i.id === eqId))
        .map(t => ({ ...t, startMinutes: this._timeToMinutes(t.start), endMinutes: this._timeToMinutes(t.start) + (t.duration || 0) }))
        .sort((a, b) => a.startMinutes - b.startMinutes);

      if (relevantTasks.length === 0) continue;
      
      for (let i = 0; i < relevantTasks.length; i++) {
        const currentTask = relevantTasks[i];
        const interaction = (currentTask.equipment_interactions || []).find(i => i.id === eqId);
        
        let stateAtTaskStart = equipmentDef.properties?.state || 'available';
        for (let j = 0; j < i; j++) {
            const priorTask = relevantTasks[j];
            const priorInteraction = (priorTask.equipment_interactions || []).find(i => i.id === eqId);
            if (priorTask.endMinutes <= currentTask.startMinutes) {
                stateAtTaskStart = priorInteraction.revert_after === true ? priorInteraction.from_state : priorInteraction.to_state;
            } else {
                stateAtTaskStart = priorInteraction.to_state;
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
      const consumedItems = new Set(Object.keys(task.consumes || {}));
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
      Object.keys(task.consumes || {}).forEach(resId => definedResources.delete(resId));
      Object.keys(task.produces || {}).forEach(resId => definedResources.delete(resId));
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
      for (const [resId, amount] of Object.entries(task.consumes || {})) {
        totalResourceCost += (resourceMap.get(resId)?.cost_per_unit || 0) * amount;
      }
      for (const [resId, amount] of Object.entries(task.produces || {})) {
        if (finalProductIds.includes(resId)) {
            totalRevenue += (resourceMap.get(resId)?.revenue_per_unit || 0) * amount;
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
}