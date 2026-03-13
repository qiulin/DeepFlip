import type { BookFormat } from '@/types/book';

export type DocumentFile = File;

export type Location = {
  current: number;
  next: number;
  total: number;
};

export interface TOCItem {
  id: number;
  label: string;
  href: string;
  index: number;
  cfi?: string;
  location?: Location;
  subitems?: TOCItem[];
}

export interface SectionItem {
  id: string;
  cfi: string;
  size: number;
  linear: string;
  href?: string;
  location?: Location;
  subitems?: Array<SectionItem>;
  createDocument: () => Promise<Document>;
}

export type BookMetadata = {
  title: string;
  author: string;
  language: string | string[];
  publisher?: string;
  published?: string;
  description?: string;
  subject?: string | string[];
  identifier?: string;
  coverImageFile?: string;
  coverImageUrl?: string;
  coverImageBlobUrl?: string;
};

export interface BookDoc {
  metadata: BookMetadata;
  rendition: {
    layout?: 'pre-paginated' | 'reflowable';
    spread?: 'auto' | 'none';
    viewport?: { width: number; height: number };
  };
  dir: string;
  toc?: Array<TOCItem>;
  sections: Array<SectionItem>;
  transformTarget?: EventTarget;
  splitTOCHref(href: string): Array<string | number>;
  getCover(): Promise<Blob | null>;
}

export const EXTS: Record<BookFormat, string> = {
  EPUB: 'epub',
  MOBI: 'mobi',
  AZW: 'azw',
  AZW3: 'azw3',
  CBZ: 'cbz',
  FB2: 'fb2',
  FBZ: 'fbz',
  TXT: 'txt',
  MD: 'md',
};

export const MIMETYPES: Record<BookFormat, string[]> = {
  EPUB: ['application/epub+zip'],
  MOBI: ['application/x-mobipocket-ebook'],
  AZW: ['application/vnd.amazon.ebook'],
  AZW3: ['application/vnd.amazon.mobi8-ebook', 'application/x-mobi8-ebook'],
  CBZ: ['application/vnd.comicbook+zip', 'application/zip', 'application/x-cbz'],
  FB2: ['application/x-fictionbook+xml', 'text/xml', 'application/xml'],
  FBZ: ['application/x-zip-compressed-fb2', 'application/zip'],
  TXT: ['text/plain'],
  MD: ['text/markdown', 'text/x-markdown'],
};

export class DocumentLoader {
  private file: File;

  constructor(file: File) {
    this.file = file;
  }

  private async isZip(): Promise<boolean> {
    const arr = new Uint8Array(await this.file.slice(0, 4).arrayBuffer());
    return arr[0] === 0x50 && arr[1] === 0x4b && arr[2] === 0x03 && arr[3] === 0x04;
  }

  private isCBZ(): boolean {
    return (
      this.file.type === 'application/vnd.comicbook+zip' || this.file.name.endsWith(`.${EXTS.CBZ}`)
    );
  }

  private isFB2(): boolean {
    return (
      this.file.type === 'application/x-fictionbook+xml' || this.file.name.endsWith(`.${EXTS.FB2}`)
    );
  }

  private isFBZ(): boolean {
    return (
      this.file.type === 'application/x-zip-compressed-fb2' ||
      this.file.name.endsWith('.fb.zip') ||
      this.file.name.endsWith('.fb2.zip') ||
      this.file.name.endsWith(`.${EXTS.FBZ}`)
    );
  }

  private async makeZipLoader() {
    const { ZipReader, BlobReader, TextWriter, BlobWriter } = await import('@zip.js/zip.js');
    type Entry = import('@zip.js/zip.js').Entry;
    const reader = new ZipReader(new BlobReader(this.file));
    const entries = await reader.getEntries();
    const map = new Map(entries.map((entry) => [entry.filename, entry]));
    const load =
      (f: (entry: Entry, type?: string) => Promise<string | Blob> | null) =>
      (name: string, ...args: [string?]) =>
        map.has(name) ? f(map.get(name)!, ...args) : null;
    const loadText = load((entry: Entry) =>
      !entry.directory ? entry.getData!(new TextWriter()) : null,
    );
    const loadBlob = load((entry: Entry, type?: string) =>
      !entry.directory ? entry.getData!(new BlobWriter(type!)) : null,
    );
    const getSize = (name: string) => map.get(name)?.uncompressedSize ?? 0;
    return { entries, loadText, loadBlob, getSize, sha1: undefined };
  }

  public async open(): Promise<{ book: BookDoc; format: BookFormat }> {
    let book: BookDoc | null = null;
    let format: BookFormat = 'EPUB';

    if (!this.file.size) {
      throw new Error('File is empty');
    }

    try {
      if (await this.isZip()) {
        const loader = await this.makeZipLoader();
        const { entries } = loader;

        if (this.isCBZ()) {
          const { makeComicBook } = await import('foliate-js/comic-book.js');
          book = (await makeComicBook(loader, this.file)) as BookDoc;
          format = 'CBZ';
        } else if (this.isFBZ()) {
          const entry = entries.find((e) => e.filename.endsWith(`.${EXTS.FB2}`));
          const blobResult = await loader.loadBlob((entry ?? entries[0]!).filename);
          if (!blobResult || typeof blobResult === 'string') throw new Error('Failed to load FBZ blob');
          const { makeFB2 } = await import('foliate-js/fb2.js');
          book = (await makeFB2(blobResult)) as BookDoc;
          format = 'FBZ';
        } else {
          const { EPUB } = await import('foliate-js/epub.js');
          book = (await new EPUB(loader).init()) as BookDoc;
          format = 'EPUB';
        }
      } else if (this.isFB2()) {
        const { makeFB2 } = await import('foliate-js/fb2.js');
        book = (await makeFB2(this.file)) as BookDoc;
        format = 'FB2';
      } else {
        // Try MOBI
        const fflate = await import('fflate');
        const { MOBI } = await import('foliate-js/mobi.js');
        book = (await new MOBI({ unzlib: fflate.unzlibSync as unknown as (buf: Uint8Array, opts?: unknown) => Uint8Array }).open(this.file)) as BookDoc;
        const ext = this.file.name.split('.').pop()?.toLowerCase();
        switch (ext) {
          case 'azw': format = 'AZW'; break;
          case 'azw3': format = 'AZW3'; break;
          default: format = 'MOBI';
        }
      }
    } catch (e: unknown) {
      console.error('Failed to open document:', e);
      if (e instanceof Error && e.message?.includes('not a valid zip')) {
        throw new Error('Unsupported or corrupted book file');
      }
      throw e;
    }

    if (!book) throw new Error('Could not parse book file');
    return { book, format };
  }
}

export const getFileExtFromMimeType = (mimeType?: string): string => {
  if (!mimeType) return '';
  for (const format in MIMETYPES) {
    const list = MIMETYPES[format as BookFormat];
    if (list.includes(mimeType)) return EXTS[format as BookFormat];
  }
  return '';
};

export const getMimeTypeFromFileExt = (ext: string): string => {
  ext = ext.toLowerCase();
  for (const format in EXTS) {
    if (EXTS[format as BookFormat] === ext) {
      return MIMETYPES[format as BookFormat]![0] || 'application/octet-stream';
    }
  }
  return 'application/octet-stream';
};
