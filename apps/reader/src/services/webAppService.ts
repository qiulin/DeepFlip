import { md5 } from 'js-md5';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppPlatform,
  AppService,
  BaseDir,
  DeleteAction,
  FileInfo,
  FileItem,
  FileSystem,
  OsPlatform,
  ResolvedPath,
} from '@/types/system';
import type { Book, BookConfig, BookContent, ViewSettings } from '@/types/book';
import { FIXED_LAYOUT_FORMATS } from '@/types/book';
import type { SystemSettings } from '@/types/settings';

const DATA_SUBDIR = 'deepflip/data';
const LOCAL_BOOKS_SUBDIR = 'deepflip/books';

const basePrefix = async () => '';

const resolvePath = (path: string, base: BaseDir): ResolvedPath => {
  switch (base) {
    case 'Data':
      return { baseDir: 0, basePrefix, fp: `${DATA_SUBDIR}/${path}`, base };
    case 'Books':
      return { baseDir: 0, basePrefix, fp: `${LOCAL_BOOKS_SUBDIR}/${path}`, base };
    case 'None':
      return { baseDir: 0, basePrefix, fp: path, base };
    default:
      return { baseDir: 0, basePrefix, fp: `${base}/${path}`, base };
  }
};

const dbName = 'DeepFlipFileSystem';
const dbVersion = 1;

async function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const indexedDBFileSystem: FileSystem = {
  resolvePath,
  async getPrefix(base: BaseDir) {
    const { basePrefix: bp, fp } = this.resolvePath('', base);
    const basePath = await bp();
    const prefix = fp ? (basePath ? `${basePath}/${fp}` : fp) : basePath;
    return prefix.replace(/\/+$/, '');
  },
  getURL(path: string) {
    return path;
  },
  async getBlobURL(path: string, base: BaseDir) {
    try {
      const content = await this.readFile(path, base, 'binary');
      return URL.createObjectURL(new Blob([content]));
    } catch {
      return path;
    }
  },
  async getImageURL(path: string) {
    return await this.getBlobURL(path, 'None');
  },
  async openFile(path: string, base: BaseDir, filename?: string) {
    const content = await this.readFile(path, base, 'binary');
    return new File([content], filename || path);
  },
  async copyFile(srcPath: string, dstPath: string, base: BaseDir) {
    const { fp } = this.resolvePath(dstPath, base);
    const db = await openIndexedDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const getRequest = store.get(srcPath);
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          store.put({ path: fp, content: data.content });
          resolve();
        } else {
          reject(new Error(`File not found: ${srcPath}`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  },
  async readFile(path: string, base: BaseDir, mode: 'text' | 'binary') {
    const { fp } = this.resolvePath(path, base);
    const db = await openIndexedDB();
    return new Promise<string | ArrayBuffer>((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(fp);
      request.onsuccess = async () => {
        if (request.result) {
          const content = request.result.content;
          if (mode === 'text') resolve(content);
          else {
            if (content instanceof Blob) {
              resolve(await content.arrayBuffer());
            } else if (content instanceof ArrayBuffer) {
              resolve(content);
            } else if (typeof content === 'string') {
              resolve(new TextEncoder().encode(content).buffer as ArrayBuffer);
            } else {
              reject(new Error('Unsupported content type'));
            }
          }
        } else {
          reject(new Error(`File not found: ${fp}`));
        }
      };
      request.onerror = () => reject(request.error);
    });
  },
  async writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File) {
    const { fp } = this.resolvePath(path, base);
    const db = await openIndexedDB();
    if (content instanceof File) {
      content = await content.arrayBuffer();
    }
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      store.put({ path: fp, content });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  async removeFile(path: string, base: BaseDir) {
    const { fp } = this.resolvePath(path, base);
    const db = await openIndexedDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      store.delete(fp);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  async createDir(_path: string, _base: BaseDir) {
    // no-op in IndexedDB (dirs are virtual)
  },
  async removeDir(path: string, base: BaseDir, _recursive?: boolean) {
    const { fp } = this.resolvePath(path, base);
    const db = await openIndexedDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.getAll();
      request.onsuccess = () => {
        const files = request.result as { path: string }[];
        for (const file of files) {
          if (file.path.startsWith(fp)) store.delete(file.path);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  async readDir(path: string, base: BaseDir): Promise<FileItem[]> {
    const { fp } = this.resolvePath(path, base);
    const db = await openIndexedDB();
    return new Promise<FileItem[]>((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();
      request.onsuccess = () => {
        const files = request.result as { path: string; content: unknown }[];
        resolve(
          files
            .filter((f) => f.path.startsWith(fp))
            .map((f) => ({
              path: f.path.slice(fp.length + 1),
              size:
                f.content instanceof Blob
                  ? f.content.size
                  : typeof f.content === 'string'
                    ? f.content.length
                    : f.content instanceof ArrayBuffer
                      ? f.content.byteLength
                      : 0,
            })),
        );
      };
      request.onerror = () => reject(request.error);
    });
  },
  async exists(path: string, base: BaseDir): Promise<boolean> {
    const { fp } = this.resolvePath(path, base);
    const db = await openIndexedDB();
    return new Promise<boolean>((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(fp);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async stats(path: string, base: BaseDir): Promise<FileInfo> {
    const { fp } = this.resolvePath(path, base);
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(fp);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const content = result.content;
          const size =
            content instanceof Blob
              ? content.size
              : typeof content === 'string'
                ? content.length
                : content instanceof ArrayBuffer
                  ? content.byteLength
                  : 0;
          resolve({ isFile: true, isDirectory: false, size, mtime: null, atime: null, birthtime: null });
        } else {
          reject(new Error(`File not found: ${fp}`));
        }
      };
      request.onerror = () => reject(request.error);
    });
  },
};

const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  // BookLayout
  marginTopPx: 20,
  marginBottomPx: 20,
  marginLeftPx: 20,
  marginRightPx: 20,
  gapPercent: 4,
  scrolled: false,
  disableClick: false,
  maxColumnCount: 2,
  maxInlineSize: 720,
  maxBlockSize: 1440,
  allowScript: false,
  // BookStyle
  zoomLevel: 1,
  lineHeight: 1.5,
  wordSpacing: 0,
  letterSpacing: 0,
  textIndent: 0,
  fullJustification: false,
  hyphenation: true,
  invertImgColorInDark: false,
  theme: 'light',
  overrideFont: false,
  overrideLayout: false,
  codeHighlighting: false,
  // BookFont
  serifFont: 'Georgia',
  sansSerifFont: 'sans-serif',
  monospaceFont: 'monospace',
  defaultFont: 'serif',
  defaultFontSize: 18,
  minimumFontSize: 10,
  fontWeight: 400,
  // ViewConfig
  uiLanguage: 'en',
  showHeader: true,
  showFooter: true,
  animated: true,
};

const LIBRARY_KEY = 'deepflip-library';
const SETTINGS_KEY = 'deepflip-settings';

/**
 * Returns null when the value is a session-scoped `blob:` URL that must not
 * be persisted.  `blob:` URLs are invalidated on page refresh, so we strip
 * them before writing to localStorage and restore them from IndexedDB later.
 */
function stripBlobUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  return url.startsWith('blob:') ? null : url;
}

export class WebAppService implements AppService {
  fs = indexedDBFileSystem;
  osPlatform: OsPlatform = 'unknown';
  appPlatform: AppPlatform = 'web';
  isMobile = false;
  isDesktopApp = false;

  async init(): Promise<void> {
    // Detect mobile
    if (typeof navigator !== 'undefined') {
      this.isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    }
  }

  async readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer> {
    return this.fs.readFile(path, base, mode);
  }

  async writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File): Promise<void> {
    return this.fs.writeFile(path, base, content);
  }

  async exists(path: string, base: BaseDir): Promise<boolean> {
    return this.fs.exists(path, base);
  }

  async getImageURL(path: string): Promise<string> {
    return this.fs.getImageURL(path);
  }

  getDefaultViewSettings(): ViewSettings {
    return { ...DEFAULT_VIEW_SETTINGS };
  }

  async importBook(file: string | File, books: Book[], saveBook = true): Promise<Book | null> {
    try {
      let fileObj: File;
      if (typeof file === 'string') {
        throw new Error('URL import not supported in web mode');
      } else {
        fileObj = file;
      }

      // Calculate hash from file content
      const buffer = await fileObj.arrayBuffer();
      const hashArray = new Uint8Array(buffer);
      const hash = md5.hex(hashArray);

      // Check if book already exists
      const existing = books.find((b) => b.hash === hash);
      if (existing) return existing;

      // Detect format
      const ext = fileObj.name.split('.').pop()?.toUpperCase() as Book['format'] | undefined;
      const format = ext || 'EPUB';

      const book: Book = {
        hash,
        format,
        title: fileObj.name.replace(/\.[^/.]+$/, ''),
        author: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        readingStatus: 'unread',
      };

      if (saveBook) {
        const bookPath = `${hash}.${format.toLowerCase()}`;
        await this.fs.writeFile(bookPath, 'Books', fileObj);
        book.filePath = bookPath;
      }

      return book;
    } catch (err) {
      console.error('importBook error', err);
      return null;
    }
  }

  async deleteBook(book: Book, _deleteAction: DeleteAction): Promise<void> {
    if (book.filePath) {
      try {
        await this.fs.removeFile(book.filePath, 'Books');
      } catch {
        // ignore
      }
    }
    // Remove persisted cover image
    try {
      await this.fs.removeFile(`cover-${book.hash}`, 'Data');
    } catch {
      // ignore — cover may not have been saved
    }
  }

  /**
   * Persist a cover image blob to IndexedDB so it survives page refresh.
   */
  async saveCoverImage(hash: string, blob: Blob): Promise<void> {
    const buffer = await blob.arrayBuffer();
    await this.fs.writeFile(`cover-${hash}`, 'Data', buffer);
  }

  /**
   * Restore a persisted cover image as a fresh blob: URL.
   * Returns null when no cover has been saved for this book.
   */
  async loadCoverImageUrl(hash: string): Promise<string | null> {
    try {
      const buffer = (await this.fs.readFile(`cover-${hash}`, 'Data', 'binary')) as ArrayBuffer;
      return URL.createObjectURL(new Blob([buffer]));
    } catch {
      return null;
    }
  }

  async loadBookConfig(book: Book): Promise<BookConfig> {
    try {
      const key = `config-${book.hash}`;
      const raw = await this.fs.readFile(key, 'Data', 'text');
      return JSON.parse(raw as string) as BookConfig;
    } catch {
      return { bookHash: book.hash, updatedAt: Date.now() };
    }
  }

  async saveBookConfig(book: Book, config: BookConfig): Promise<void> {
    const key = `config-${book.hash}`;
    await this.fs.writeFile(key, 'Data', JSON.stringify(config));
  }

  async loadBookContent(book: Book): Promise<BookContent> {
    if (!book.filePath) throw new Error('Book has no file path');
    const fileObj = await this.fs.openFile(book.filePath, 'Books', `${book.title}.${book.format.toLowerCase()}`);
    return { book, file: fileObj };
  }

  async loadLibraryBooks(): Promise<Book[]> {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Book[];
    } catch {
      return [];
    }
  }

  async saveLibraryBooks(books: Book[]): Promise<void> {
    // blob: URLs are session-scoped and must NOT be persisted.  They are
    // reconstructed from IndexedDB on the next page load.
    const serializable = books.map((b) => ({
      ...b,
      coverImageUrl: stripBlobUrl(b.coverImageUrl),
    }));
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(serializable));
  }

  getCoverImageUrl(book: Book): string {
    return book.coverImageUrl || '';
  }

  async saveFile(filename: string, content: string | ArrayBuffer, mimeType?: string): Promise<boolean> {
    try {
      const blob = new Blob([content], { type: mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  async ask(message: string): Promise<boolean> {
    return window.confirm(message);
  }
}

let _webAppService: WebAppService | null = null;
export const getWebAppService = async (): Promise<WebAppService> => {
  if (!_webAppService) {
    _webAppService = new WebAppService();
    await _webAppService.init();
  }
  return _webAppService;
};
