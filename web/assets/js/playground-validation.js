/**
 * Playground Validation Module
 * Handles JSON validation and simulation consistency checking
 */

export class PlaygroundValidation {
    constructor(core) {
        this.core = core;
        this.validationCache = new Map();
        this.lastValidationTime = 0;
    }
    
    /**
     * Validate the current JSON content
     */
    validateJSON() {
        const startTime = Date.now();
        
        try {
            const jsonText = this.core.editorManager.getValue().trim();
            
            if (!jsonText) {
                this.displayValidationResult({
                    isValid: false,
                    message: "No content to validate",
                    issues: []
                });
                return false;
            }
            
            // Check cache first
            const cacheKey = this.hashString(jsonText);
            if (this.validationCache.has(cacheKey)) {
                const cached = this.validationCache.get(cacheKey);
                this.displayValidationResult(cached);
                return cached.isValid;
            }
            
            // Parse JSON
            let simulationData;
            try {
                simulationData = JSON.parse(jsonText);
            } catch (parseError) {
                const result = {
                    isValid: false,
                    message: "Invalid JSON format",
                    issues: [{
                        type: 'error',
                        category: 'syntax',
                        message: `JSON Parse Error: ${parseError.message}`,
                        line: this.extractLineNumber(parseError.message)
                    }]
                };
                
                this.validationCache.set(cacheKey, result);
                this.displayValidationResult(result);
                return false;
            }
            
            // Validate simulation structure and content
            const validationResult = this.validateSimulation(simulationData);
            
            // Cache result
            this.validationCache.set(cacheKey, validationResult);
            
            // Clean cache if it gets too large
            if (this.validationCache.size > 100) {
                const firstKey = this.validationCache.keys().next().value;
                this.validationCache.delete(firstKey);
            }
            
            this.displayValidationResult(validationResult);
            
            const duration = Date.now() - startTime;
            console.log(`VALIDATION: Completed in ${duration}ms`);
            
            return validationResult.isValid;
            
        } catch (error) {
            console.error("VALIDATION: Unexpected error", error);
            
            this.displayValidationResult({
                isValid: false,
                message: "Validation system error",
                issues: [{
                    type: 'error',
                    category: 'system',
                    message: `Validation failed: ${error.message}`
                }]
            });
            
            return false;
        }
    }
    
    /**
     * Validate simulation data structure and content
     */
    validateSimulation(data) {
        const issues = [];
        let isValid = true;
        
        // Check top-level structure
        if (!data.simulation) {
            issues.push({
                type: 'error',
                category: 'structure',
                message: 'Missing required "simulation" object'
            });
            isValid = false;
        } else {
            const sim = data.simulation;
            
            // Validate metadata
            this.validateMetadata(sim.meta, issues);
            
            // Validate configuration
            this.validateConfiguration(sim.config, issues);
            
            // Validate actors
            this.validateActors(sim.actors, issues);
            
            // Validate resources
            this.validateResources(sim.resources, issues);
            
            // Validate tasks
            this.validateTasks(sim.tasks, sim.actors, sim.resources, issues);
            
            // Validate layout
            this.validateLayout(sim.layout, issues);
            
            // Cross-validation
            this.validateCrossReferences(sim, issues);
        }
        
        // Determine overall validity
        const errorCount = issues.filter(i => i.type === 'error').length;
        if (errorCount > 0) {
            isValid = false;
        }
        
        return {
            isValid,
            message: this.generateValidationMessage(issues),
            issues,
            summary: this.generateValidationSummary(issues)
        };
    }
    
    /**
     * Validate metadata section
     */
    validateMetadata(meta, issues) {
        if (!meta) {
            issues.push({
                type: 'warning',
                category: 'metadata',
                message: 'Missing metadata section - recommended for documentation'
            });
            return;
        }
        
        if (!meta.id) {
            issues.push({
                type: 'warning',
                category: 'metadata',
                message: 'Missing simulation ID in metadata'
            });
        }
        
        if (!meta.article_title) {
            issues.push({
                type: 'warning',
                category: 'metadata',
                message: 'Missing article title in metadata'
            });
        }
        
        if (!meta.domain) {
            issues.push({
                type: 'warning',
                category: 'metadata',
                message: 'Missing domain in metadata'
            });
        }
    }
    
    /**
     * Validate configuration section
     */
    validateConfiguration(config, issues) {
        if (!config) {
            issues.push({
                type: 'error',
                category: 'configuration',
                message: 'Missing required configuration section'
            });
            return;
        }
        
        if (!config.time_unit) {
            issues.push({
                type: 'error',
                category: 'configuration',
                message: 'Missing time_unit in configuration'
            });
        } else if (!['second', 'minute', 'hour', 'day'].includes(config.time_unit)) {
            issues.push({
                type: 'warning',
                category: 'configuration',
                message: `Unusual time unit: ${config.time_unit}`
            });
        }
        
        if (!config.start_time) {
            issues.push({
                type: 'warning',
                category: 'configuration',
                message: 'Missing start_time in configuration'
            });
        } else if (!this.isValidTimeFormat(config.start_time)) {
            issues.push({
                type: 'error',
                category: 'configuration',
                message: `Invalid start_time format: ${config.start_time} (expected HH:MM)`
            });
        }
        
        if (!config.end_time) {
            issues.push({
                type: 'warning',
                category: 'configuration',
                message: 'Missing end_time in configuration'
            });
        } else if (!this.isValidTimeFormat(config.end_time)) {
            issues.push({
                type: 'error',
                category: 'configuration',
                message: `Invalid end_time format: ${config.end_time} (expected HH:MM)`
            });
        }
        
        // Validate time range
        if (config.start_time && config.end_time && 
            this.isValidTimeFormat(config.start_time) && 
            this.isValidTimeFormat(config.end_time)) {
            
            const startMinutes = this.timeToMinutes(config.start_time);
            const endMinutes = this.timeToMinutes(config.end_time);
            
            if (startMinutes >= endMinutes) {
                issues.push({
                    type: 'error',
                    category: 'configuration',
                    message: 'start_time must be before end_time'
                });
            }
        }
    }
    
    /**
     * Validate actors array
     */
    validateActors(actors, issues) {
        if (!actors || !Array.isArray(actors)) {
            issues.push({
                type: 'error',
                category: 'actors',
                message: 'Missing or invalid actors array'
            });
            return;
        }
        
        if (actors.length === 0) {
            issues.push({
                type: 'warning',
                category: 'actors',
                message: 'No actors defined - simulation may not be actionable'
            });
            return;
        }
        
        const actorIds = new Set();
        
        actors.forEach((actor, index) => {
            const context = `Actor ${index + 1}`;
            
            if (!actor.id) {
                issues.push({
                    type: 'error',
                    category: 'actors',
                    message: `${context}: Missing required id field`
                });
            } else {
                if (actorIds.has(actor.id)) {
                    issues.push({
                        type: 'error',
                        category: 'actors',
                        message: `${context}: Duplicate actor ID "${actor.id}"`
                    });
                }
                actorIds.add(actor.id);
            }
            
            if (!actor.role) {
                issues.push({
                    type: 'warning',
                    category: 'actors',
                    message: `${context}: Missing role field`
                });
            }
            
            if (!actor.emoji) {
                issues.push({
                    type: 'info',
                    category: 'actors',
                    message: `${context}: Missing emoji for better visualization`
                });
            }
            
            // Validate shift times if present
            if (actor.shift) {
                if (actor.shift.start && !this.isValidTimeFormat(actor.shift.start)) {
                    issues.push({
                        type: 'error',
                        category: 'actors',
                        message: `${context}: Invalid shift start time format`
                    });
                }
                
                if (actor.shift.end && !this.isValidTimeFormat(actor.shift.end)) {
                    issues.push({
                        type: 'error',
                        category: 'actors',
                        message: `${context}: Invalid shift end time format`
                    });
                }
            }
        });
    }
    
    /**
     * Validate resources array
     */
    validateResources(resources, issues) {
        if (!resources || !Array.isArray(resources)) {
            issues.push({
                type: 'warning',
                category: 'resources',
                message: 'Missing resources array - consider adding resources for realism'
            });
            return;
        }
        
        const resourceIds = new Set();
        
        resources.forEach((resource, index) => {
            const context = `Resource ${index + 1}`;
            
            if (!resource.id) {
                issues.push({
                    type: 'error',
                    category: 'resources',
                    message: `${context}: Missing required id field`
                });
            } else {
                if (resourceIds.has(resource.id)) {
                    issues.push({
                        type: 'error',
                        category: 'resources',
                        message: `${context}: Duplicate resource ID "${resource.id}"`
                    });
                }
                resourceIds.add(resource.id);
            }
            
            if (!resource.name) {
                issues.push({
                    type: 'warning',
                    category: 'resources',
                    message: `${context}: Missing name field`
                });
            }
            
            if (!resource.type) {
                issues.push({
                    type: 'warning',
                    category: 'resources',
                    message: `${context}: Missing type field`
                });
            }
            
            if (!resource.emoji) {
                issues.push({
                    type: 'info',
                    category: 'resources',
                    message: `${context}: Missing emoji for better visualization`
                });
            }
        });
    }
    
    /**
     * Validate tasks array
     */
    validateTasks(tasks, actors, resources, issues) {
        if (!tasks || !Array.isArray(tasks)) {
            issues.push({
                type: 'error',
                category: 'tasks',
                message: 'Missing or invalid tasks array'
            });
            return;
        }
        
        if (tasks.length === 0) {
            issues.push({
                type: 'warning',
                category: 'tasks',
                message: 'No tasks defined - simulation will be empty'
            });
            return;
        }
        
        const taskIds = new Set();
        const actorIds = new Set((actors || []).map(a => a.id));
        const resourceIds = new Set((resources || []).map(r => r.id));
        
        tasks.forEach((task, index) => {
            const context = `Task ${index + 1}`;
            
            // Required fields
            if (!task.id) {
                issues.push({
                    type: 'error',
                    category: 'tasks',
                    message: `${context}: Missing required id field`
                });
            } else {
                if (taskIds.has(task.id)) {
                    issues.push({
                        type: 'error',
                        category: 'tasks',
                        message: `${context}: Duplicate task ID "${task.id}"`
                    });
                }
                taskIds.add(task.id);
            }
            
            if (!task.name) {
                issues.push({
                    type: 'error',
                    category: 'tasks',
                    message: `${context}: Missing required name field`
                });
            }
            
            if (!task.actor_id) {
                issues.push({
                    type: 'error',
                    category: 'tasks',
                    message: `${context}: Missing required actor_id field`
                });
            } else if (!actorIds.has(task.actor_id)) {
                issues.push({
                    type: 'error',
                    category: 'tasks',
                    message: `${context}: References non-existent actor "${task.actor_id}"`
                });
            }
            
            if (!task.start_time) {
                issues.push({
                    type: 'error',
                    category: 'tasks',
                    message: `${context}: Missing required start_time field`
                });
            } else if (!this.isValidTimeFormat(task.start_time)) {
                issues.push({
                    type: 'error',
                    category: 'tasks',
                    message: `${context}: Invalid start_time format "${task.start_time}"`
                });
            }
            
            if (task.duration === undefined || task.duration === null) {
                issues.push({
                    type: 'error',
                    category: 'tasks',
                    message: `${context}: Missing required duration field`
                });
            } else if (typeof task.duration !== 'number' || task.duration <= 0) {
                issues.push({
                    type: 'error',
                    category: 'tasks',
                    message: `${context}: Duration must be a positive number`
                });
            }
            
            // Optional fields validation
            if (!task.emoji) {
                issues.push({
                    type: 'info',
                    category: 'tasks',
                    message: `${context}: Missing emoji for better visualization`
                });
            }
            
            // Validate resource references
            if (task.uses_resources && Array.isArray(task.uses_resources)) {
                task.uses_resources.forEach(resourceId => {
                    if (!resourceIds.has(resourceId)) {
                        issues.push({
                            type: 'warning',
                            category: 'tasks',
                            message: `${context}: References non-existent resource "${resourceId}"`
                        });
                    }
                });
            }
            
            if (task.requires_resources && Array.isArray(task.requires_resources)) {
                task.requires_resources.forEach(resourceId => {
                    if (!resourceIds.has(resourceId)) {
                        issues.push({
                            type: 'warning',
                            category: 'tasks',
                            message: `${context}: Requires non-existent resource "${resourceId}"`
                        });
                    }
                });
            }
        });
    }
    
    /**
     * Validate layout section
     */
    validateLayout(layout, issues) {
        if (!layout) {
            issues.push({
                type: 'info',
                category: 'layout',
                message: 'Missing layout section - spatial visualization not available'
            });
            return;
        }
        
        if (!layout.locations || !Array.isArray(layout.locations)) {
            issues.push({
                type: 'warning',
                category: 'layout',
                message: 'Missing or invalid locations array in layout'
            });
            return;
        }
        
        const locationIds = new Set();
        
        layout.locations.forEach((location, index) => {
            const context = `Location ${index + 1}`;
            
            if (!location.id) {
                issues.push({
                    type: 'error',
                    category: 'layout',
                    message: `${context}: Missing required id field`
                });
            } else {
                if (locationIds.has(location.id)) {
                    issues.push({
                        type: 'error',
                        category: 'layout',
                        message: `${context}: Duplicate location ID "${location.id}"`
                    });
                }
                locationIds.add(location.id);
            }
            
            // Validate coordinates
            ['x', 'y'].forEach(coord => {
                if (location[coord] === undefined || location[coord] === null) {
                    issues.push({
                        type: 'error',
                        category: 'layout',
                        message: `${context}: Missing required ${coord} coordinate`
                    });
                } else if (typeof location[coord] !== 'number') {
                    issues.push({
                        type: 'error',
                        category: 'layout',
                        message: `${context}: ${coord} coordinate must be a number`
                    });
                }
            });
            
            // Validate dimensions
            ['width', 'height'].forEach(dim => {
                if (location[dim] === undefined || location[dim] === null) {
                    issues.push({
                        type: 'error',
                        category: 'layout',
                        message: `${context}: Missing required ${dim} dimension`
                    });
                } else if (typeof location[dim] !== 'number' || location[dim] <= 0) {
                    issues.push({
                        type: 'error',
                        category: 'layout',
                        message: `${context}: ${dim} must be a positive number`
                    });
                }
            });
        });
    }
    
    /**
     * Validate cross-references and consistency
     */
    validateCrossReferences(simulation, issues) {
        const actors = simulation.actors || [];
        const tasks = simulation.tasks || [];
        const resources = simulation.resources || [];
        const locations = (simulation.layout && simulation.layout.locations) || [];
        
        const locationIds = new Set(locations.map(l => l.id));
        
        // Check if tasks reference valid locations
        tasks.forEach(task => {
            if (task.location && !locationIds.has(task.location)) {
                issues.push({
                    type: 'warning',
                    category: 'cross-reference',
                    message: `Task "${task.name}" references non-existent location "${task.location}"`
                });
            }
        });
        
        // Check if resources reference valid locations
        resources.forEach(resource => {
            if (resource.location && !locationIds.has(resource.location)) {
                issues.push({
                    type: 'warning',
                    category: 'cross-reference',
                    message: `Resource "${resource.name}" references non-existent location "${resource.location}"`
                });
            }
        });
        
        // Check for scheduling conflicts
        this.checkSchedulingConflicts(actors, tasks, issues);
    }
    
    /**
     * Check for scheduling conflicts
     */
    checkSchedulingConflicts(actors, tasks, issues) {
        const actorSchedules = new Map();
        
        // Group tasks by actor
        tasks.forEach(task => {
            if (!task.actor_id || !task.start_time || !task.duration) return;
            
            if (!actorSchedules.has(task.actor_id)) {
                actorSchedules.set(task.actor_id, []);
            }
            
            const startMinutes = this.timeToMinutes(task.start_time);
            const endMinutes = startMinutes + task.duration;
            
            actorSchedules.get(task.actor_id).push({
                task,
                start: startMinutes,
                end: endMinutes
            });
        });
        
        // Check for overlaps within each actor's schedule
        actorSchedules.forEach((schedule, actorId) => {
            schedule.sort((a, b) => a.start - b.start);
            
            for (let i = 0; i < schedule.length - 1; i++) {
                const current = schedule[i];
                const next = schedule[i + 1];
                
                if (current.end > next.start) {
                    issues.push({
                        type: 'error',
                        category: 'scheduling',
                        message: `Scheduling conflict for actor "${actorId}": "${current.task.name}" overlaps with "${next.task.name}"`
                    });
                }
            }
        });
    }
    
    /**
     * Display validation results in the UI
     */
    displayValidationResult(result) {
        const validationPanel = document.querySelector('.validation-content');
        if (!validationPanel) {
            console.warn("VALIDATION: Validation panel not found");
            return;
        }
        
        validationPanel.innerHTML = this.formatValidationHTML(result);
        
        // Update header indicator
        const header = document.querySelector('.validation-header');
        if (header) {
            const indicator = this.createValidationIndicator(result);
            header.innerHTML = `Validation Results ${indicator}`;
        }
    }
    
    /**
     * Format validation results as HTML
     */
    formatValidationHTML(result) {
        if (!result.issues || result.issues.length === 0) {
            return `<div class="validation-success">✅ No issues found - simulation is valid!</div>`;
        }
        
        const categorized = this.categorizeIssues(result.issues);
        let html = '';
        
        // Summary
        if (result.summary) {
            html += `<div class="validation-summary">${result.summary}</div>`;
        }
        
        // Issues by category
        Object.entries(categorized).forEach(([category, issues]) => {
            if (issues.length === 0) return;
            
            html += `<div class="validation-category ${category}">`;
            html += `<h4>${this.formatCategoryName(category)} (${issues.length})</h4>`;
            
            issues.forEach(issue => {
                html += `<div class="validation-issue ${issue.type}">`;
                html += `<strong>${issue.type.toUpperCase()}:</strong> ${issue.message}`;
                html += `</div>`;
            });
            
            html += `</div>`;
        });
        
        return html;
    }
    
    /**
     * Categorize issues for display
     */
    categorizeIssues(issues) {
        const categories = {
            'critical-errors': [],
            'resource-issues': [],
            'scheduling-conflicts': [],
            'optimization-suggestions': []
        };
        
        issues.forEach(issue => {
            if (issue.type === 'error') {
                categories['critical-errors'].push(issue);
            } else if (issue.category === 'resources' || issue.category === 'cross-reference') {
                categories['resource-issues'].push(issue);
            } else if (issue.category === 'scheduling') {
                categories['scheduling-conflicts'].push(issue);
            } else {
                categories['optimization-suggestions'].push(issue);
            }
        });
        
        return categories;
    }
    
    /**
     * Create validation indicator
     */
    createValidationIndicator(result) {
        const errorCount = result.issues.filter(i => i.type === 'error').length;
        const warningCount = result.issues.filter(i => i.type === 'warning').length;
        
        if (errorCount > 0) {
            return `<span class="validation-indicator error">❌ ${errorCount} error${errorCount !== 1 ? 's' : ''}</span>`;
        } else if (warningCount > 0) {
            return `<span class="validation-indicator warning">⚠️ ${warningCount} warning${warningCount !== 1 ? 's' : ''}</span>`;
        } else {
            return `<span class="validation-indicator success">✅ Valid</span>`;
        }
    }
    
    /**
     * Generate validation message
     */
    generateValidationMessage(issues) {
        const errorCount = issues.filter(i => i.type === 'error').length;
        const warningCount = issues.filter(i => i.type === 'warning').length;
        const infoCount = issues.filter(i => i.type === 'info').length;
        
        if (errorCount > 0) {
            return `Found ${errorCount} error${errorCount !== 1 ? 's' : ''} that must be fixed`;
        } else if (warningCount > 0) {
            return `Found ${warningCount} warning${warningCount !== 1 ? 's' : ''} to consider`;
        } else if (infoCount > 0) {
            return `Found ${infoCount} suggestion${infoCount !== 1 ? 's' : ''} for improvement`;
        } else {
            return "Simulation is valid and ready to use";
        }
    }
    
    /**
     * Generate validation summary
     */
    generateValidationSummary(issues) {
        const counts = {
            error: issues.filter(i => i.type === 'error').length,
            warning: issues.filter(i => i.type === 'warning').length,
            info: issues.filter(i => i.type === 'info').length
        };
        
        const parts = [];
        if (counts.error > 0) parts.push(`${counts.error} error${counts.error !== 1 ? 's' : ''}`);
        if (counts.warning > 0) parts.push(`${counts.warning} warning${counts.warning !== 1 ? 's' : ''}`);
        if (counts.info > 0) parts.push(`${counts.info} suggestion${counts.info !== 1 ? 's' : ''}`);
        
        return parts.length > 0 ? `Found: ${parts.join(', ')}` : 'No issues found';
    }
    
    /**
     * Format category names for display
     */
    formatCategoryName(category) {
        const names = {
            'critical-errors': 'Critical Errors',
            'resource-issues': 'Resource Issues',
            'scheduling-conflicts': 'Scheduling Conflicts',
            'optimization-suggestions': 'Optimization Suggestions'
        };
        return names[category] || category;
    }
    
    // Utility methods
    
    isValidTimeFormat(time) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    }
    
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    extractLineNumber(errorMessage) {
        const match = errorMessage.match(/line (\d+)/i);
        return match ? parseInt(match[1]) : null;
    }
    
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }
}