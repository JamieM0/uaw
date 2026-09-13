interface WorkSpecEffectOptions {
    temporary?: boolean;
}

interface WorkSpecTaskContext {
    readonly taskId: string;
    readonly phase: 'start' | 'completion';
    set: typeof set;
    change: typeof change;
    move: typeof move;
    create: typeof create;
    remove: typeof remove;
}

interface WorkSpecTaskHandle {
    onStart(handler: (context: WorkSpecTaskContext) => void): WorkSpecTaskHandle;
    onComplete(handler: (context: WorkSpecTaskContext) => void): WorkSpecTaskHandle;
}

interface WorkSpecLanguage {
    task(id: string, configure?: (task: WorkSpecTaskHandle) => void): WorkSpecTaskHandle;
}

declare var WorkSpec: WorkSpecLanguage;
declare function set(targetId: string, property: string, value: unknown, options?: WorkSpecEffectOptions): void;
declare function change(targetId: string, property: string, amount: number, options?: WorkSpecEffectOptions): void;
declare function move(targetId: string, locationId: string, options?: WorkSpecEffectOptions): void;
declare function create(object: Record<string, unknown>): void;
declare function remove(targetId: string): void;
