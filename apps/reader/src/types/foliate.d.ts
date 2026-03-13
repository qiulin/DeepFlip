// Type declarations for foliate-js modules (no official types package)
declare module 'foliate-js/view.js' {
  const module: unknown;
  export default module;
}
declare module 'foliate-js/epub.js' {
  export class EPUB {
    constructor(loader: unknown);
    init(): Promise<unknown>;
  }
}
declare module 'foliate-js/mobi.js' {
  export function isMOBI(file: File): Promise<boolean>;
  export class MOBI {
    constructor(options: { unzlib: (buf: Uint8Array, opts?: unknown) => Uint8Array; [key: string]: unknown });
    open(file: File): Promise<unknown>;
  }
}
declare module 'foliate-js/fb2.js' {
  export function makeFB2(file: File | Blob): Promise<unknown>;
}
declare module 'foliate-js/comic-book.js' {
  export function makeComicBook(loader: unknown, file: File): Promise<unknown>;
}
declare module 'foliate-js/epubcfi.js' {
  export function parse(cfi: string): unknown;
  export function collapse(cfi: unknown, toStart?: boolean): unknown;
  export function compare(a: unknown, b: unknown): number;
  export function generate(range: Range, idref?: string): string;
  export function toCFIRange(cfi: unknown): unknown;
  export function resolve(cfi: unknown, doc: Document): Range | null;
}
declare module 'foliate-js/tts.js' {
  export class TTS {
    next(): void;
    prev(): void;
    pause(): void;
    resume(): void;
    stop(): void;
    speaking: boolean;
    paused: boolean;
  }
}
