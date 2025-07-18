/**
 * Universal Automation Wiki - Simulation Validator
 *
 * This script provides the client-side validation engine for the Simulation Playground.
 * It reads a metrics catalog and runs a series of computational checks against
 * a given simulation JSON object.
 *
 * Author: UAW Development Team
 * Version: 1.0.0
 * Last Updated: 2025-07-18
 */

class SimulationValidator {
  /**
   * Initializes the validator with simulation data.
   * @param {object} simulationData The full JSON object from the editor.
   */
  constructor(simulationData) {
    this.simulation = simulationData ? simulationData.simulation : null;
    this.results = [];
  }

  /**
   * Runs all computational validation checks defined in the metrics catalog.
   * @param {Array<object>} metricsCatalog An array of metric definition objects.
   * @returns {Array<object>} An array of validation result objects.
   */
  runChecks(metricsCatalog) {
    this.results = [];
    if (!this.simulation) {
      this.addResult({
          metricId: 'schema.integrity.missing_root',
          status: 'error',
          message: "The root 'simulation' object is missing or invalid in the JSON structure."
      });
      return this.results;
    }
    
    const computationalMetrics = metricsCatalog.filter(m => m.validation_type === 'computational');

    for (const metric of computationalMetrics) {
      const funcName = metric.computation.function_name;
      if (typeof this[funcName] === 'function') {
        try {
          this[funcName](metric);
        } catch (e) {
           this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Execution Error in ${funcName}: ${e.message}`
          });
        }
      } else {
        this.addResult({
          metricId: metric.id,
          status: 'error',
          message: `Internal Error: Validation function '${funcName}' is not implemented in simulation-validator.js.`
        });
      }
    }
    return this.results;
  }

  /**
   * Adds a formatted result object to the results array.
   * @param {object} result - The result object, containing metricId, status, and message.
   */
  addResult(result) {
    this.results.push(result);
  }

  /**
   * Helper function to convert HH:MM time string to total minutes from midnight.
   * @param {string} timeStr - The time string in "HH:MM" format.
   * @returns {number|null} Total minutes or null if format is invalid.
   */
  _timeToMinutes(timeStr) {
    if (typeof timeStr !== 'string' || !timeStr.match(/^\d{2}:\d{2}$/)) {
      return null;
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // --- IMPLEMENTATION OF VALIDATION FUNCTIONS ---
  // Each function corresponds to a 'function_name' in metrics_catalog.json

  /**
   * METRIC: schema.integrity.missing_root
   * Checks that the top-level 'simulation' object exists.
   * Note: This is partially handled in runChecks, but we keep it for catalog completeness.
   */
  validateRootObject(metric) {
     this.addResult({ metricId: metric.id, status: 'success', message: 'Root "simulation" object is present.' });
  }

  /**
   * METRIC: resource.flow.negative_stock
   * Tracks resource levels throughout the simulation to ensure they never go negative.
   */
  validateNegativeStock(metric) {
    const stock = {};
    const tasks = this.simulation.tasks || [];
    const resources = this.simulation.resources || [];
    let issueFound = false;

    // 1. Initialize stock levels from starting resources.
    resources.forEach(r => {
      stock[r.id] = r.starting_stock || 0;
    });

    // 2. Process tasks in chronological order.
    const sortedTasks = [...tasks].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));

    for (const task of sortedTasks) {
      // 3. Process consumption.
      for (const [resource, amount] of Object.entries(task.consumes || {})) {
        if (stock[resource] === undefined) {
          this.addResult({ metricId: metric.id, status: 'error', message: `Task '${task.id}' consumes undefined resource '${resource}'.` });
          issueFound = true;
          continue; // Skip further processing for this resource
        }
        stock[resource] -= amount;
        if (stock[resource] < -0.0001) { // Use a small tolerance for floating point math
          this.addResult({ metricId: metric.id, status: 'error', message: `Resource '${resource}' stock became negative (${stock[resource].toFixed(2)}) after task '${task.id}'.` });
          issueFound = true;
        }
      }
      // 4. Process production.
      for (const [resource, amount] of Object.entries(task.produces || {})) {
        if (stock[resource] === undefined) {
          stock[resource] = 0; // A resource can be produced for the first time
        }
        stock[resource] += amount;
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All resource stock levels remained positive.' });
    }
  }
  
  /**
   * METRIC: actor.scheduling.overlap
   * Checks for any instance of a single actor being assigned to overlapping tasks.
   */
  validateActorOverlap(metric) {
    const actorTasks = {};
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    // 1. Group tasks by actor.
    tasks.forEach(task => {
      const actorId = task.actor_id;
      if (!actorId) return;
      if (!actorTasks[actorId]) {
        actorTasks[actorId] = [];
      }
      actorTasks[actorId].push(task);
    });

    // 2. Check for overlaps within each actor's schedule.
    for (const actorId in actorTasks) {
      const schedule = actorTasks[actorId].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));

      for (let i = 0; i < schedule.length - 1; i++) {
        const currentTask = schedule[i];
        const nextTask = schedule[i + 1];

        const currentStart = this._timeToMinutes(currentTask.start);
        const nextStart = this._timeToMinutes(nextTask.start);

        if (currentStart === null || nextStart === null) continue; // Skip if time is invalid

        const currentEnd = currentStart + (currentTask.duration || 0);

        if (currentEnd > nextStart) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Actor '${actorId}' has an overlap between task '${currentTask.id}' (ends at ${Math.floor(currentEnd/60)}:${String(currentEnd%60).padStart(2,'0')}) and task '${nextTask.id}' (starts at ${nextTask.start}).`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'No actor scheduling conflicts found.' });
    }
  }
  
  /**
   * METRIC: temporal.dependency.violation
   * Ensures tasks do not start before their dependencies are complete.
   */
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
          issueFound = true;
          continue;
        }

        const depStart = this._timeToMinutes(depTask.start);
        if (depStart === null) continue;

        const depEnd = depStart + (depTask.duration || 0);

        if (taskStart < depEnd) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Timing violation: Task '${task.id}' (starts ${task.start}) begins before its dependency '${depTask.id}' finishes (at ${Math.floor(depEnd/60)}:${String(depEnd%60).padStart(2,'0')}).`
          });
          issueFound = true;
        }
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'All task dependencies are temporally respected.' });
    }
  }

    /**
   * METRIC: equipment.state.logic
   * Tracks equipment states to ensure tasks use equipment in the correct state
   * and that equipment is not used simultaneously.
   */
  validateEquipmentState(metric) {
    const equipment = this.simulation.equipment || [];
    const tasks = this.simulation.tasks || [];
    let issueFound = false;

    // 1. Initialize the state of all equipment.
    const equipmentState = {};
    equipment.forEach(e => {
      equipmentState[e.id] = e.state || 'available'; // Default to 'available'
    });

    // 2. Create a timeline to track equipment usage periods.
    const equipmentTimeline = {};
    equipment.forEach(e => { equipmentTimeline[e.id] = []; });
    
    // 3. Process tasks chronologically to check for state prerequisites and conflicts.
    const sortedTasks = [...tasks].sort((a, b) => (a.start || "00:00").localeCompare(b.start || "00:00"));

    for (const task of sortedTasks) {
      const taskStart = this._timeToMinutes(task.start);
      if (taskStart === null) continue;
      const taskEnd = taskStart + (task.duration || 0);

      for (const interaction of (task.equipment_interactions || [])) {
        const eqId = interaction.id;
        
        // A. Check for prerequisite state.
        if (equipmentState[eqId] !== interaction.from_state) {
          this.addResult({
            metricId: metric.id,
            status: 'error',
            message: `Task '${task.id}' requires equipment '${eqId}' to be in state '${interaction.from_state}', but it was '${equipmentState[eqId]}'.`
          });
          issueFound = true;
        }

        // B. Check for simultaneous usage conflict.
        for (const usagePeriod of equipmentTimeline[eqId]) {
          if (taskStart < usagePeriod.end && taskEnd > usagePeriod.start) {
            this.addResult({
              metricId: metric.id,
              status: 'error',
              message: `Equipment Conflict: '${eqId}' is used by task '${task.id}' while it's still in use by another task.`
            });
            issueFound = true;
          }
        }
        
        // C. Update the state and timeline for the next task.
        equipmentState[eqId] = interaction.to_state;
        equipmentTimeline[eqId].push({ start: taskStart, end: taskEnd });
      }
    }

    if (!issueFound) {
      this.addResult({ metricId: metric.id, status: 'success', message: 'Equipment states and usage are logical.' });
    }
  }
}