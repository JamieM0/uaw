// WorkSpec application clock and calendar-scale navigator.
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.WorkSpecTime = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const MINUTE = 60 * 1000;
    const DAY_MINUTES = 24 * 60;
    const SCALES = ['day', 'week', 'month'];
    const PLAYBACK_MINUTES_PER_SECOND = 5;
    const SCALE_RATES = {
        day: PLAYBACK_MINUTES_PER_SECOND,
        week: PLAYBACK_MINUTES_PER_SECOND,
        month: PLAYBACK_MINUTES_PER_SECOND
    };
    const SCRUB_MARK_INTERVAL_MINUTES = 15;
    const SCRUB_SNAP_TOLERANCE_MINUTES = 1.5;

    const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    function timeOfDayMinutes(value) {
        if (typeof value !== 'string') return null;
        const match = value.trim().match(/^(?:\d{4}-\d{2}-\d{2}T)?(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
        if (!match) return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        return hours <= 23 && minutes <= 59 ? (hours * 60) + minutes : null;
    }

    function durationMinutes(value, unit = 'minutes') {
        if (typeof value === 'number' && Number.isFinite(value)) {
            if (unit === 'seconds') return value / 60;
            if (unit === 'hours') return value * 60;
            return value;
        }
        if (typeof value !== 'string') return 0;
        const shorthand = value.trim().match(/^(\d+(?:\.\d+)?)\s*([smhdwM])$/);
        if (shorthand) {
            const amount = Number(shorthand[1]);
            return amount * ({ s: 1 / 60, m: 1, h: 60, d: DAY_MINUTES, w: 7 * DAY_MINUTES, M: 30 * DAY_MINUTES }[shorthand[2]] || 1);
        }
        const iso = value.trim().toUpperCase().match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
        if (!iso) return 0;
        return (finite(iso[1]) * 365 * DAY_MINUTES) + (finite(iso[2]) * 30 * DAY_MINUTES)
            + (finite(iso[3]) * DAY_MINUTES) + (finite(iso[4]) * 60) + finite(iso[5]) + (finite(iso[6]) / 60);
    }

    function readDateExpression(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value);
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return new Date(`${trimmed}T00:00:00`);
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function zonedInstant(year, monthIndex, day, minutes, timeZone) {
        if (!timeZone) return new Date(year, monthIndex, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
        const desiredAsUtc = Date.UTC(year, monthIndex, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
        let guess = desiredAsUtc;
        try {
            const formatter = new Intl.DateTimeFormat('en-GB', {
                timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            });
            // Two passes cover daylight-saving offsets around the guessed UTC time.
            for (let pass = 0; pass < 2; pass += 1) {
                const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
                const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
                guess += desiredAsUtc - representedAsUtc;
            }
            return new Date(guess);
        } catch (_error) {
            return new Date(year, monthIndex, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
        }
    }

    function createClockContext(simulation, rawTasks = [], now = new Date()) {
        const config = simulation?.config || {};
        const legacyConfig = simulation?.simulation_config || {};
        const configuredStart = config.start_time;
        const startClock = timeOfDayMinutes(configuredStart) ?? 0;
        let startInstant = typeof configuredStart === 'string' && configuredStart.includes('T')
            ? readDateExpression(configuredStart)
            : null;
        let calendarDate = readDateExpression(legacyConfig.start_date || simulation?.calendar?.start_date);

        if (!startInstant && calendarDate) {
            startInstant = zonedInstant(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate(), startClock, config.timezone);
        }

        if (!startInstant) {
            const isoStarts = rawTasks
                .map(task => typeof task?.start === 'string' && task.start.includes('T') ? readDateExpression(task.start) : null)
                .filter(Boolean)
                .sort((a, b) => a - b);
            if (isoStarts.length) {
                calendarDate = new Date(isoStarts[0]);
                calendarDate.setHours(0, 0, 0, 0);
                startInstant = new Date(calendarDate.getTime() + (startClock * MINUTE));
            }
        }

        if (!startInstant) {
            calendarDate = new Date(now);
            startInstant = zonedInstant(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate(), startClock, config.timezone);
        }

        const anchorInstant = new Date(startInstant.getTime() - (startClock * MINUTE));
        return {
            anchorMillis: anchorInstant.getTime(),
            startMinutes: startClock,
            locale: config.locale || 'en-GB',
            timeZone: config.timezone || undefined
        };
    }

    function taskStartMinutes(value, clock) {
        if (value && typeof value === 'object') {
            const day = Math.max(1, finite(value.day, 1));
            const time = timeOfDayMinutes(value.time);
            return ((day - 1) * DAY_MINUTES) + (time ?? clock.startMinutes);
        }
        if (typeof value === 'string' && value.includes('T')) {
            const date = readDateExpression(value);
            if (date) return (date.getTime() - clock.anchorMillis) / MINUTE;
        }
        return timeOfDayMinutes(value) ?? clock.startMinutes;
    }

    function taskObjectIds(task) {
        const ids = new Set([task?.actor_id].filter(Boolean));
        (task?.interactions || []).forEach(interaction => {
            [interaction?.target_id, interaction?.object_id].filter(Boolean).forEach(id => ids.add(id));
            (interaction?.remove_objects || []).forEach(id => ids.add(typeof id === 'string' ? id : id?.id));
            (interaction?.add_objects || []).forEach(object => ids.add(typeof object === 'string' ? object : object?.id));
            if (interaction?.object?.id) ids.add(interaction.object.id);
            if (interaction?.move_digital_object?.object_id) ids.add(interaction.move_digital_object.object_id);
            if (interaction?.move_display_element?.element_id) ids.add(interaction.move_display_element.element_id);
        });
        Object.keys(task?.consumes || {}).forEach(id => ids.add(id));
        Object.keys(task?.produces || {}).forEach(id => ids.add(id));
        ids.delete(undefined);
        return Array.from(ids);
    }

    function normalizeTask(task, clock, unit, offset = 0, suffix = '') {
        const start = task.start_minutes != null ? finite(task.start_minutes) : taskStartMinutes(task.start, clock) + offset;
        const duration = task.duration_minutes != null ? finite(task.duration_minutes) : durationMinutes(task.duration, unit);
        return {
            ...task,
            id: `${task.id || 'task'}${suffix}`,
            source_id: task.source_id || task.id || '',
            start_minutes: start,
            end_minutes: task.end_minutes != null ? finite(task.end_minutes) : start + duration,
            duration_minutes: duration,
            object_ids: taskObjectIds(task),
            location_id: task.location_id || task.location || ''
        };
    }

    function normalizeDocument(documentValue, options = {}) {
        const simulation = documentValue?.simulation || documentValue || {};
        const canonicalTasks = simulation.process?.tasks || simulation.tasks || [];
        const clock = createClockContext(simulation, canonicalTasks, options.now);
        const unit = simulation.config?.time_unit || 'minutes';
        const authoritativeRun = simulation.schema_version === '2.1' && root.WorkSpecRuntime?.replay
            ? root.WorkSpecRuntime.replay(documentValue?.simulation ? documentValue : { simulation })
            : null;
        const tasksToNormalize = authoritativeRun ? [...authoritativeRun.index.tasks.values()] : canonicalTasks;
        let tasks = tasksToNormalize.map(task => {
            const timing = authoritativeRun?.timings?.get(task.id);
            const runtimeRecord = authoritativeRun?.state?.taskRuntime?.get(task.id) || {};
            return timing?.resolved
                ? normalizeTask({
                    ...task,
                    actor_id: runtimeRecord.selected_actor_id || task.actor_id,
                    start_minutes: timing.start,
                    end_minutes: timing.end,
                    duration_minutes: timing.duration,
                    start_source: timing.source,
                    runtime_status: authoritativeRun.state.statuses.get(task.id),
                    actual_end_minutes: runtimeRecord.actual_end,
                    captured_progress: runtimeRecord.progress
                }, clock, unit)
                : (authoritativeRun ? null : normalizeTask(task, clock, unit));
        }).filter(Boolean);

        // Legacy repeating calendars are expanded into the same absolute clock.
        if (!tasks.length && simulation.day_types && simulation.calendar && root.MultiDaySimulator) {
            try {
                const simulator = new root.MultiDaySimulator({ simulation });
                for (let day = 1; day <= simulator.getTotalDays(); day += 1) {
                    const definition = simulator.getDayTypeDefinition(simulator.getDayTypeForDay(day));
                    (definition?.tasks || []).forEach(task => {
                        tasks.push(normalizeTask(task, clock, definition?.config?.time_unit || unit, (day - 1) * DAY_MINUTES, `::day-${day}`));
                    });
                }
            } catch (error) {
                console.warn('WORKSPEC-TIME: Could not expand repeating calendar.', error);
            }
        }

        const canonicalObjects = simulation.world?.objects || [];
        const legacyObjects = ['objects', 'actors', 'resources', 'equipment', 'tools', 'products']
            .flatMap(key => Array.isArray(simulation[key]) ? simulation[key] : []);
        const dayObjects = Object.values(simulation.day_types || {}).flatMap(value => value?.objects || []);
        const digitalObjects = [
            ...(simulation.digital_space?.digital_locations || []),
            ...(simulation.digital_space?.digital_objects || [])
        ];
        const displayObjects = (simulation.displays || simulation.world?.displays || [])
            .flatMap(display => [display, ...(display?.rectangles || [])]);
        const interactionObjects = tasks.flatMap(task => (task.interactions || []).flatMap(interaction => [
            interaction?.object,
            ...((interaction?.add_objects || []).filter(item => item && typeof item === 'object'))
        ])).filter(object => object?.id);
        const objects = [...new Map([...canonicalObjects, ...legacyObjects, ...dayObjects, ...digitalObjects, ...displayObjects, ...interactionObjects]
            .filter(object => object?.id).map(object => [object.id, object])).values()];
        const locations = simulation.world?.layout?.locations || simulation.layout?.locations || simulation.locations || [];
        const configEnd = simulation.config?.end_time;
        const configuredEnd = configEnd ? taskStartMinutes(configEnd, clock) : null;
        const first = tasks.length ? Math.min(...tasks.map(task => task.start_minutes)) : clock.startMinutes;
        const last = tasks.length ? Math.max(...tasks.map(task => task.end_minutes)) : (configuredEnd ?? first + 60);

        return {
            simulation,
            documentValue: documentValue?.simulation ? documentValue : { simulation },
            authoritativeRun,
            clock,
            tasks: tasks.sort((a, b) => a.start_minutes - b.start_minutes),
            objects,
            locations,
            startMinutes: Math.min(clock.startMinutes, first),
            endMinutes: Math.max(configuredEnd ?? 0, last, first + 1)
        };
    }

    function taskState(task, time, model) {
        if (model?.authoritativeRun && model.documentValue && root.WorkSpecRuntime?.snapshotAt) {
            const status = root.WorkSpecRuntime.snapshotAt(model.documentValue, time).task_statuses?.[task.source_id || task.id];
            if (status) return status;
        }
        if (time < task.start_minutes) return 'upcoming';
        if (time >= task.end_minutes) return 'completed';
        return 'active';
    }

    function buildSnapshot(model, time) {
        const taskStates = new Map();
        const objectUsage = new Map();
        const locationUsage = new Map();
        model.tasks.forEach(task => {
            const state = taskState(task, time, model);
            taskStates.set(task.id, state);
            if (task.source_id) taskStates.set(task.source_id, state);
            task.object_ids.forEach(id => {
                if (!objectUsage.has(id)) objectUsage.set(id, []);
                objectUsage.get(id).push({ task, state });
            });
            if (task.location_id) {
                if (!locationUsage.has(task.location_id)) locationUsage.set(task.location_id, []);
                locationUsage.get(task.location_id).push({ task, state });
            }
        });
        const usageState = (usage = []) => {
            if (usage.some(item => item.state === 'active')) return 'active';
            if (usage.length && usage.every(item => item.state === 'upcoming')) return 'upcoming';
            if (usage.length && usage.every(item => ['completed', 'interrupted', 'skipped', 'blocked'].includes(item.state))) return 'completed';
            return 'inactive';
        };
        return {
            time,
            taskStates,
            objectStates: new Map(model.objects.map(object => [object.id, usageState(objectUsage.get(object.id))])),
            locationStates: new Map(model.locations.map(location => [location.id, usageState(locationUsage.get(location.id))])),
            activeTasks: model.tasks.filter(task => taskState(task, time, model) === 'active'),
            completedTasks: model.tasks.filter(task => taskState(task, time, model) === 'completed'),
            interruptedTasks: model.tasks.filter(task => taskState(task, time, model) === 'interrupted'),
            upcomingTasks: model.tasks.filter(task => ['upcoming', 'pending'].includes(taskState(task, time, model)))
        };
    }

    function dateForMinutes(clock, minutes) {
        return new Date(clock.anchorMillis + (minutes * MINUTE));
    }

    class WorkSpecTimeController {
        constructor() {
            this.scale = 'day';
            this.model = null;
            this.currentTime = 0;
            this.player = null;
            this.snapshot = null;
            this.mutationFrame = null;
            this.temporalOrders = new WeakMap();
            this.lastBoundaryIndex = -1;
            this.lastUiPaint = 0;
            this.lastStatePaint = 0;
        }

        initialize() {
            if (typeof document === 'undefined' || this.initialized) return;
            this.initialized = true;
            try {
                const saved = localStorage.getItem('workspec:time-scale');
                if (SCALES.includes(saved)) this.scale = saved;
            } catch (_error) { /* Preferences are optional. */ }
            this.createNavigator();
            this.bindUI();
            this.syncFromEditor();
            this.observeRenderers();
        }

        bindUI() {
            document.getElementById('player-time-button')?.addEventListener('click', () => this.toggleNavigator());
            document.getElementById('player-play-pause-btn')?.addEventListener('click', () => {
                if (!this.player) this.toggleStandalonePlayback();
            });
            window.addEventListener('uaw:editor-ready', event => {
                event.detail.editor.onDidChangeModelContent(() => {
                    clearTimeout(this.editorTimer);
                    this.editorTimer = setTimeout(() => this.syncFromEditor(), 350);
                });
                this.syncFromEditor();
            });
            window.addEventListener('uaw:project-opened', () => setTimeout(() => this.syncFromEditor(), 0));
            document.addEventListener('simulation-rendered', () => {
                this.syncFromEditor({ preserveTime: true });
                if (root.player) this.attachPlayer(root.player);
            });
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && this.navigator && !this.navigator.hidden) this.closeNavigator();
            });
        }

        readEditorDocument() {
            const editor = root.monacoEditor || root.editor;
            if (!editor?.getValue) return null;
            try { return JSON.parse(editor.getValue()); }
            catch (_error) { return null; }
        }

        syncFromEditor(options = {}) {
            const documentValue = this.readEditorDocument();
            if (!documentValue) return;
            this.configure(normalizeDocument(documentValue), options);
        }

        configure(model, options = {}) {
            const previous = this.currentTime;
            this.model = model;
            this.boundaries = [...new Set(model.tasks.flatMap(task => [task.start_minutes, task.end_minutes, task.actual_end_minutes].filter(Number.isFinite)))].sort((a, b) => a - b);
            this.lastBoundaryIndex = -1;
            this.createFormatters();
            const desired = options.preserveTime !== false && Number.isFinite(previous) ? previous : model.startMinutes;
            this.currentTime = clamp(desired, model.startMinutes, model.endMinutes);
            this.renderRange();
            this.commit(this.currentTime, { source: 'configure' });
        }

        attachPlayer(player) {
            if (this.standalonePlaying) this.toggleStandalonePlayback();
            this.player = player;
            if (!this.model) this.syncFromEditor();
            const min = player?.simData?.start_time_minutes;
            const max = player?.simData?.end_time_minutes;
            if (Number.isFinite(min) && Number.isFinite(max) && (this.currentTime < min || this.currentTime > max)) {
                this.currentTime = min;
            }
        }

        detachPlayer(player) {
            if (this.player === player) this.player = null;
        }

        toggleStandalonePlayback() {
            if (!this.model) return;
            this.standalonePlaying = !this.standalonePlaying;
            const button = document.getElementById('player-play-pause-btn');
            if (button) {
                button.innerHTML = this.standalonePlaying
                    ? '<span class="player-control-icon" aria-hidden="true">Ⅱ</span><span class="player-control-label">Pause</span>'
                    : '<span class="player-control-icon" aria-hidden="true">▶</span><span class="player-control-label">Play</span>';
                button.setAttribute('aria-label', this.standalonePlaying ? 'Pause simulation' : 'Play or pause simulation');
            }
            if (!this.standalonePlaying) {
                cancelAnimationFrame(this.standaloneFrame);
                return;
            }
            if (this.currentTime >= this.model.endMinutes) this.commit(this.model.startMinutes, { source: 'playback' });
            this.standaloneLastFrame = performance.now();
            const tick = timestamp => {
                if (!this.standalonePlaying || this.player) return;
                const elapsed = (timestamp - this.standaloneLastFrame) / 1000;
                this.standaloneLastFrame = timestamp;
                const speed = finite(document.getElementById('player-speed-select')?.value, 1);
                const next = Math.min(this.model.endMinutes, this.currentTime + (elapsed * this.getMinutesPerSecond() * speed));
                this.commit(next, { source: 'playback' });
                if (next >= this.model.endMinutes) {
                    this.toggleStandalonePlayback();
                    return;
                }
                this.standaloneFrame = requestAnimationFrame(tick);
            };
            this.standaloneFrame = requestAnimationFrame(tick);
        }

        setTime(value, options = {}) {
            if (!this.model) return;
            const next = clamp(finite(value, this.currentTime), this.model.startMinutes, this.model.endMinutes);
            if (options.source !== 'player' && this.player && !this.syncingPlayer) {
                const min = this.player.simData?.start_time_minutes;
                const max = this.player.simData?.end_time_minutes;
                if (next >= min && next <= max) {
                    this.syncingPlayer = true;
                    this.player.update(next, { source: 'global-clock' });
                    this.syncingPlayer = false;
                    return;
                }
            }
            this.commit(next, options);
        }

        commit(time, options = {}) {
            if (!this.model) return;
            this.currentTime = clamp(time, this.model.startMinutes, this.model.endMinutes);
            const boundaryIndex = this.getBoundaryIndex(this.currentTime);
            const stateChanged = !this.snapshot || boundaryIndex !== this.lastBoundaryIndex;
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const continuousPlayback = options.source === 'player' || options.source === 'playback';
            const force = options.force === true;
            const shouldRefreshState = stateChanged && (force || !continuousPlayback || (now - this.lastStatePaint) >= 80);
            const shouldPaintClock = force || !continuousPlayback || (now - this.lastUiPaint) >= 100;

            if (shouldRefreshState) {
                this.snapshot = buildSnapshot(this.model, this.currentTime);
                this.lastBoundaryIndex = boundaryIndex;
                this.lastStatePaint = now;
                this.applyTemporalState();
            }
            if (shouldPaintClock) {
                this.lastUiPaint = now;
                this.updateTimeDisplays();
                this.updateNavigatorTime();
            }
            if (shouldRefreshState || shouldPaintClock) {
                window.dispatchEvent(new CustomEvent('workspec:time-change', {
                    detail: { time: this.currentTime, date: this.getCurrentDate(), scale: this.scale, snapshot: this.snapshot, source: options.source || 'clock' }
                }));
            }
        }

        getBoundaryIndex(time) {
            let low = 0;
            let high = this.boundaries?.length || 0;
            while (low < high) {
                const middle = (low + high) >> 1;
                if (this.boundaries[middle] <= time) low = middle + 1;
                else high = middle;
            }
            return low;
        }

        setScale(scale) {
            if (!SCALES.includes(scale)) return;
            this.scale = scale;
            try { localStorage.setItem('workspec:time-scale', scale); } catch (_error) { /* optional */ }
            this.renderRange();
            this.navigator?.querySelectorAll('[data-time-scale]').forEach(button => {
                const active = button.dataset.timeScale === scale;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });
            window.dispatchEvent(new CustomEvent('workspec:time-scale-change', { detail: { scale } }));
        }

        getMinutesPerSecond() { return PLAYBACK_MINUTES_PER_SECOND; }
        getCurrentDate() { return this.model ? dateForMinutes(this.model.clock, this.currentTime) : null; }

        createFormatters() {
            const locale = this.model?.clock?.locale || 'en-GB';
            const timeZone = this.model?.clock?.timeZone;
            const withZone = options => timeZone ? { ...options, timeZone } : options;
            try {
                this.dateFormatter = new Intl.DateTimeFormat(locale, withZone({ day: 'numeric', month: 'short', year: 'numeric' }));
                this.timeFormatter = new Intl.DateTimeFormat(locale, withZone({ hour: '2-digit', minute: '2-digit' }));
            } catch (_error) {
                this.dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                this.timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
            }
        }

        formatDate(minutes = this.currentTime, options = {}) {
            if (!this.model) return 'Select time';
            const date = dateForMinutes(this.model.clock, minutes);
            const format = {
                day: 'numeric', month: options.short ? 'short' : 'long', year: 'numeric',
                ...(options.includeTime === false ? {} : { hour: '2-digit', minute: '2-digit' })
            };
            if (this.model.clock.timeZone) format.timeZone = this.model.clock.timeZone;
            try { return new Intl.DateTimeFormat(this.model.clock.locale || 'en-GB', format).format(date); }
            catch (_error) { return new Intl.DateTimeFormat('en-GB', format).format(date); }
        }

        updateTimeDisplays() {
            const dateDisplay = document.getElementById('player-current-date');
            const timeDisplay = document.getElementById('player-current-time');
            const date = this.getCurrentDate();
            if (!date) return;
            if (dateDisplay) dateDisplay.textContent = this.dateFormatter.format(date);
            if (timeDisplay) timeDisplay.textContent = this.timeFormatter.format(date);
            const liveLabel = `${this.dateFormatter.format(date)}, ${this.timeFormatter.format(date)}`;
            document.querySelectorAll('.live-time').forEach(span => { span.textContent = liveLabel; });
        }

        stateElement(element, state) {
            if (!element) return;
            if (state) element.dataset.temporalState = state;
            else delete element.dataset.temporalState;
            if (state) element.setAttribute('data-time-label', state);
            const badge = element.querySelector?.('.uaw-temporal-badge');
            if (badge && state) {
                badge.textContent = state[0].toUpperCase() + state.slice(1);
                badge.dataset.temporalState = state;
            }
        }

        applyTemporalState() {
            if (!this.snapshot || typeof document === 'undefined') return;
            document.querySelectorAll('.task-block, [data-context-task-id]').forEach(element => {
                const id = element.dataset.taskId || element.dataset.contextTaskId;
                const state = this.snapshot.taskStates.get(id) || 'inactive';
                this.stateElement(element, state);
                element.classList.toggle('active', state === 'active');
                element.classList.toggle('completed', state === 'completed');
                element.classList.toggle('interrupted', state === 'interrupted');
                element.classList.toggle('blocked', state === 'blocked');
                element.classList.toggle('skipped', state === 'skipped');
                element.setAttribute('aria-current', state === 'active' ? 'step' : 'false');
            });
            document.querySelectorAll('[data-object-row], .resource-item[data-object-id], .object-item[data-object-id], .digital-object-visual[data-object-id], .actor-label[data-object-id], [data-element-id]').forEach(element => {
                const id = element.dataset.objectId || element.dataset.contextObjectId || element.dataset.elementId;
                this.stateElement(element, this.snapshot.objectStates.get(id) || 'inactive');
            });
            document.querySelectorAll('.location-rect[data-id], [data-location-id]').forEach(element => {
                const id = element.dataset.id || element.dataset.locationId;
                this.stateElement(element, this.snapshot.locationStates.get(id) || 'inactive');
            });
            document.querySelectorAll('.calendar-day-cell[data-day], .week-day-header[data-day], .week-day-column[data-day]').forEach(element => {
                const selectedDay = Math.floor(this.currentTime / DAY_MINUTES) + 1;
                const day = finite(element.dataset.day, selectedDay);
                this.stateElement(element, day === selectedDay ? 'active' : day < selectedDay ? 'completed' : 'upcoming');
            });
            this.promoteActiveItems();
        }

        promoteActiveItems() {
            const groups = [
                ['#uaw-process-view tbody', ':scope > tr[data-context-task-id]'],
                ['#uaw-objects-view tbody', ':scope > tr[data-object-row]'],
                ['.resource-grid', ':scope > .resource-item[data-object-id]'],
                ['.digital-objects-list', ':scope > .object-item[data-object-id]'],
                ['.objects-list, .object-list', ':scope > [data-object-id]']
            ];
            groups.forEach(([containerSelector, itemSelector]) => {
                document.querySelectorAll(containerSelector).forEach(container => this.promoteContainer(container, itemSelector));
            });
        }

        promoteContainer(container, itemSelector) {
            const current = Array.from(container.querySelectorAll(itemSelector));
            if (current.length < 2) return;
            let original = this.temporalOrders.get(container);
            if (!original || original.length !== current.length || original.some(node => !current.includes(node))) {
                original = [...current];
                this.temporalOrders.set(container, original);
            }
            const desired = [
                ...original.filter(node => node.dataset.temporalState === 'active'),
                ...original.filter(node => node.dataset.temporalState !== 'active')
            ];
            if (desired.every((node, index) => node === current[index])) return;
            const fragment = document.createDocumentFragment();
            desired.forEach(node => fragment.appendChild(node));
            container.appendChild(fragment);
        }

        observeRenderers() {
            const stage = document.getElementById('uaw-stage') || document.body;
            this.observer = new MutationObserver(() => {
                if (this.mutationFrame) return;
                this.mutationFrame = requestAnimationFrame(() => {
                    this.mutationFrame = null;
                    this.applyTemporalState();
                });
            });
            this.observer.observe(stage, { childList: true, subtree: true });
        }

        createNavigator() {
            if (document.getElementById('workspec-time-navigator')) return;
            const navigator = document.createElement('section');
            navigator.id = 'workspec-time-navigator';
            navigator.className = 'workspec-time-navigator';
            navigator.hidden = true;
            navigator.setAttribute('role', 'dialog');
            navigator.setAttribute('aria-modal', 'false');
            navigator.setAttribute('aria-label', 'Time scrubber');
            navigator.innerHTML = `
                <div class="workspec-time-navigator__controls">
                    <div class="workspec-time-scales" role="group" aria-label="Timeline scale">
                        ${SCALES.map(scale => `<button type="button" data-time-scale="${scale}" aria-pressed="${scale === this.scale}">${scale[0].toUpperCase() + scale.slice(1)}</button>`).join('')}
                    </div>
                    <button type="button" data-close-time-navigator aria-label="Close timeline navigator">×</button>
                </div>
                <div class="workspec-time-scrubber">
                    <output id="workspec-time-scrubber-output">Current time</output>
                    <input id="workspec-time-range" type="range" min="0" max="1" value="0" step="any" aria-label="Current WorkSpec time" aria-describedby="workspec-time-scrubber-hint">
                    <div><span id="workspec-time-range-start">Start</span><span id="workspec-time-range-end">End</span></div>
                </div>
            `;
            document.body.appendChild(navigator);
            this.navigator = navigator;
            navigator.querySelector('[data-close-time-navigator]')?.addEventListener('click', () => this.closeNavigator());
            navigator.querySelectorAll('[data-time-scale]').forEach(button => button.addEventListener('click', () => this.setScale(button.dataset.timeScale)));
            navigator.querySelector('#workspec-time-range')?.addEventListener('input', event => {
                this.setTime(this.snapScrubTime(Number(event.target.value)), { source: 'navigator' });
            });
        }

        toggleNavigator() {
            if (!this.navigator) return;
            if (this.navigator.hidden) this.openNavigator(); else this.closeNavigator();
        }

        openNavigator() {
            if (!this.navigator) return;
            this.navigator.hidden = false;
            document.getElementById('player-time-button')?.setAttribute('aria-expanded', 'true');
            this.renderRange();
            requestAnimationFrame(() => this.navigator.classList.add('open'));
        }

        closeNavigator() {
            if (!this.navigator) return;
            this.navigator.classList.remove('open');
            this.navigator.hidden = true;
            document.getElementById('player-time-button')?.setAttribute('aria-expanded', 'false');
        }

        renderRange() {
            if (!this.model || !this.navigator) return;
            const range = this.navigator.querySelector('#workspec-time-range');
            range.min = String(this.model.startMinutes);
            range.max = String(this.model.endMinutes);
            range.step = 'any';
            range.value = String(this.currentTime);
            this.navigator.querySelector('#workspec-time-range-start').textContent = this.formatDate(this.model.startMinutes, { short: true });
            this.navigator.querySelector('#workspec-time-range-end').textContent = this.formatDate(this.model.endMinutes, { short: true });
            this.updateNavigatorTime();
        }

        snapScrubTime(time) {
            if (!this.model) return time;
            const start = this.model.startMinutes;
            const nearestMark = start + (Math.round((time - start) / SCRUB_MARK_INTERVAL_MINUTES) * SCRUB_MARK_INTERVAL_MINUTES);
            return Math.abs(time - nearestMark) <= SCRUB_SNAP_TOLERANCE_MINUTES ? nearestMark : time;
        }

        updateNavigatorTime() {
            if (!this.model || !this.navigator || this.navigator.hidden) return;
            this.navigator.querySelector('#workspec-time-scrubber-output').textContent = this.formatDate();
            const range = this.navigator.querySelector('#workspec-time-range');
            if (range) range.value = String(this.currentTime);
        }
    }

    const api = {
        DAY_MINUTES, SCALES, SCALE_RATES, PLAYBACK_MINUTES_PER_SECOND, durationMinutes, taskStartMinutes,
        createClockContext, normalizeDocument, taskState, buildSnapshot, dateForMinutes,
        WorkSpecTimeController
    };

    if (typeof document !== 'undefined') {
        const controller = new WorkSpecTimeController();
        root.workSpecTimeController = controller;
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => controller.initialize());
        else controller.initialize();
    }
    return api;
}));
