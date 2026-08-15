import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
export declare const name = "tabnexus";
export declare const inject: string[];
export interface Config {
    stateDir?: string;
}
export declare const Config: z<Config>;
type CardStatus = "unread" | "read" | "adopted" | "excluded";
interface Card {
    id: string;
    type: string;
    title: string;
    url?: string;
    note: string;
    status: CardStatus;
    excludedReason?: string;
    groupId: string | null;
    source: string;
    savedAt?: string;
}
interface Group {
    id: string;
    name: string;
    color: string;
    cardIds: string[];
}
interface Edge {
    fromCardId: string;
    toCardId: string;
    label?: string;
}
interface TaskMeta {
    goal: string;
    nextStep: string;
    conclusion: string;
    summary?: string;
    archivedAt?: string;
}
interface Task {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    groupOrder: string[];
    groups: Record<string, Group>;
    cards: Record<string, Card>;
    edges: Edge[];
    v2?: TaskMeta;
}
interface Preferences {
    locale: "zh" | "en";
    closeAfterCollect: boolean;
    workspaceView: "board" | "flow";
    groupingPolicy: "automatic" | "suggestion" | "domain";
}
interface Activity {
    id: string;
    tool: string;
    status: "running" | "success" | "error";
    createdAt: string;
    completedAt?: string;
    summary: string;
    error?: string;
}
interface Receipt {
    completedAt: string;
    result: unknown;
}
interface State {
    schemaVersion: 1;
    activeTaskId: string;
    taskOrder: string[];
    tasks: Record<string, Task>;
    preferences: Preferences;
    activities: Activity[];
    receipts: Record<string, Receipt>;
}
export declare class Store {
    private readonly file;
    private state;
    private lock;
    constructor(file: string);
    private load;
    private persist;
    withLock<T>(fn: () => Promise<T>): Promise<T>;
    snapshot(): Promise<State>;
    mutate<T>(fn: (state: State) => T | Promise<T>): Promise<T>;
}
export declare function buildToolHandlers(store: Store): {
    dispatch: (tool: string, input: Record<string, unknown>) => Promise<unknown>;
    handlers: Record<string, (input: Record<string, unknown>) => Promise<unknown>>;
    active: () => Promise<Task>;
    store: Store;
};
export declare function apply(ctx: Context, config: Config): void;
export {};
