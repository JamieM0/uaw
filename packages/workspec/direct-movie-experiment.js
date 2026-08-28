// Disposable direct-state fixture for playback architecture Experiment 2.
// This is deliberately not a WorkSpec schema or a proposed persistence format.

(function() {
    'use strict';

    const fixture = {
        durationMinutes: 30,
        tasks: [],
        locations: [
            { id: 'Left Bay', name: 'Left Bay', shape: { type: 'rect', x: 80, y: 90, width: 280, height: 220 } },
            { id: 'Right Bay', name: 'Right Bay', shape: { type: 'rect', x: 460, y: 90, width: 280, height: 220 } }
        ],
        objects: [
            { id: 'movie_worker', type: 'actor', name: 'Movie Worker', emoji: '👷' },
            { id: 'movie_machine', type: 'equipment', name: 'Movie Machine', emoji: '⚙️' },
            { id: 'movie_box', type: 'product', name: 'Movie Box', emoji: '📦' }
        ],
        points: [
            {
                time: 0,
                objects: {
                    movie_worker: { location: 'Left Bay', state: 'idle' },
                    movie_machine: { location: 'Left Bay', state: 'off' }
                }
            },
            {
                time: 10,
                objects: {
                    movie_worker: { location: 'Left Bay', state: 'working' },
                    movie_machine: { location: 'Left Bay', state: 'running' }
                }
            },
            {
                time: 20,
                objects: {
                    movie_worker: { location: 'Right Bay', state: 'working' },
                    movie_machine: { location: 'Left Bay', state: 'running' },
                    movie_box: { location: 'Right Bay', state: 'present' }
                }
            },
            {
                time: 30,
                objects: {
                    movie_worker: { location: 'Right Bay', state: 'idle' },
                    movie_machine: { location: 'Left Bay', state: 'off' }
                }
            }
        ]
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createSource(movie = fixture) {
        const catalog = new Map(movie.objects.map(object => [object.id, object]));
        const points = [...movie.points].sort((left, right) => left.time - right.time);
        const observableObjects = movie.objects.map(object => {
            const firstState = points.map(point => point.objects?.[object.id]).find(Boolean);
            return { ...clone(object), location: firstState?.location };
        });
        return {
            objects: observableObjects,
            boundaries: movie.points.map(point => point.time),
            resolveWorldStateAtTime(time) {
                let point = points[0];
                for (const candidate of points) {
                    if (candidate.time > time) break;
                    point = candidate;
                }
                const objects = Object.entries(point?.objects || {}).map(([id, state]) => ({
                    ...clone(catalog.get(id)),
                    location: state.location,
                    properties: { state: state.state }
                }));
                return { time, objects };
            }
        };
    }

    function createStudioDocument(movie = fixture) {
        return {
            simulation: {
                meta: { title: 'Direct Movie Experiment', domain: 'Development' },
                config: { time_unit: 'minutes', start_time: '00:00', end_time: '00:30' },
                world: {
                    layout: { width: 820, height: 400, locations: clone(movie.locations) },
                    objects: clone(movie.objects)
                },
                process: { tasks: [] }
            }
        };
    }

    function isActive(search) {
        const query = search === undefined && typeof window !== 'undefined' ? window.location.search : search;
        return new URLSearchParams(query || '').get('movieExperiment') === '1';
    }

    function mountTestBar() {
        if (typeof document === 'undefined' || !isActive() || document.getElementById('direct-movie-test-bar')) return;
        const bar = document.createElement('div');
        bar.id = 'direct-movie-test-bar';
        bar.className = 'direct-movie-test-bar';
        const label = document.createElement('strong');
        label.textContent = 'Direct Movie Experiment — 0 tasks';
        bar.appendChild(label);
        [0, 10, 20, 30].forEach(time => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `00:${String(time).padStart(2, '0')}`;
            button.addEventListener('click', () => {
                window.workSpecTimeController?.setTime?.(time, { source: 'movie-experiment', force: true });
            });
            bar.appendChild(button);
        });
        document.body.prepend(bar);
    }

    const api = { fixture, createSource, createStudioDocument, isActive, mountTestBar };
    if (typeof window !== 'undefined') window.WorkSpecDirectMovieExperiment = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
