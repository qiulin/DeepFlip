
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useLibraryStore } from '@/store/libraryStore';
import type { Book } from '@/types/book';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const ACCEPTED_BOOK_EXTS = ['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.cbz', '.fb2', '.fbz', '.txt'];

const Library: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const { library, setLibrary, addBook, removeBook, setLoading } = useLibraryStore();

  // Load library on mount
  useEffect(() => {
    const loadLibrary = async () => {
      setLoading(true);
      try {
        const { getWebAppService } = await import('@/services/webAppService');
        const svc = await getWebAppService();
        const books = await svc.loadLibraryBooks();
        // Restore cover image URLs from IndexedDB — blob: URLs are
        // session-scoped and are not persisted to localStorage.
        const booksWithCovers = await Promise.all(
          books.map(async (book) => {
            if (!book.coverImageUrl) {
              const url = await svc.loadCoverImageUrl(book.hash);
              return url ? { ...book, coverImageUrl: url } : book;
            }
            return book;
          }),
        );
        setLibrary(booksWithCovers);
      } catch (err) {
        console.error('Failed to load library:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLibrary();
  }, []);

  // Save library whenever it changes
  useEffect(() => {
    const saveLibrary = async () => {
      try {
        const { getWebAppService } = await import('@/services/webAppService');
        const svc = await getWebAppService();
        await svc.saveLibraryBooks(library);
      } catch (err) {
        console.error('Failed to save library:', err);
      }
    };
    if (library.length > 0) saveLibrary();
  }, [library]);

  const importFiles = useCallback(async (files: File[]) => {
    setImporting(true);
    setImportError(null);
    try {
      const { getWebAppService } = await import('@/services/webAppService');
      const svc = await getWebAppService();
      for (const file of files) {
        const book = await svc.importBook(file, library);
        if (book) {
          // Try to extract metadata
          try {
            const { DocumentLoader } = await import('@/libs/document');
            const loader = new DocumentLoader(file);
            const { book: bookDoc } = await loader.open();
            if (bookDoc.metadata?.title) {
              const titleStr = typeof bookDoc.metadata.title === 'string'
                ? bookDoc.metadata.title
                : String(Object.values(bookDoc.metadata.title as Record<string, string>)[0] ?? book.title);
              book.title = titleStr;
            }
            if (bookDoc.metadata?.author) {
              const authorStr = typeof bookDoc.metadata.author === 'string'
                ? bookDoc.metadata.author
                : (bookDoc.metadata.author as { name?: string })?.name ?? '';
              book.author = authorStr;
            }
            // Extract cover
            const coverBlob = await bookDoc.getCover();
            if (coverBlob) {
              book.coverImageUrl = URL.createObjectURL(coverBlob);
              // Persist the cover binary so it can be restored after page refresh
              await svc.saveCoverImage(book.hash, coverBlob);
            }
          } catch {
            // metadata extraction is best-effort
          }
          addBook(book);
        }
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [library, addBook]);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) importFiles(files);
      e.target.value = '';
    },
    [importFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPTED_BOOK_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)),
      );
      if (files.length) importFiles(files);
    },
    [importFiles],
  );

  const handleOpenBook = useCallback(
    (book: Book) => {
      navigate({ to: '/reader/$bookId', params: { bookId: book.hash } });
    },
    [navigate],
  );

  const handleDeleteBook = useCallback(
    async (book: Book, e: React.MouseEvent) => {
      e.stopPropagation();
      const confirmed = window.confirm(`Delete "${book.title}" from library?`);
      if (!confirmed) return;
      try {
        const { getWebAppService } = await import('@/services/webAppService');
        const svc = await getWebAppService();
        await svc.deleteBook(book, 'local');
        removeBook(book.hash);
      } catch (err) {
        console.error('Delete error:', err);
      }
    },
    [removeBook],
  );

  const sortedLibrary = [...library].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div
      className="min-h-screen bg-background"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <span className="text-xl font-bold">📚 DeepFlip</span>
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? <Loader2 className="animate-spin" /> : null}
          {importing ? 'Importing…' : '+ Import'}
        </Button>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_BOOK_EXTS.join(',')}
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Drag-over overlay */}
      {dragOver && (
        <div className="fixed inset-0 bg-primary/10 border-4 border-dashed border-primary z-50 flex items-center justify-center pointer-events-none">
          <p className="text-2xl font-bold text-primary">Drop books here to import</p>
        </div>
      )}

      {/* Error alert */}
      {importError && (
        <div className="mx-4 mt-4">
          <Alert variant="destructive" className="flex items-center justify-between">
            <AlertDescription>Import error: {importError}</AlertDescription>
            <Button variant="ghost" size="xs" onClick={() => setImportError(null)}>✕</Button>
          </Alert>
        </div>
      )}

      {/* Library grid */}
      <main className="p-4">
        {sortedLibrary.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
            <span className="text-6xl">📖</span>
            <p className="text-xl font-semibold">Your library is empty</p>
            <p className="text-sm">Import an ebook (EPUB, PDF, MOBI…) to get started</p>
            <Button onClick={() => fileInputRef.current?.click()}>Import a Book</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sortedLibrary.map((book) => (
              <BookCard
                key={book.hash}
                book={book}
                onOpen={handleOpenBook}
                onDelete={handleDeleteBook}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

interface BookCardProps {
  book: Book;
  onOpen: (book: Book) => void;
  onDelete: (book: Book, e: React.MouseEvent) => void;
}

const BookCard: React.FC<BookCardProps> = ({ book, onOpen, onDelete }) => {
  const progress = book.progress
    ? Math.round((book.progress[0] / book.progress[1]) * 100)
    : 0;

  return (
    <div
      className={cn(
        'book-card relative rounded-lg border bg-card text-card-foreground shadow-sm',
        'cursor-pointer hover:shadow-md transition-all group overflow-hidden',
      )}
      onClick={() => onOpen(book)}
    >
      {/* Cover */}
      <div className="aspect-[2/3] overflow-hidden bg-muted">
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt={`Cover of ${book.title}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
            <span className="text-4xl">📖</span>
          </div>
        )}
      </div>

      <div className="p-2 space-y-1">
        <h3 className="text-xs font-semibold leading-tight line-clamp-2 min-h-[2rem]">
          {book.title}
        </h3>
        {book.author && (
          <p className="text-xs text-muted-foreground truncate">{book.author}</p>
        )}
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{book.format}</Badge>
          {book.readingStatus === 'finished' && (
            <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">Done</Badge>
          )}
        </div>
        {progress > 0 && (
          <Progress value={progress} max={100} className="h-1 mt-1" />
        )}
      </div>

      {/* Delete button */}
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full text-xs"
        onClick={(e) => onDelete(book, e)}
        title="Delete book"
      >
        ✕
      </Button>
    </div>
  );
};

export default Library;
