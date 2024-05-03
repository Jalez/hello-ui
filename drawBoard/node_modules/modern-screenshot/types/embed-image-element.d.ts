import type { Context } from './context';
export declare function embedImageElement<T extends HTMLImageElement | SVGImageElement>(cloned: T, context: Context): Promise<void>[];
