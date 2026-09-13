interface WorkSpecGeneratorEntity {
    readonly id?: string;
    readonly properties?: Readonly<Record<string, any>>;
    readonly [property: string]: any;
}

interface WorkSpecGeneratorState {
    readonly objects: Readonly<Record<string, WorkSpecGeneratorEntity>>;
    readonly locations: Readonly<Record<string, WorkSpecGeneratorEntity>>;
}

interface WorkSpecGeneratorContext {
    readonly time: number;
    readonly delta: number;
    readonly state: WorkSpecGeneratorState;
    random(): number;
    get<T = any>(targetId: string, property: string): T;
    set(targetId: string, property: string, value: unknown): void;
    change(targetId: string, property: string, amount: number): void;
    move(targetId: string, locationId: string): void;
    create(object: Record<string, unknown>): void;
    remove(targetId: string): void;
}

interface WorkSpecGeneratorDefinition {
    onStart?: (context: WorkSpecGeneratorContext) => void;
    onUpdate?: (context: WorkSpecGeneratorContext) => void;
}

interface WorkSpecLanguage {
    onStart(handler: (context: WorkSpecGeneratorContext) => void): void;
    onUpdate(handler: (context: WorkSpecGeneratorContext) => void): void;
    generator(definition: WorkSpecGeneratorDefinition): void;
}

declare var WorkSpec: WorkSpecLanguage;
