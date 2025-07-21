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
    const equipment = this.simulation.equipment || [];
    const tasks = this.simulation.tasks || [];
    let issueFound = false;
    const equipmentState = {};
    equipment.forEach(e => { equipmentState[e.id] = e.state || 'available'; });
    const equipmentTimeline = {};
    equipment.forEach(e => { equipmentTimeline[e.id] = []; });
    const sortedTasks = [...tasks].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));
    for (const task of sortedTasks) {
      const taskStart = this._timeToMinutes(task.start);
      if (taskStart === null) continue;
      const taskEnd = taskStart + (task.duration || 0);
      for (const interaction of (task.equipment_interactions || [])) {
        const eqId = interaction.id;
        if (equipmentState[eqId] !== interaction.from_state) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' requires equipment '${eqId}' to be in state '${interaction.from_state}', but it was '${equipmentState[eqId]}'.` });
          issueFound = true;
        }
        for (const usagePeriod of equipmentTimeline[eqId]) {
          if (taskStart < usagePeriod.end && taskEnd > usagePeriod.start) {
            this.addResult({ metricId: metric.id, status: 'error', message: `Equipment Conflict: '${eqId}' is used by task '${task.id}' while it's still in use.` });
            issueFound = true;
          }
        }
        equipmentState[eqId] = interaction.to_state;
        equipmentTimeline[eqId].push({ start: taskStart, end: taskEnd });
      }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'Equipment states and usage are logical.' }); }
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

  // --- NEWLY MIGRATED VALIDATION FUNCTIONS ---

  validateMissingDependencies(metric) {
    const dependencyMap = metric.computation.params.dependency_map;
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    for (const task of tasks) {
        const producedItems = Object.keys(task.produces || {});
        for (const item of producedItems) {
            if (dependencyMap[item]) {
                const requiredInputs = dependencyMap[item];
                const consumedInputs = Object.keys(task.consumes || {});
                for (const required of requiredInputs) {
                    if (!consumedInputs.includes(required)) {
                        this.addResult({
                            metricId: metric.id,
                            status: 'warning',
                            message: `Task '${task.id}' produces '${item}' but is missing required ingredient: '${required}'.`
                        });
                        issueFound = true;
                    }
                }
            }
        }
    }
    if (!issueFound) { this.addResult({ metricId: metric.id, status: 'success', message: 'All production tasks have required ingredients.' }); }
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
}