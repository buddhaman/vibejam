declare module 'nipplejs' {
    export interface JoystickOptions {
        zone: HTMLElement;
        mode?: string;
        position?: { top?: string; left?: string; bottom?: string; right?: string };
        size?: number;
        color?: string;
        lockX?: boolean;
        lockY?: boolean;
        dynamicPage?: boolean;
        restJoystick?: boolean;
        threshold?: number;
    }

    export interface JoystickEventData {
        angle: {
            radian: number;
            degree: number;
        };
        direction: {
            x: string; // 'left' | 'right'
            y: string; // 'up' | 'down'
            angle: string;
        };
        distance: number;
        force: number;
        position: {
            x: number;
            y: number;
        };
        vector: {
            x: number;
            y: number;
        };
        raw: {
            position: {
                x: number;
                y: number;
            }
        };
        instance: JoystickInstance;
    }

    export interface JoystickInstance {
        on(event: string, handler: (evt: any, data: JoystickEventData) => void): void;
        off(event: string, handler?: Function): void;
        destroy(): void;
    }

    export interface JoystickManager {
        on(event: string, handler: (evt: any, data: JoystickEventData) => void): void;
        off(event: string, handler?: Function): void;
        destroy(): void;
        get(id?: number): JoystickInstance;
        ids: number[];
    }

    export function create(options: JoystickOptions): JoystickManager;
} 