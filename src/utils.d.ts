declare module "utils" {
    type StorageArea = "local" | "sync" | "session" | "managed";

    export function readStorage<T>(key: string, area?: StorageArea): Promise<T | null>;

    export function writeStorage<T>(key: string, data: T, area?: StorageArea): void;

    export type StorageChangeListenerCallback = (
        oldValue: any,
        newValue: any,
        key: string,
        storage?: StorageArea
    ) => void;

    export function addStorageChangeListener(
        key: string,
        callback: StorageChangeListenerCallback,
        area?: StorageArea | null
    ): void;

    export function sendMessage<T>(key: string, message: any): Promise<T>;

    // @ts-ignore
    export type MessageListenerCallback = (message: any, sender: chrome.runtime.MessageSender) => Promise<any>;

    export function addMessageListener(key: string, callback: MessageListenerCallback): void;

    export interface ContentScript {
        id?: string;
        js?: string[];
        css?: string[];
        matches?: string[];
        persistAcrossSessions?: boolean;
        runAt?: "document_start" | "document_end" | "document_idle";
    }

    export function registerContentScript(script: ContentScript, injectImmediately?: boolean): Promise<string>;

    export function unregisterContentScript(id: string): Promise<void>;

    export interface StyleInjection {
        files: string[];
    }

    export function injectStyle(style: StyleInjection): Promise<void>;

    export interface ScriptExecution {
        files?: string[];
        func?: Function;
    }

    export function executeScript(script: ScriptExecution): Promise<void>;

    export interface Tab {
        id?: number;
    }

    export function getCurrentTab(): Promise<Tab | undefined>;
    export function delay(): Promise<void>;

    export function injectFlag(): HTMLDivElement;
}
