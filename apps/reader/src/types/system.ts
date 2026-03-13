import type { Book, BookConfig, BookContent, ViewSettings } from './book';

export type AppPlatform = 'web' | 'tauri';
export type OsPlatform = 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown';
export type BaseDir = 'Books' | 'Settings' | 'Data' | 'Fonts' | 'Images' | 'Log' | 'Cache' | 'Temp' | 'None';
export type DeleteAction = 'cloud' | 'local' | 'both';

export type ResolvedPath = {
  baseDir: number;
  basePrefix: () => Promise<string>;
  fp: string;
  base: BaseDir;
};

export type FileItem = {
  path: string;
  size: number;
};

export type FileInfo = {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: Date | null;
  atime: Date | null;
  birthtime: Date | null;
};

export interface FileSystem {
  resolvePath(path: string, base: BaseDir): ResolvedPath;
  getURL(path: string): string;
  getBlobURL(path: string, base: BaseDir): Promise<string>;
  getImageURL(path: string): Promise<string>;
  openFile(path: string, base: BaseDir, filename?: string): Promise<File>;
  copyFile(srcPath: string, dstPath: string, base: BaseDir): Promise<void>;
  readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File): Promise<void>;
  removeFile(path: string, base: BaseDir): Promise<void>;
  readDir(path: string, base: BaseDir): Promise<FileItem[]>;
  createDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  removeDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  exists(path: string, base: BaseDir): Promise<boolean>;
  stats(path: string, base: BaseDir): Promise<FileInfo>;
  getPrefix(base: BaseDir): Promise<string>;
}

export interface AppService {
  osPlatform: OsPlatform;
  appPlatform: AppPlatform;
  isMobile: boolean;
  isDesktopApp: boolean;

  init(): Promise<void>;
  readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, base: BaseDir, content: string | ArrayBuffer | File): Promise<void>;
  exists(path: string, base: BaseDir): Promise<boolean>;
  getImageURL(path: string): Promise<string>;

  getDefaultViewSettings(): ViewSettings;
  importBook(file: string | File, books: Book[], saveBook?: boolean): Promise<Book | null>;
  deleteBook(book: Book, deleteAction: DeleteAction): Promise<void>;
  loadBookConfig(book: Book): Promise<BookConfig>;
  saveBookConfig(book: Book, config: BookConfig): Promise<void>;
  loadBookContent(book: Book): Promise<BookContent>;
  loadLibraryBooks(): Promise<Book[]>;
  saveLibraryBooks(books: Book[]): Promise<void>;
  getCoverImageUrl(book: Book): string;
  saveFile(filename: string, content: string | ArrayBuffer, mimeType?: string): Promise<boolean>;
  ask(message: string): Promise<boolean>;
}
