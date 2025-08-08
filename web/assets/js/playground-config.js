/**
 * Playground Configuration Module
 * Centralized configuration management for all settings and constants
 */

export const PlaygroundConfig = {
    // History management
    MAX_HISTORY: 50,
    
    // Debounce timing
    DEBOUNCE_DELAY: 300,
    HISTORY_SAVE_DELAY: 1000,
    
    // Monaco Editor configuration
    MONACO: {
        CDN_BASE: "https://unpkg.com/monaco-editor@0.44.0/min/vs",
        SETTINGS: {
            theme: "vs",
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: "on",
            roundedSelection: false,
            scrollbar: { vertical: "visible", horizontal: "visible" },
            folding: true,
            bracketMatching: "always",
            formatOnPaste: true,
            formatOnType: true
        }
    },
    
    // API endpoints
    API: {
        TUTORIAL_CONTENT: '/assets/static/tutorial-content.json',
        METRICS_CATALOG: '/assets/static/metrics-catalog.json'
    },
    
    // Default values
    DEFAULTS: {
        START_TIME: "06:00",
        END_TIME: "18:00",
        TIME_UNIT: "minute",
        TASK_DURATION: 30
    },
    
    // UI Constants
    UI: {
        TUTORIAL_PANEL_WIDTH: 350,
        SIMULATION_HEIGHT_RATIO: 0.7,
        JSON_EDITOR_WIDTH_RATIO: 0.4
    },
    
    // Sample simulation data
    SAMPLE_SIMULATION: {
        simulation: {
            meta: {
                id: "sim_breadmaking_v3_full",
                article_title: "Artisan Bread Making Process",
                domain: "Bakery Operations",
            },
            config: {
                time_unit: "minute",
                start_time: "06:00",
                end_time: "18:00",
            },
            layout: {
                meta: {
                    units: "meters",
                    pixels_per_unit: 20
                },
                locations: [
                    {
                        id: "prep_area", 
                        name: "Prep Area",
                        x: 2, 
                        y: 3, 
                        width: 4, 
                        height: 2, 
                        emoji: "🧑‍🍳"
                    },
                    {
                        id: "oven_area", 
                        name: "Oven Area",
                        x: 7, 
                        y: 3, 
                        width: 3, 
                        height: 2, 
                        emoji: "🔥"
                    },
                    {
                        id: "storage", 
                        name: "Storage",
                        x: 2, 
                        y: 1, 
                        width: 2, 
                        height: 1, 
                        emoji: "📦"
                    },
                    {
                        id: "cooling_rack", 
                        name: "Cooling Rack",
                        x: 6, 
                        y: 1, 
                        width: 2, 
                        height: 1, 
                        emoji: "🍞"
                    }
                ]
            },
            actors: [
                {
                    id: "head_baker",
                    role: "Head Baker",
                    emoji: "👨‍🍳",
                    skills: ["bread_making", "dough_preparation", "baking"],
                    shift: { start: "06:00", end: "14:00" }
                },
                {
                    id: "assistant_baker",
                    role: "Assistant Baker",
                    emoji: "👩‍🍳",
                    skills: ["prep_work", "cleaning", "packaging"],
                    shift: { start: "07:00", end: "15:00" }
                }
            ],
            resources: [
                {
                    id: "mixing_bowl_large",
                    name: "Large Mixing Bowl",
                    emoji: "🥣",
                    type: "equipment",
                    capacity: 5,
                    state: "clean",
                    location: "prep_area"
                },
                {
                    id: "stand_mixer",
                    name: "Stand Mixer",
                    emoji: "🔄",
                    type: "equipment",
                    state: "available",
                    location: "prep_area"
                },
                {
                    id: "bread_flour",
                    name: "Bread Flour",
                    emoji: "🌾",
                    type: "ingredient",
                    quantity: 50,
                    unit: "kg",
                    location: "storage"
                },
                {
                    id: "active_yeast",
                    name: "Active Dry Yeast",
                    emoji: "🦠",
                    type: "ingredient",
                    quantity: 2,
                    unit: "kg",
                    location: "storage"
                }
            ],
            tasks: [
                {
                    id: "prep_ingredients",
                    name: "Prepare Ingredients",
                    emoji: "📝",
                    actor_id: "assistant_baker",
                    start_time: "07:00",
                    duration: 15,
                    location: "prep_area",
                    uses_resources: ["bread_flour", "active_yeast"],
                    produces_resources: [],
                    requires_resources: []
                },
                {
                    id: "mix_dough",
                    name: "Mix Dough",
                    emoji: "🥄",
                    actor_id: "head_baker",
                    start_time: "07:15",
                    duration: 20,
                    location: "prep_area",
                    uses_resources: ["mixing_bowl_large", "stand_mixer"],
                    produces_resources: [],
                    requires_resources: ["bread_flour", "active_yeast"]
                },
                {
                    id: "first_rise",
                    name: "First Rise",
                    emoji: "⏳",
                    actor_id: "head_baker",
                    start_time: "07:35",
                    duration: 90,
                    location: "prep_area",
                    uses_resources: ["mixing_bowl_large"],
                    produces_resources: [],
                    requires_resources: []
                },
                {
                    id: "shape_loaves",
                    name: "Shape Loaves",
                    emoji: "✋",
                    actor_id: "head_baker",
                    start_time: "09:05",
                    duration: 25,
                    location: "prep_area",
                    uses_resources: [],
                    produces_resources: [],
                    requires_resources: []
                },
                {
                    id: "second_rise",
                    name: "Second Rise",
                    emoji: "💨",
                    actor_id: "head_baker",
                    start_time: "09:30",
                    duration: 45,
                    location: "prep_area",
                    uses_resources: [],
                    produces_resources: [],
                    requires_resources: []
                },
                {
                    id: "bake_bread",
                    name: "Bake Bread",
                    emoji: "🔥",
                    actor_id: "head_baker",
                    start_time: "10:15",
                    duration: 35,
                    location: "oven_area",
                    uses_resources: [],
                    produces_resources: [],
                    requires_resources: []
                },
                {
                    id: "cool_bread",
                    name: "Cool Bread",
                    emoji: "❄️",
                    actor_id: "assistant_baker",
                    start_time: "10:50",
                    duration: 30,
                    location: "cooling_rack",
                    uses_resources: [],
                    produces_resources: [],
                    requires_resources: []
                }
            ]
        }
    },
    
    // Error messages
    ERRORS: {
        FETCH_FAILED: "Critical error loading initial data",
        JSON_PARSE_ERROR: "Invalid JSON format",
        MONACO_NOT_READY: "Monaco editor not initialized",
        CANVAS_NOT_FOUND: "Canvas or Properties Panel element not found"
    }
};

// Utility functions for configuration
export class ConfigManager {
    static getSampleSimulation() {
        return JSON.parse(JSON.stringify(PlaygroundConfig.SAMPLE_SIMULATION));
    }
    
    static getMonacoConfig() {
        return {
            paths: { vs: PlaygroundConfig.MONACO.CDN_BASE }
        };
    }
    
    static getEditorSettings(initialValue = null) {
        const settings = { ...PlaygroundConfig.MONACO.SETTINGS };
        if (initialValue) {
            settings.value = initialValue;
        }
        settings.language = "json";
        return settings;
    }
    
    static debounce(func, delay = PlaygroundConfig.DEBOUNCE_DELAY) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
}