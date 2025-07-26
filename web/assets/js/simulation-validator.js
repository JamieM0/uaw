/**
 * Universal Automation Wiki - Simulation Validator
 **/
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

  // --- IMPLEMENTATION OF VALIDATION FUNCTIONS ---

  validateRootObject(metric) {
    this.addResult({ metricId: metric.id, status: 'success', message: 'Root "simulation" object is present.' });
  }

  validateNegativeStock(metric) {
    const stock = {};
    const tasks = this.simulation.tasks || [];
    const resources = this.simulation.resources || [];
    let issueFound = false;
    resources.forEach(r => { stock[r.id] = r.starting_stock || 0; });
    const sortedTasks = [...tasks].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));
    for (const task of sortedTasks) {
      for (const [resource, amount] of Object.entries(task.consumes || {})) {
        if (stock[resource] === undefined) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' consumes undefined resource '${resource}'.` });
          issueFound = true; continue;
        }
        stock[resource] -= amount;
        if (stock[resource] < -0.0001) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Resource '${resource}' stock became negative (${stock[resource].toFixed(2)}) after task '${task.id}'.` });
          issueFound = true;
        }
      }
      for (const [resource, amount] of Object.entries(task.produces || {})) {
        if (stock[resource] === undefined) stock[resource] = 0;
        stock[resource] += amount;
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'Resource levels remained positive.' }); }
  }

  validateEquipmentState(metric) {
    const equipmentMap = new Map((this.simulation.equipment || []).map(e => [e.id, e]));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const [eqId, equipmentDef] of equipmentMap.entries()) {
      const capacity = equipmentDef.capacity || 1;
      
      const relevantTasks = tasks
        .filter(t => (t.equipment_interactions || []).some(i => i.id === eqId))
        .map(t => ({
          ...t,
          startMinutes: this._timeToMinutes(t.start),
          endMinutes: this._timeToMinutes(t.start) + (t.duration || 0)
        }))
        .sort((a, b) => a.startMinutes - b.startMinutes);

      if (relevantTasks.length === 0) continue;

      for (let i = 0; i < relevantTasks.length; i++) {
        const currentTask = relevantTasks[i];
        const interaction = (currentTask.equipment_interactions || []).find(i => i.id === eqId);

        // A. Determine the equipment's state just before this task begins.
        let stateAtTaskStart = equipmentDef.state || 'available';
        for (let j = 0; j < i; j++) {
            const priorTask = relevantTasks[j];
            const priorInteraction = (priorTask.equipment_interactions || []).find(i => i.id === eqId);
            // If the prior task finished before this one starts...
            if (priorTask.endMinutes <= currentTask.startMinutes) {
                //...and it reverts, its state change was temporary.
                stateAtTaskStart = priorInteraction.revert_after === true ? priorInteraction.from_state : priorInteraction.to_state;
            } else {
                //...otherwise, it's still 'in-use'.
                stateAtTaskStart = priorInteraction.to_state;
            }
        }
        
        // B. Check for prerequisite state violation.
        if (stateAtTaskStart !== interaction.from_state) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `State Logic Error: Task '${currentTask.id}' requires '${eqId}' to be in state '${interaction.from_state}', but it was in state '${stateAtTaskStart}'.`
          });
          issueFound = true;
        }

        // C. Check for capacity conflicts.
        let concurrentUsage = 1;
        for (let j = 0; j < i; j++) {
          const priorTask = relevantTasks[j];
          if (priorTask.endMinutes > currentTask.startMinutes) {
            concurrentUsage++;
          }
        }

        if (concurrentUsage > capacity) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Capacity Exceeded: Equipment '${eqId}' (capacity: ${capacity}) is used by ${concurrentUsage} tasks at ${currentTask.start}.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'Equipment states and capacity are logical.' });
    }
  }

  validateActorOverlap(metric) {
    const actorTasks = {};
    const tasks = this.simulation.tasks || [];
    let issueFound = false;
    tasks.forEach(task => {
      const actorId = task.actor_id;
      if (!actorId) return;
      if (!actorTasks[actorId]) actorTasks[actorId] = [];
      actorTasks[actorId].push(task);
    });
    for (const actorId in actorTasks) {
      const schedule = actorTasks[actorId].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));
      for (let i = 0; i < schedule.length - 1; i++) {
        const currentTask = schedule[i]; const nextTask = schedule[i + 1];
        const currentStart = this._timeToMinutes(currentTask.start);
        const nextStart = this._timeToMinutes(nextTask.start);
        if (currentStart === null || nextStart === null) continue;
        const currentEnd = currentStart + (currentTask.duration || 0);
        if (currentEnd > nextStart) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Actor '${actorId}' has an overlap between task '${currentTask.id}' (ends at ${Math.floor(currentEnd/60)}:${String(currentEnd%60).padStart(2,'0')}) and task '${nextTask.id}' (starts at ${nextTask.start}).` });
          issueFound = true;
        }
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'No actor scheduling conflicts found.' }); }
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
        if (!depTask) {
          this.addResult({ metricId: metric.id, status: 'warning', message: `Task '${task.id}' has an undefined dependency: '${depId}'.` });
          issueFound = true; continue;
        }
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

    // If no recipes are defined in the simulation, the check is successful by default.
    if (Object.keys(recipes).length === 0) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'No production recipes defined; check skipped.' });
      return; // Exit the function
    }

    for (const task of tasks) {
      const consumedItems = new Set(Object.keys(task.consumes || {}));
      
      for (const producedItem in (task.produces || {})) {
        if (recipes[producedItem]) {
          const requiredIngredients = new Set(recipes[producedItem].consumes || []);
          const missingIngredients = [];
          for (const required of requiredIngredients) {
            if (!consumedItems.has(required)) {
              missingIngredients.push(required);
            }
          }

          if (missingIngredients.length > 0) {
            this.addResult({
              metricId: metric.id,
              status: 'warning',
              message: `Recipe Violation: Task '${task.id}' produces '${producedItem}' but is missing required ingredient(s): ${missingIngredients.join(', ')}.`
            });
            issueFound = true;
          }
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All tasks comply with defined production recipes.' });
    }
  }

  validateMissingBufferTime(metric) {
    const minBuffer = metric.computation.params.minimum_buffer_minutes || 5;
    const actorTasks = {};
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    tasks.forEach(task => {
        if (!actorTasks[task.actor_id]) actorTasks[task.actor_id] = [];
        actorTasks[task.actor_id].push(task);
    });

    for (const actorId in actorTasks) {
        const schedule = actorTasks[actorId].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));
        for (let i = 0; i < schedule.length - 1; i++) {
            const currentTask = schedule[i];
            const nextTask = schedule[i+1];
            const currentEnd = this._timeToMinutes(currentTask.start) + (currentTask.duration || 0);
            const nextStart = this._timeToMinutes(nextTask.start);
            if (currentEnd === nextStart) {
                this.addResult({
                    metricId: metric.id,
                    status: 'info',
                    message: `Optimization: Consider a buffer between '${currentTask.id}' and '${nextTask.id}' for actor '${actorId}'.`
                });
                issueFound = true;
            }
        }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'Schedules include sufficient buffer times.' }); }
  }

  validateUnassignedTasks(metric) {
    const actorIds = new Set((this.simulation.actors || []).map(a => a.id));
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

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All tasks are assigned to valid actors.' });
    }
  }
  
  validateUnusedResources(metric) {
    const definedResources = new Set((this.simulation.resources || []).map(r => r.id));
    const tasks = this.simulation.tasks || [];

    for (const task of tasks) {
      Object.keys(task.consumes || {}).forEach(resId => definedResources.delete(resId));
      Object.keys(task.produces || {}).forEach(resId => definedResources.delete(resId));
    }

    if (definedResources.size > 0) {
      this.addResult({
        metricId: metric.id,
        status: 'info',
        message: `Optimization: The following resources are defined but never used: ${Array.from(definedResources).join(', ')}.`
      });
    } else {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All defined resources are utilized.' });
    }
  }

  validateEquipmentCapacity(metric) {
    const equipmentMap = new Map((this.simulation.equipment || []).map(e => [e.id, e]));
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const [eqId, equipment] of equipmentMap.entries()) {
      const capacity = equipment.capacity || 1;
      if (capacity <= 1) continue; // Overlap for capacity 1 is handled by state logic

      const relevantTasks = tasks
        .filter(t => (t.equipment_interactions || []).some(i => i.id === eqId))
        .sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));

      if (relevantTasks.length <= capacity) continue;

      // Check for overlapping tasks that exceed capacity
      for (let i = 0; i < relevantTasks.length; i++) {
        const taskA = relevantTasks[i];
        const startA = this._timeToMinutes(taskA.start);
        const endA = startA + (taskA.duration || 0);
        let concurrentTasks = 1;

        for (let j = i + 1; j < relevantTasks.length; j++) {
          const taskB = relevantTasks[j];
          const startB = this._timeToMinutes(taskB.start);
          if (startB >= endA) break; // Tasks are sorted, no more overlaps possible for taskA

          if ((taskB.equipment_interactions || []).some(i => i.id === eqId)) {
             concurrentTasks++;
          }
        }

        if (concurrentTasks > capacity) {
            this.addResult({
                metricId: metric.id,
                status: 'error',
                message: `Capacity Exceeded: Equipment '${eqId}' (capacity: ${capacity}) is used by ${concurrentTasks} tasks concurrently, starting around ${taskA.start}.`
            });
            issueFound = true;
            // Break from inner loops to avoid redundant errors for the same time slot
            break;
        }
      }
    }
    if (!issueFound) {
        this.addResult({ metricId: metric.id, status: 'success', message: 'Equipment capacity limits are respected.' });
    }
  }

  validateUnreachableDependencies(metric) {
    const tasks = this.simulation.tasks || [];
    const taskIds = new Set(tasks.map(t => t.id));
    let issueFound = false;

    for (const task of tasks) {
      for (const depId of (task.depends_on || [])) {
        if (!taskIds.has(depId)) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Task '${task.id}' has an unreachable dependency on a non-existent task: '${depId}'.`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All task dependencies are reachable.' });
    }
  }

  validateProfitability(metric) {
    const actors = this.simulation.actors || [];
    const resources = this.simulation.resources || [];
    const tasks = this.simulation.tasks || [];
    const finalProductIds = metric.computation.params.final_product_ids || [];

    // 1. Calculate total labor cost
    let totalLaborCost = 0;
    const actorCostMap = new Map(actors.map(a => [a.id, a.cost_per_hour || 0]));
    for (const task of tasks) {
      const costPerHour = actorCostMap.get(task.actor_id) || 0;
      const durationHours = (task.duration || 0) / 60;
      totalLaborCost += costPerHour * durationHours;
    }

    // 2. Calculate total consumed resource cost and total revenue
    let totalResourceCost = 0;
    let totalRevenue = 0;
    const resourceCostMap = new Map(resources.map(r => [r.id, r.cost_per_unit || 0]));

    for (const task of tasks) {
      for (const [resId, amount] of Object.entries(task.consumes || {})) {
        totalResourceCost += (resourceCostMap.get(resId) || 0) * amount;
      }
      for (const [resId, amount] of Object.entries(task.produces || {})) {
        if (finalProductIds.includes(resId)) {
            // Assumes a 'revenue' property exists on the resource definition.
            const revenuePerUnit = (resources.find(r => r.id === resId) || {}).revenue_per_unit || 0;
            totalRevenue += revenuePerUnit * amount;
        }
      }
    }

    const totalCost = totalLaborCost + totalResourceCost;
    const profit = totalRevenue - totalCost;

    if (profit < 0) {
      this.addResult({
        metricId: metric.id,
        status: 'warning',
        message: `Economic Warning: Simulation is unprofitable. Total Revenue: $${totalRevenue.toFixed(2)}, Total Costs: $${totalCost.toFixed(2)}, Loss: $${profit.toFixed(2)}.`
      });
    } else {
      this.addResult({ metricId: metric.id, status: 'success', message: `Simulation is profitable with a margin of $${profit.toFixed(2)}.` });
    }
  }
}