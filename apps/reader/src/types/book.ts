export type BookFormat =
  | 'EPUB'
  | 'MOBI'
  | 'AZW'
  | 'AZW3'
  | 'CBZ'
  | 'FB2'
  | 'FBZ'
  | 'TXT'
  | 'MD';

export type BookNoteType = 'bookmark' | 'annotation' | 'excerpt';
export type ReadingStatus = 'unread' | 'reading' | 'finished';
export type HighlightStyle = 'highlight' | 'underline' | 'squiggly';
export type HighlightColor = 'red' | 'yellow' | 'green' | 'blue' | 'violet' | string;

export const FIXED_LAYOUT_FORMATS: Set<BookFormat> = new Set(['CBZ']);

export interface Book {
  url?: string;
  filePath?: string;
  hash: string;
  metaHash?: string;
  format: BookFormat;
  title: string;
  sourceTitle?: string;
  author: string;
  groupId?: string;
  groupName?: string;
  tags?: string[];
  coverImageUrl?: string | null;

  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;

  uploadedAt?: number | null;
  downloadedAt?: number | null;
  coverDownloadedAt?: number | null;
  syncedAt?: number | null;

  progress?: [number, number];
  readingStatus?: ReadingStatus;
  primaryLanguage?: string;
}

export interface PageInfo {
  current: number;
  next?: number;
  total: number;
}

export interface TimeInfo {
  section: number;
  total: number;
}

export interface BookNote {
  bookHash?: string;
  metaHash?: string;
  id: string;
  type: BookNoteType;
  cfi: string;
  page?: number;
  text?: string;
  style?: HighlightStyle;
  color?: HighlightColor;
  note: string;

  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface BookLayout {
  marginTopPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  marginRightPx: number;
  gapPercent: number;
  scrolled: boolean;
  disableClick: boolean;
  maxColumnCount: number;
  maxInlineSize: number;
  maxBlockSize: number;
  allowScript: boolean;
}

export interface BookStyle {
  zoomLevel: number;
  lineHeight: number;
  wordSpacing: number;
  letterSpacing: number;
  textIndent: number;
  fullJustification: boolean;
  hyphenation: boolean;
  invertImgColorInDark: boolean;
  theme: string;
  overrideFont: boolean;
  overrideLayout: boolean;
  codeHighlighting: boolean;
}

export interface BookFont {
  serifFont: string;
  sansSerifFont: string;
  monospaceFont: string;
  defaultFont: string;
  defaultFontSize: number;
  minimumFontSize: number;
  fontWeight: number;
}

export interface ViewConfig {
  uiLanguage: string;
  showHeader: boolean;
  showFooter: boolean;
  animated: boolean;
}

export interface ViewSettings extends BookLayout, BookStyle, BookFont, ViewConfig {}

export interface BookProgress {
  location: string;
  sectionHref: string;
  sectionLabel: string;
  section: PageInfo;
  pageinfo: PageInfo;
  timeinfo: TimeInfo;
  index: number;
  range: Range;
  page: number;
}

export interface BookSearchConfig {
  scope: 'book' | 'section';
  matchCase: boolean;
  matchWholeWords: boolean;
  index?: number;
  query?: string;
}

export interface BookConfig {
  bookHash?: string;
  progress?: [number, number];
  location?: string;
  booknotes?: BookNote[];
  searchConfig?: Partial<BookSearchConfig>;
  viewSettings?: Partial<ViewSettings>;
  updatedAt: number;
}

export interface BookContent {
  book: Book;
  file: File;
}

export interface BooksGroup {
  id: string;
  name: string;
  displayName: string;
  books: Book[];
  updatedAt: number;
}
