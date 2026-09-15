export type WorkSpecTime = number | string | Readonly<{ day: number; time: string }>;

export interface WorkSpecProblem {
    type?: string;
    title?: string;
    severity: 'error' | 'warning' | 'info';
    detail: string;
    instance?: string;
    metric_id: string;
    scope?: 'document' | 'source' | 'runtime' | 'constraint' | string;
    provenance?: Readonly<Record<string, unknown>>;
    context?: Readonly<Record<string, unknown>>;
    suggestions?: readonly string[];
}

export interface WorkSpecSnapshot {
    objects: Readonly<Record<string, Readonly<Record<string, any>>>>;
    locations: Readonly<Record<string, Readonly<Record<string, any>>>>;
    task_statuses: Readonly<Record<string, string>>;
    task_runtime: Readonly<Record<string, Readonly<Record<string, any>>>>;
    active_tasks: Readonly<Record<string, Readonly<Record<string, any>>>>;
    reservations: readonly Readonly<Record<string, unknown>>[];
    collections: Readonly<Record<string, readonly string[]>>;
    collection_boundaries: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    work_definitions: readonly Readonly<Record<string, unknown>>[];
    task_instances: readonly Readonly<Record<string, unknown>>[];
    usage: readonly string[];
    problems: readonly WorkSpecProblem[];
}

export interface WorkSpecRun {
    problems: WorkSpecProblem[];
    history: readonly Readonly<Record<string, unknown>>[];
    resolvedThrough: number;
    requestedHorizon?: number | null;
    complete: boolean;
    seed: number;
    maxEvents: number;
    processedWorkUnits: number;
    [key: string]: any;
}

export interface WorkSpecRenderOptions {
    changesSource?: string;
    generatorSource?: string;
    seed?: number;
    maxEvents?: number;
    title?: string;
    timeLabel?: string;
    padding?: number;
    width?: number;
    height?: number;
    defaultLocationWidth?: number;
    defaultLocationHeight?: number;
    locationGap?: number;
    assetResolver?: (assetId: string, object: Readonly<Record<string, any>>) => string | null | undefined;
}

export interface WorkSpecRenderResult {
    svg: string;
    snapshot: WorkSpecSnapshot;
    run: WorkSpecRun;
    time: number;
    seed: number;
}

export interface WorkSpecValidationResult {
    ok: boolean;
    problems: WorkSpecProblem[];
    [key: string]: any;
}

export interface WorkSpecProjectValidationOptions {
    changesSource?: string;
    generatorSource?: string;
    constraintsSource?: string;
    seed?: number;
    until?: number;
    maxEvents?: number;
}

export interface WorkSpecRuntime {
    runProject(documentValue: unknown, changesSource?: string, generatorSource?: string, options?: Readonly<Record<string, unknown>>): WorkSpecRun;
    snapshotRunAt(run: WorkSpecRun, time: WorkSpecTime): WorkSpecSnapshot;
    snapshotProjectAt(documentValue: unknown, changesSource: string, generatorSource: string, time: WorkSpecTime, options?: Readonly<Record<string, unknown>>): WorkSpecSnapshot;
    serialiseState(run: WorkSpecRun): WorkSpecSnapshot;
    [key: string]: any;
}

export const runtime: WorkSpecRuntime;
export function validate(documentValue: unknown): WorkSpecValidationResult;
export function validateProject(documentValue: unknown, options?: WorkSpecProjectValidationOptions): WorkSpecValidationResult;
export function migrate(documentValue: unknown, options?: Readonly<Record<string, unknown>>): unknown;
export function renderSnapshotToSvg(documentValue: unknown, snapshot: WorkSpecSnapshot, options?: WorkSpecRenderOptions): string;
export function renderProjectToSvg(documentValue: unknown, time: WorkSpecTime, options?: WorkSpecRenderOptions): WorkSpecRenderResult;
export function assetIdFromFilename(filename: string): string;
export function resolveStateVisualAssetId(documentValue: unknown, object: Readonly<Record<string, any>>, state?: unknown): string | null;
export function runCustomValidation(documentValue: unknown, options: Readonly<Record<string, unknown>>): Promise<WorkSpecProblem[]>;
export function runCustomValidationInProcess(documentValue: unknown, options: Readonly<Record<string, unknown>>): WorkSpecProblem[];
