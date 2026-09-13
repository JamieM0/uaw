// WorkSpec 2 project validation orchestration.
// Composes document, source, runtime/history, and Constraint validation without
// teaching the document validator about executable project sources.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./workspec-validator.js'), require('./workspec-runtime.js'));
    } else if (root) {
        root.WorkSpecProjectValidator = factory(root.WorkSpecValidator, root.WorkSpecRuntime);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (documentValidator, runtime) {
    'use strict';

    const NS = 'https://universalautomation.wiki/workspec';
    const plain = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const simOf = (documentValue) => plain(documentValue?.simulation) ? documentValue.simulation : documentValue;

    function scopedProblem(problem, fallbackScope, fallbackSource, forceFallback) {
        const scope = forceFallback ? fallbackScope : (problem?.scope || fallbackScope);
        const source = forceFallback ? fallbackSource : (problem?.provenance?.source || fallbackSource);
        return {
            ...(problem || {}),
            scope,
            provenance: { ...(problem?.provenance || {}), layer: scope, source }
        };
    }

    function sourceProblem(diagnostic) {
        const metricId = diagnostic.code || 'changes.source.invalid';
        return scopedProblem({
            type: `${NS}/errors/${metricId}`,
            title: metricId.split('.').map((part) => part.replace(/_/g, ' ')).join(' '),
            severity: diagnostic.severity || 'error',
            detail: diagnostic.message || metricId,
            instance: `/changes:${diagnostic.line || 1}:${diagnostic.column || 1}`,
            metric_id: metricId,
            context: diagnostic.taskId ? { task_id: diagnostic.taskId } : {},
            suggestions: []
        }, 'source', 'changes.workspec.js');
    }

    function orchestrationProblem(metricId, detail, scope, source, context) {
        return scopedProblem({
            type: `${NS}/errors/${metricId}`,
            title: metricId.split('.').map((part) => part.replace(/_/g, ' ')).join(' '),
            severity: 'error',
            detail,
            instance: `/${source.replace('.workspec.js', '')}`,
            metric_id: metricId,
            context: context || {},
            suggestions: []
        }, scope, source);
    }

    function constraintViolationProblem(violation) {
        const metricId = violation.constraint_id || 'runtime.constraint';
        return scopedProblem({
            type: `${NS}/errors/${metricId}`,
            title: metricId.split('.').map((part) => part.replace(/_/g, ' ')).join(' '),
            severity: ['warning', 'info'].includes(violation.severity) ? violation.severity : 'error',
            detail: violation.message || `Constraint '${metricId}' was violated.`,
            instance: `/constraints/${metricId.replace(/~/g, '~0').replace(/\//g, '~1')}`,
            metric_id: metricId,
            context: {
                time: violation.time,
                objects: violation.objects || [],
                ...(violation.property ? { property: violation.property } : {}),
                ...(Object.prototype.hasOwnProperty.call(violation, 'observed') ? { observed: violation.observed } : {}),
                ...(Object.prototype.hasOwnProperty.call(violation, 'expected') ? { expected: violation.expected } : {})
            },
            suggestions: [],
            violation
        }, 'constraint', 'constraints.workspec.js');
    }

    function dedupeProblems(problems) {
        const seen = new Set();
        return problems.filter((problem) => {
            const key = `${problem.metric_id}|${problem.instance}|${problem.detail}|${problem.scope}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    const problemIdentity = (problem) => `${problem?.metric_id}|${problem?.instance}|${problem?.detail}`;

    function baseType(type, definitions, seen = new Set()) {
        if (!type || seen.has(type)) return type || '';
        if (['actor', 'equipment', 'resource', 'product', 'service', 'display', 'screen_element', 'digital_object'].includes(type)) return type;
        seen.add(type);
        return baseType(definitions?.[type]?.extends, definitions, seen);
    }

    function boundedUnusedResourceProblems(startingState, run, until) {
        if (!Number.isFinite(until)) return [];
        const sim = simOf(startingState) || {};
        const objects = Array.isArray(sim.world?.objects) ? sim.world.objects : [];
        const definitions = plain(sim.type_definitions) ? sim.type_definitions : {};
        const used = run?.state?.usage instanceof Set ? run.state.usage : new Set();
        return objects.flatMap((object, index) => {
            if (!plain(object) || baseType(object.type, definitions) !== 'resource' || used.has(object.id)) return [];
            const metricId = 'object.optimization.unused_resource';
            return [scopedProblem({
                type: `${NS}/errors/${metricId}`,
                title: 'Resource Unused During Bounded Run',
                severity: 'info',
                detail: `Resource '${object.id}' was not used during the resolved run through minute ${until}.`,
                instance: `/simulation/world/objects/${index}`,
                metric_id: metricId,
                context: { object_id: object.id, horizon_minutes: until },
                suggestions: ['Confirm the validation horizon covers the intended process, or reference the resource from an executed task effect or reservation.']
            }, 'runtime', 'resolved-history')];
        });
    }

    function validateProject(startingState, options = {}) {
        if (!documentValidator?.validate || !runtime?.runProject || !runtime?.analyzeChanges) {
            throw new Error('WorkSpec project validation requires the canonical document validator and runtime.');
        }

        const changesSource = typeof options.changesSource === 'string' ? options.changesSource : '';
        const generatorSource = typeof options.generatorSource === 'string' ? options.generatorSource : '';
        const constraintsSource = typeof options.constraintsSource === 'string' ? options.constraintsSource : '';
        const seed = options.seed ?? 1;
        const until = Number.isFinite(options.until) ? options.until : undefined;
        const document = documentValidator.validate(startingState);
        const declarativeProblems = runtime.validateSource
            ? runtime.validateSource(startingState).map((problem) => scopedProblem(problem, 'document', 'start.workspec.json', true))
            : [];
        const taskIds = (simOf(startingState)?.process?.tasks || []).map((task) => task?.id).filter(Boolean);
        const changesAnalysis = runtime.analyzeChanges(changesSource, { taskIds });
        let problems = [
            ...(document.problems || []).map((problem) => scopedProblem(problem, 'document', 'start.workspec.json')),
            ...declarativeProblems,
            ...changesAnalysis.diagnostics.map(sourceProblem)
        ];

        let run = null;
        let constraintResult = null;
        const documentHasErrors = problems.some((problem) => problem.scope === 'document' && problem.severity === 'error');
        if (!documentHasErrors) {
            try {
                run = runtime.runProject(startingState, changesSource, generatorSource, {
                    seed,
                    ...(until === undefined ? {} : { until }),
                    ...(Number.isInteger(options.maxEvents) ? { maxEvents: options.maxEvents } : {})
                });
                const declarativeIdentities = new Set(declarativeProblems.map(problemIdentity));
                const sourceIdentities = new Set((run.sourceProblems || []).map(problemIdentity));
                run.problems.forEach((problem) => {
                    const identity = problemIdentity(problem);
                    if (declarativeIdentities.has(identity)) return;
                    if (sourceIdentities.has(identity)) {
                        problems.push(scopedProblem(problem, 'source', 'changes.workspec.js', true));
                    } else {
                        problems.push(scopedProblem(problem, 'runtime', 'resolved-history'));
                    }
                });
                problems.push(...boundedUnusedResourceProblems(startingState, run, until));
            } catch (error) {
                problems.push(orchestrationProblem('changes.compile.failed', error?.message || String(error), 'source', 'changes.workspec.js'));
            }

            if (run && constraintsSource.trim() && runtime.runConstraintsOnResult) {
                constraintResult = runtime.runConstraintsOnResult(run, constraintsSource, until === undefined ? {} : { time: until });
                const runProblemIdentities = new Set(run.problems.map(problemIdentity));
                problems.push(...constraintResult.problems
                    .filter((problem) => !runProblemIdentities.has(problemIdentity(problem)))
                    .map((problem) => scopedProblem(problem, 'runtime', 'resolved-history')));
                problems.push(...constraintResult.violations.map(constraintViolationProblem));
            }
        }

        problems = dedupeProblems(problems).map((entry) => ({
            ...entry,
            provenance: {
                ...(entry.provenance || {}),
                validation_mode: 'project',
                seed,
                horizon: until === undefined ? 'natural_end' : until
            }
        }));
        return {
            ok: problems.every((problem) => problem.severity !== 'error'),
            validationMode: 'project',
            problems,
            document,
            changesAnalysis,
            run,
            state: run ? runtime.serialiseState(run) : null,
            history: run?.history || [],
            usage: run?.state?.usage instanceof Set ? [...run.state.usage].sort() : [],
            violations: constraintResult?.violations || [],
            time: constraintResult?.time ?? until ?? null,
            horizon: until === undefined ? null : { until, unit: 'minutes', explicit: true },
            seed
        };
    }

    return { validateProject };
}));
