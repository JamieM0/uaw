type WorkSpecConstraintTime = number | string | Readonly<{ day: number; time: string }>;
type WorkSpecConstraintSeverity = 'error' | 'warning' | 'info';

interface WorkSpecConstraintEntity {
    readonly id?: string;
    readonly properties?: Readonly<Record<string, any>>;
    readonly [property: string]: any;
}

interface WorkSpecConstraintState {
    readonly time: number;
    readonly objects: Readonly<Record<string, WorkSpecConstraintEntity>>;
    readonly locations: Readonly<Record<string, WorkSpecConstraintEntity>>;
    readonly reservations: readonly Readonly<Record<string, unknown>>[];
}

interface WorkSpecConstraintContext {
    readonly time: number;
    state(): WorkSpecConstraintState;
    stateAt(time: WorkSpecConstraintTime): WorkSpecConstraintState;
    get<T = any>(targetId: string, property: string): T;
    getAt<T = any>(time: WorkSpecConstraintTime, targetId: string, property: string): T;
    times(): readonly number[];
}

interface WorkSpecConstraintViolation {
    constraint_id?: string;
    constraintId?: string;
    severity?: WorkSpecConstraintSeverity;
    time?: WorkSpecConstraintTime;
    objects?: readonly string[];
    object?: string;
    property?: string;
    observed?: unknown;
    expected?: unknown;
    message?: string;
    detail?: string;
}

type WorkSpecConstraintResult =
    | WorkSpecConstraintViolation
    | readonly WorkSpecConstraintViolation[]
    | Readonly<{ violations: readonly WorkSpecConstraintViolation[] }>
    | boolean
    | null
    | undefined;

type WorkSpecConstraintCheck = (context: WorkSpecConstraintContext) => WorkSpecConstraintResult;

interface WorkSpecLanguage {
    constraint(id: string, check: WorkSpecConstraintCheck): void;
}

declare var WorkSpec: WorkSpecLanguage;

interface WorkSpecConstraintModule {
    exports:
        | WorkSpecConstraintCheck
        | readonly WorkSpecConstraintCheck[]
        | Record<string, WorkSpecConstraintCheck | Readonly<{ id?: string; check?: WorkSpecConstraintCheck; run?: WorkSpecConstraintCheck }>>
        | Readonly<{ constraints: readonly (WorkSpecConstraintCheck | Readonly<{ id?: string; check?: WorkSpecConstraintCheck; run?: WorkSpecConstraintCheck }>)[] }>;
}

declare var module: WorkSpecConstraintModule;
