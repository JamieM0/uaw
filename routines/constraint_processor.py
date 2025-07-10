"""
Enhanced Constraint Processor for Simulation Validation and Post-Processing

This module provides comprehensive validation, constraint resolution, and automatic
post-processing for simulation data. It implements realistic resource tracking,
equipment maintenance insertion, and validation transparency.
"""

import json
import os
import copy
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Windows Unicode support
if sys.platform.startswith('win'):
    import locale
    import codecs
    # Try to set UTF-8 encoding for Windows console
    try:
        # For Python 3.7+ on Windows
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        else:
            # Fallback for older Python versions
            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())
    except (AttributeError, OSError):
        pass  # Fallback to safe printing


def safe_print(*args, **kwargs):
    """Safe print function that handles Unicode encoding errors on Windows."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        # Replace problematic Unicode characters with ASCII equivalents
        safe_args = []
        for arg in args:
            if isinstance(arg, str):
                # Replace common emoji characters with ASCII equivalents
                safe_arg = arg.replace('🔸', '[*]').replace('⚙️', '[gear]').replace('✓', '[check]').replace('⚠', '[warn]')
                # Remove any remaining problematic Unicode characters
                safe_arg = safe_arg.encode('ascii', errors='replace').decode('ascii')
                safe_args.append(safe_arg)
            else:
                safe_args.append(str(arg).encode('ascii', errors='replace').decode('ascii'))
        print(*safe_args, **kwargs)


class ValidationSeverity(Enum):
    """Validation severity levels"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationResult:
    """Individual validation result"""
    id: str
    severity: ValidationSeverity
    category: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    task_id: Optional[str] = None
    resource_id: Optional[str] = None
    actor_id: Optional[str] = None


@dataclass
class ResourceState:
    """Resource state at a specific time"""
    resource_id: str
    quantity: float
    timestamp: str
    consumed_by: Optional[str] = None
    produced_by: Optional[str] = None


@dataclass
class ValidationSummary:
    """Summary of validation results"""
    total_issues: int
    critical_errors: int
    resource_issues: int
    scheduling_conflicts: int
    optimization_suggestions: int
    business_readiness_score: float
    business_readiness_level: str
    processing_time: float
    timestamp: str


class ConstraintProcessor:
    """Main constraint processor for simulation validation and enhancement"""

    def __init__(self, config_dir: str = None):
        """Initialize the constraint processor with configuration"""
        if config_dir is None:
            config_dir = os.path.join(os.path.dirname(__file__), '..', 'simulation')

        self.config_dir = config_dir
        self.constraint_config = self._load_config('constraint_config.json')
        self.maintenance_rules = self._load_config('maintenance_rules.json')
        self.validation_results: List[ValidationResult] = []
        self.resource_timeline: Dict[str, List[ResourceState]] = {}

    def _load_config(self, filename: str) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        config_path = os.path.join(self.config_dir, filename)
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            safe_print(f"Warning: Configuration file {filename} not found. Using defaults.")
            return {}
        except json.JSONDecodeError as e:
            safe_print(f"Error parsing {filename}: {e}")
            return {}

    def apply_comprehensive_constraints(self, simulation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply all constraint processing to simulation data"""
        start_time = datetime.now()

        # Clear previous results
        self.validation_results.clear()
        self.resource_timeline.clear()

        # Create working copy
        processed_sim = copy.deepcopy(simulation_data)

        # Apply constraint processing in order
        processing_order = self.constraint_config.get('post_processing', {}).get('processing_order', [
            'validate_resource_flow',
            'insert_maintenance_tasks',
            'resolve_scheduling_conflicts',
            'apply_buffer_time',
            'generate_transparency_data'
        ])

        for process_step in processing_order:
            try:
                if process_step == 'validate_resource_flow':
                    self._validate_resource_flow(processed_sim)
                elif process_step == 'insert_maintenance_tasks':
                    processed_sim = self._insert_maintenance_tasks(processed_sim)
                elif process_step == 'resolve_scheduling_conflicts':
                    processed_sim = self._resolve_scheduling_conflicts(processed_sim)
                elif process_step == 'apply_buffer_time':
                    processed_sim = self._apply_buffer_time(processed_sim)
                elif process_step == 'generate_transparency_data':
                    processed_sim = self._generate_transparency_data(processed_sim)
            except Exception as e:
                self._add_validation_result(
                    f"processing_error_{process_step}",
                    ValidationSeverity.ERROR,
                    "critical_errors",
                    f"Error in {process_step}: {str(e)}"
                )

        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()

        # Generate validation summary
        validation_summary = self._generate_validation_summary(processing_time)

        # Add validation data to processed simulation
        processed_sim['validation_results'] = [
            {
                'id': r.id,
                'severity': r.severity.value,
                'category': r.category,
                'message': r.message,
                'details': r.details,
                'timestamp': r.timestamp,
                'task_id': r.task_id,
                'resource_id': r.resource_id,
                'actor_id': r.actor_id
            }
            for r in self.validation_results
        ]

        processed_sim['validation_summary'] = {
            'total_issues': validation_summary.total_issues,
            'critical_errors': validation_summary.critical_errors,
            'resource_issues': validation_summary.resource_issues,
            'scheduling_conflicts': validation_summary.scheduling_conflicts,
            'optimization_suggestions': validation_summary.optimization_suggestions,
            'business_readiness_score': validation_summary.business_readiness_score,
            'business_readiness_level': validation_summary.business_readiness_level,
            'processing_time': validation_summary.processing_time,
            'timestamp': validation_summary.timestamp
        }

        return processed_sim

    def _validate_resource_flow(self, simulation_data: Dict[str, Any]) -> None:
        """Validate resource flow with minute-by-minute tracking"""
        if not self.constraint_config.get('stock_validation', {}).get('enabled', True):
            return

        # Initialize resource stocks
        resource_stocks = {}
        for resource in simulation_data.get('resources', []):
            resource_stocks[resource['id']] = resource.get('starting_stock', 0.0)

        # Sort tasks by start time
        tasks = simulation_data.get('tasks', [])
        sorted_tasks = sorted(tasks, key=lambda t: self._parse_time(t.get('start', '00:00')))

        # Track resource flow minute by minute
        for task in sorted_tasks:
            task_id = task.get('id', 'unknown')
            start_time = task.get('start', '00:00')

            # Check resource consumption
            for resource_id, quantity in task.get('consumes', {}).items():
                if resource_id not in resource_stocks:
                    self._add_validation_result(
                        f"unknown_resource_{resource_id}",
                        ValidationSeverity.ERROR,
                        "resource_issues",
                        f"Task {task_id} consumes unknown resource: {resource_id}",
                        {'task_id': task_id, 'resource_id': resource_id}
                    )
                    continue

                current_stock = resource_stocks[resource_id]
                if current_stock < quantity:
                    self._add_validation_result(
                        f"insufficient_stock_{resource_id}_{task_id}",
                        ValidationSeverity.ERROR,
                        "resource_issues",
                        f"Insufficient {resource_id} for task {task_id}. Required: {quantity}, Available: {current_stock}",
                        {
                            'task_id': task_id,
                            'resource_id': resource_id,
                            'required': quantity,
                            'available': current_stock,
                            'shortfall': quantity - current_stock,
                            'start_time': start_time
                        }
                    )

                # Update stock
                resource_stocks[resource_id] = max(0, current_stock - quantity)

                # Record resource state
                self._record_resource_state(resource_id, resource_stocks[resource_id], start_time, task_id, 'consumed')

            # Check resource production
            for resource_id, quantity in task.get('produces', {}).items():
                if resource_id not in resource_stocks:
                    resource_stocks[resource_id] = 0.0

                resource_stocks[resource_id] += quantity
                self._record_resource_state(resource_id, resource_stocks[resource_id], start_time, task_id, 'produced')

        # Check for resource dependencies
        self._validate_resource_dependencies(simulation_data)

    def _validate_resource_dependencies(self, simulation_data: Dict[str, Any]) -> None:
        """Validate resource dependencies (e.g., activated_yeast depends on yeast)"""
        dependencies = self.constraint_config.get('stock_validation', {}).get('resource_dependencies', {})

        produced_resources = set()
        consumed_resources = set()

        # Sort tasks by start time
        tasks = simulation_data.get('tasks', [])
        sorted_tasks = sorted(tasks, key=lambda t: self._parse_time(t.get('start', '00:00')))

        for task in sorted_tasks:
            task_id = task.get('id', 'unknown')

            # Check if consumed resources have been produced or are available
            for resource_id in task.get('consumes', {}):
                if resource_id in dependencies:
                    required_resources = dependencies[resource_id]
                    for required_resource in required_resources:
                        if required_resource not in produced_resources:
                            # Check if it's available in starting stock
                            starting_stock = self._get_starting_stock(simulation_data, required_resource)
                            if starting_stock <= 0:
                                self._add_validation_result(
                                    f"missing_dependency_{resource_id}_{required_resource}",
                                    ValidationSeverity.WARNING,
                                    "resource_issues",
                                    f"Task {task_id} consumes {resource_id} which depends on {required_resource}, but {required_resource} has not been produced",
                                    {
                                        'task_id': task_id,
                                        'dependent_resource': resource_id,
                                        'required_resource': required_resource
                                    }
                                )

                consumed_resources.add(resource_id)

            # Track produced resources
            for resource_id in task.get('produces', {}):
                produced_resources.add(resource_id)

    def _insert_maintenance_tasks(self, simulation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert maintenance tasks based on equipment usage"""
        if not self.constraint_config.get('equipment_maintenance', {}).get('enabled', True):
            return simulation_data

        maintenance_rules = self.maintenance_rules.get('maintenance_rules', {})
        equipment_types = maintenance_rules.get('equipment_types', {})

        # Track equipment usage
        equipment_usage = {}
        new_tasks = []

        # Sort tasks by start time
        tasks = simulation_data.get('tasks', [])
        sorted_tasks = sorted(tasks, key=lambda t: self._parse_time(t.get('start', '00:00')))

        for task in sorted_tasks:
            task_id = task.get('id', 'unknown')

            # Check if task produces "dirty" equipment
            for resource_id, quantity in task.get('produces', {}).items():
                if 'dirty_' in resource_id or 'used_' in resource_id:
                    equipment_type = resource_id.replace('dirty_', '').replace('used_', '')

                    if equipment_type in equipment_types:
                        # Calculate maintenance task timing
                        task_end_time = self._add_minutes_to_time(
                            task.get('start', '00:00'),
                            task.get('duration', 0)
                        )

                        # Generate maintenance tasks
                        maintenance_tasks = self._generate_maintenance_tasks(
                            equipment_type,
                            task_id,
                            task_end_time,
                            equipment_types[equipment_type],
                            simulation_data
                        )

                        new_tasks.extend(maintenance_tasks)

        # Add new maintenance tasks to simulation
        simulation_data['tasks'].extend(new_tasks)

        # Add required cleaning supplies to resources if not present
        self._add_cleaning_supplies(simulation_data)

        return simulation_data

    def _generate_maintenance_tasks(self, equipment_type: str, triggering_task_id: str,
                                   end_time: str, equipment_config: Dict[str, Any],
                                   simulation_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate maintenance tasks for equipment"""
        maintenance_tasks = []

        for i, maintenance_task in enumerate(equipment_config.get('maintenance_tasks', [])):
            task_start_time = self._add_minutes_to_time(end_time, maintenance_task.get('delay_after_use', 0))

            # Find available actor
            actor_id = self._find_available_actor(
                simulation_data,
                task_start_time,
                maintenance_task.get('duration', 10),
                maintenance_task.get('actor_roles', ['worker'])
            )

            if not actor_id and maintenance_task.get('actor_required', True):
                self._add_validation_result(
                    f"no_actor_for_maintenance_{equipment_type}_{i}",
                    ValidationSeverity.WARNING,
                    "scheduling_conflicts",
                    f"No available actor for {equipment_type} {maintenance_task['type']} task",
                    {
                        'equipment_type': equipment_type,
                        'maintenance_type': maintenance_task['type'],
                        'required_roles': maintenance_task.get('actor_roles', [])
                    }
                )
                continue

            # Generate maintenance task
            maintenance_task_data = {
                'id': f"{maintenance_task['type']}_{equipment_type}_{triggering_task_id}_{i}",
                'start': task_start_time,
                'duration': maintenance_task.get('duration', 10),
                'actor_id': actor_id,
                'location': maintenance_task.get('location', 'maintenance_area'),
                'consumes': maintenance_task.get('resources_consumed', {}),
                'produces': maintenance_task.get('resources_produced', {}),
                'depends_on': [triggering_task_id],
                'maintenance_type': maintenance_task['type'],
                'equipment_type': equipment_type,
                'priority': maintenance_task.get('priority', 'medium'),
                'description': maintenance_task.get('description', f"{maintenance_task['type']} {equipment_type}")
            }

            # Add prerequisites as additional consumption
            for prereq_resource, prereq_quantity in maintenance_task.get('prerequisites', {}).items():
                if prereq_resource not in maintenance_task_data['consumes']:
                    maintenance_task_data['consumes'][prereq_resource] = prereq_quantity

            maintenance_tasks.append(maintenance_task_data)

        return maintenance_tasks

    def _resolve_scheduling_conflicts(self, simulation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve scheduling conflicts between actors and equipment"""
        if not self.constraint_config.get('constraint_resolution', {}).get('enabled', True):
            return simulation_data

        # Check for actor conflicts
        actor_conflicts = self._detect_actor_conflicts(simulation_data)

        # Resolve conflicts using configured strategies
        for conflict in actor_conflicts:
            self._resolve_actor_conflict(simulation_data, conflict)

        return simulation_data

    def _detect_actor_conflicts(self, simulation_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect scheduling conflicts between actors"""
        conflicts = []

        # Group tasks by actor
        actor_tasks = {}
        for task in simulation_data.get('tasks', []):
            actor_id = task.get('actor_id')
            if actor_id:
                if actor_id not in actor_tasks:
                    actor_tasks[actor_id] = []
                actor_tasks[actor_id].append(task)

        # Check for overlaps within each actor's schedule
        for actor_id, tasks in actor_tasks.items():
            sorted_tasks = sorted(tasks, key=lambda t: self._parse_time(t.get('start', '00:00')))

            for i in range(len(sorted_tasks) - 1):
                current_task = sorted_tasks[i]
                next_task = sorted_tasks[i + 1]

                current_end = self._add_minutes_to_time(
                    current_task.get('start', '00:00'),
                    current_task.get('duration', 0)
                )

                if self._parse_time(current_end) > self._parse_time(next_task.get('start', '00:00')):
                    conflicts.append({
                        'type': 'actor_overlap',
                        'actor_id': actor_id,
                        'first_task': current_task,
                        'second_task': next_task,
                        'overlap_minutes': self._parse_time(current_end) - self._parse_time(next_task.get('start', '00:00'))
                    })

        return conflicts

    def _resolve_actor_conflict(self, simulation_data: Dict[str, Any], conflict: Dict[str, Any]) -> None:
        """Resolve a specific actor conflict"""
        strategies = self.constraint_config.get('constraint_resolution', {}).get('resolution_strategies', [])

        for strategy in strategies:
            if strategy.get('conflict_type') == conflict['type']:
                if strategy.get('strategy') == 'shift_later_task':
                    max_shift = strategy.get('max_shift_minutes', 60)
                    self._shift_task(simulation_data, conflict['second_task'], max_shift)
                    break

    def _shift_task(self, simulation_data: Dict[str, Any], task: Dict[str, Any], max_shift_minutes: int) -> None:
        """Shift a task to resolve conflicts"""
        current_start = task.get('start', '00:00')

        # Try shifting in 5-minute increments
        for shift_minutes in range(5, max_shift_minutes + 1, 5):
            new_start = self._add_minutes_to_time(current_start, shift_minutes)

            # Check if new time resolves the conflict
            if self._is_time_slot_available(simulation_data, task.get('actor_id'), new_start, task.get('duration', 0)):
                task['start'] = new_start
                self._add_validation_result(
                    f"task_shifted_{task.get('id', 'unknown')}",
                    ValidationSeverity.INFO,
                    "optimization_suggestions",
                    f"Task {task.get('id', 'unknown')} shifted by {shift_minutes} minutes to resolve scheduling conflict",
                    {
                        'task_id': task.get('id'),
                        'shift_minutes': shift_minutes,
                        'new_start': new_start,
                        'original_start': current_start
                    }
                )
                return

        # If no resolution found, log it
        self._add_validation_result(
            f"unresolved_conflict_{task.get('id', 'unknown')}",
            ValidationSeverity.WARNING,
            "scheduling_conflicts",
            f"Could not resolve scheduling conflict for task {task.get('id', 'unknown')}",
            {'task_id': task.get('id')}
        )

    def _apply_buffer_time(self, simulation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply buffer time between tasks"""
        buffer_config = self.constraint_config.get('constraint_resolution', {}).get('buffer_time', {})

        if not buffer_config.get('enabled', True):
            return simulation_data

        default_buffer = buffer_config.get('default_buffer_minutes', 5)

        # Group tasks by actor and apply buffer time
        actor_tasks = {}
        for task in simulation_data.get('tasks', []):
            actor_id = task.get('actor_id')
            if actor_id:
                if actor_id not in actor_tasks:
                    actor_tasks[actor_id] = []
                actor_tasks[actor_id].append(task)

        for actor_id, tasks in actor_tasks.items():
            sorted_tasks = sorted(tasks, key=lambda t: self._parse_time(t.get('start', '00:00')))

            for i in range(len(sorted_tasks) - 1):
                current_task = sorted_tasks[i]
                next_task = sorted_tasks[i + 1]

                current_end = self._add_minutes_to_time(
                    current_task.get('start', '00:00'),
                    current_task.get('duration', 0)
                )

                buffer_needed = self._add_minutes_to_time(current_end, default_buffer)

                if self._parse_time(buffer_needed) > self._parse_time(next_task.get('start', '00:00')):
                    next_task['start'] = buffer_needed
                    self._add_validation_result(
                        f"buffer_applied_{next_task.get('id', 'unknown')}",
                        ValidationSeverity.INFO,
                        "optimization_suggestions",
                        f"Applied {default_buffer}-minute buffer to task {next_task.get('id', 'unknown')}",
                        {
                            'task_id': next_task.get('id'),
                            'buffer_minutes': default_buffer,
                            'new_start': buffer_needed
                        }
                    )

        return simulation_data

    def _generate_transparency_data(self, simulation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate transparency data for the validation process"""
        transparency_data = {
            'validation_process': {
                'configuration_loaded': {
                    'constraint_config': bool(self.constraint_config),
                    'maintenance_rules': bool(self.maintenance_rules)
                },
                'processing_steps': {
                    'resource_flow_validation': True,
                    'maintenance_insertion': True,
                    'conflict_resolution': True,
                    'buffer_time_application': True
                },
                'resource_timeline': self._export_resource_timeline(),
                'validation_statistics': self._get_validation_statistics()
            },
            'business_readiness': self._assess_business_readiness(),
            'recommendations': self._generate_recommendations()
        }

        simulation_data['validation_transparency'] = transparency_data
        return simulation_data

    def _generate_validation_summary(self, processing_time: float) -> ValidationSummary:
        """Generate a summary of validation results"""
        categorized_results = {
            'critical_errors': 0,
            'resource_issues': 0,
            'scheduling_conflicts': 0,
            'optimization_suggestions': 0
        }

        for result in self.validation_results:
            if result.category in categorized_results:
                categorized_results[result.category] += 1

        business_readiness = self._assess_business_readiness()

        return ValidationSummary(
            total_issues=len(self.validation_results),
            critical_errors=categorized_results['critical_errors'],
            resource_issues=categorized_results['resource_issues'],
            scheduling_conflicts=categorized_results['scheduling_conflicts'],
            optimization_suggestions=categorized_results['optimization_suggestions'],
            business_readiness_score=business_readiness['score'],
            business_readiness_level=business_readiness['level'],
            processing_time=processing_time,
            timestamp=datetime.now().isoformat()
        )

    def _assess_business_readiness(self) -> Dict[str, Any]:
        """Assess business readiness based on validation results"""
        readiness_config = self.constraint_config.get('business_readiness', {})
        thresholds = readiness_config.get('readiness_thresholds', {})

        # Count issues by category
        issue_counts = {
            'critical_errors': 0,
            'resource_issues': 0,
            'scheduling_conflicts': 0
        }

        for result in self.validation_results:
            if result.category in issue_counts:
                issue_counts[result.category] += 1

        # Determine readiness level
        for level, threshold in thresholds.items():
            if (issue_counts['critical_errors'] <= threshold.get('max_critical_errors', 0) and
                issue_counts['resource_issues'] <= threshold.get('max_resource_issues', 0) and
                issue_counts['scheduling_conflicts'] <= threshold.get('max_scheduling_conflicts', 0)):
                return {
                    'level': level,
                    'score': threshold.get('score', 0),
                    'issue_counts': issue_counts,
                    'description': self._get_readiness_description(level)
                }

        return {
            'level': 'critical',
            'score': 0,
            'issue_counts': issue_counts,
            'description': 'Simulation has critical issues preventing business use'
        }

    def _get_readiness_description(self, level: str) -> str:
        """Get description for readiness level"""
        descriptions = {
            'excellent': 'Simulation is business-ready with no significant issues',
            'good': 'Simulation is business-ready with minor issues that can be addressed',
            'acceptable': 'Simulation is usable but has issues that should be reviewed',
            'needs_improvement': 'Simulation has significant issues that need attention',
            'critical': 'Simulation has critical issues preventing business use'
        }
        return descriptions.get(level, 'Unknown readiness level')

    def _generate_recommendations(self) -> List[Dict[str, Any]]:
        """Generate recommendations based on validation results"""
        recommendations = []

        # Analyze patterns in validation results
        error_patterns = {}
        for result in self.validation_results:
            if result.category not in error_patterns:
                error_patterns[result.category] = []
            error_patterns[result.category].append(result)

        # Generate category-specific recommendations
        if 'resource_issues' in error_patterns:
            recommendations.append({
                'category': 'resource_management',
                'priority': 'high',
                'title': 'Review Resource Planning',
                'description': 'Multiple resource availability issues detected. Consider increasing starting stocks or adjusting consumption rates.',
                'issue_count': len(error_patterns['resource_issues'])
            })

        if 'scheduling_conflicts' in error_patterns:
            recommendations.append({
                'category': 'scheduling',
                'priority': 'medium',
                'title': 'Optimize Task Scheduling',
                'description': 'Scheduling conflicts detected. Consider adding buffer time or redistributing tasks among actors.',
                'issue_count': len(error_patterns['scheduling_conflicts'])
            })

        return recommendations

    # Helper methods
    def _add_validation_result(self, result_id: str, severity: ValidationSeverity,
                             category: str, message: str, details: Dict[str, Any] = None) -> None:
        """Add a validation result"""
        self.validation_results.append(ValidationResult(
            id=result_id,
            severity=severity,
            category=category,
            message=message,
            details=details or {}
        ))

    def _record_resource_state(self, resource_id: str, quantity: float, timestamp: str,
                             task_id: str, action: str) -> None:
        """Record resource state change"""
        if resource_id not in self.resource_timeline:
            self.resource_timeline[resource_id] = []

        self.resource_timeline[resource_id].append(ResourceState(
            resource_id=resource_id,
            quantity=quantity,
            timestamp=timestamp,
            consumed_by=task_id if action == 'consumed' else None,
            produced_by=task_id if action == 'produced' else None
        ))

    def _parse_time(self, time_str: str) -> int:
        """Parse time string to minutes since midnight"""
        try:
            hours, minutes = map(int, time_str.split(':'))
            return hours * 60 + minutes
        except (ValueError, AttributeError):
            return 0

    def _add_minutes_to_time(self, time_str: str, minutes: int) -> str:
        """Add minutes to time string"""
        total_minutes = self._parse_time(time_str) + minutes
        hours = total_minutes // 60
        mins = total_minutes % 60
        return f"{hours:02d}:{mins:02d}"

    def _get_starting_stock(self, simulation_data: Dict[str, Any], resource_id: str) -> float:
        """Get starting stock for a resource"""
        for resource in simulation_data.get('resources', []):
            if resource['id'] == resource_id:
                return resource.get('starting_stock', 0.0)
        return 0.0

    def _find_available_actor(self, simulation_data: Dict[str, Any], start_time: str,
                            duration: int, required_roles: List[str]) -> Optional[str]:
        """Find an available actor for a task"""
        # Get all actors with suitable roles
        suitable_actors = []
        for actor in simulation_data.get('actors', []):
            if actor.get('role', '').lower() in [role.lower() for role in required_roles]:
                suitable_actors.append(actor['id'])

        # Check availability
        for actor_id in suitable_actors:
            if self._is_time_slot_available(simulation_data, actor_id, start_time, duration):
                return actor_id

        return None

    def _is_time_slot_available(self, simulation_data: Dict[str, Any], actor_id: str,
                              start_time: str, duration: int) -> bool:
        """Check if time slot is available for actor"""
        start_minutes = self._parse_time(start_time)
        end_minutes = start_minutes + duration

        for task in simulation_data.get('tasks', []):
            if task.get('actor_id') == actor_id:
                task_start = self._parse_time(task.get('start', '00:00'))
                task_end = task_start + task.get('duration', 0)

                # Check for overlap
                if not (end_minutes <= task_start or start_minutes >= task_end):
                    return False

        return True

    def _add_cleaning_supplies(self, simulation_data: Dict[str, Any]) -> None:
        """Add required cleaning supplies to resources if not present"""
        cleaning_supplies = self.maintenance_rules.get('maintenance_rules', {}).get('cleaning_supplies', {})

        existing_resources = {r['id'] for r in simulation_data.get('resources', [])}

        for supply_id, supply_config in cleaning_supplies.items():
            if supply_id not in existing_resources:
                # Add the cleaning supply as a resource
                simulation_data.setdefault('resources', []).append({
                    'id': supply_id,
                    'unit': supply_config.get('unit', 'unit'),
                    'starting_stock': supply_config.get('starting_stock', 10.0),
                    'cost_per_unit': supply_config.get('cost_per_unit', 1.0),
                    'auto_added': True,
                    'category': 'cleaning_supply'
                })

    def _export_resource_timeline(self) -> Dict[str, Any]:
        """Export resource timeline for transparency"""
        timeline_data = {}

        for resource_id, states in self.resource_timeline.items():
            timeline_data[resource_id] = [
                {
                    'quantity': state.quantity,
                    'timestamp': state.timestamp,
                    'consumed_by': state.consumed_by,
                    'produced_by': state.produced_by
                }
                for state in states
            ]

        return timeline_data

    def _get_validation_statistics(self) -> Dict[str, Any]:
        """Get validation statistics for transparency"""
        stats = {
            'total_validations': len(self.validation_results),
            'by_severity': {
                'error': 0,
                'warning': 0,
                'info': 0
            },
            'by_category': {},
            'processing_summary': {
                'resource_flow_checked': True,
                'maintenance_tasks_inserted': True,
                'conflicts_resolved': True,
                'buffer_time_applied': True
            }
        }

        for result in self.validation_results:
            stats['by_severity'][result.severity.value] += 1

            if result.category not in stats['by_category']:
                stats['by_category'][result.category] = 0
            stats['by_category'][result.category] += 1

        return stats

    def get_validation_summary(self) -> Dict[str, Any]:
        """Get validation summary for external use"""
        return {
            'total_issues': len(self.validation_results),
            'issues_by_category': self._get_validation_statistics()['by_category'],
            'business_readiness': self._assess_business_readiness(),
            'has_critical_errors': any(r.severity == ValidationSeverity.ERROR for r in self.validation_results),
            'validation_results': [
                {
                    'id': r.id,
                    'severity': r.severity.value,
                    'category': r.category,
                    'message': r.message,
                    'details': r.details
                }
                for r in self.validation_results
            ]
        }

    def get_transparency_data(self) -> Dict[str, Any]:
        """Get transparency data for UI display"""
        return {
            'validation_process': {
                'steps_completed': [
                    'Resource Flow Validation',
                    'Maintenance Task Insertion',
                    'Scheduling Conflict Resolution',
                    'Buffer Time Application'
                ],
                'configuration_used': {
                    'constraint_config': bool(self.constraint_config),
                    'maintenance_rules': bool(self.maintenance_rules)
                },
                'resource_timeline': self._export_resource_timeline(),
                'validation_statistics': self._get_validation_statistics()
            },
            'business_readiness': self._assess_business_readiness(),
            'recommendations': self._generate_recommendations(),
            'validation_results': self.get_validation_summary()['validation_results']
        }
