
import React, { useEffect, useRef, useCallback } from 'react';
import type { FoliateView, wrappedFoliateView as wrapView } from '@/types/view';
import type { BookDoc, TOCItem } from '@/libs/document';
import type { ViewSettings, PageInfo, TimeInfo } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';

interface FoliateViewerProps {
  bookKey: string;
  bookDoc: BookDoc;
  lastLocation?: string;
  viewSettings: ViewSettings;
  viewerKey: string;
}

// Register the foliate-view custom element if not already registered
async function ensureFoliateViewRegistered() {
  if (!customElements.get('foliate-view')) {
    await import('foliate-js/view.js');
  }
}

// Build the CSS renderer attributes from ViewSettings
function buildRendererAttrs(settings: ViewSettings): Record<string, string> {
  return {
    'flow': settings.scrolled ? 'scrolled' : 'paginated',
    'gap': String(settings.gapPercent / 100),
    'max-column-count': String(settings.maxColumnCount),
    'max-inline-size': String(settings.maxInlineSize),
    'max-block-size': String(settings.maxBlockSize),
    'margin-top': String(settings.marginTopPx),
    'margin-bottom': String(settings.marginBottomPx),
    'margin-left': String(settings.marginLeftPx),
    'margin-right': String(settings.marginRightPx),
  };
}

// Build the user stylesheet from ViewSettings
function buildUserStylesheet(settings: ViewSettings): string {
  const styles: string[] = [];
  if (settings.overrideFont) {
    styles.push(`* { font-family: ${settings.defaultFont}, serif !important; }`);
  }
  if (settings.lineHeight !== 1.5) {
    styles.push(`body { line-height: ${settings.lineHeight} !important; }`);
  }
  if (settings.letterSpacing !== 0) {
    styles.push(`body { letter-spacing: ${settings.letterSpacing}em !important; }`);
  }
  if (settings.wordSpacing !== 0) {
    styles.push(`body { word-spacing: ${settings.wordSpacing}em !important; }`);
  }
  if (settings.fullJustification) {
    styles.push(`body { text-align: justify !important; }`);
  }
  return styles.join('\n');
}

const FoliateViewer: React.FC<FoliateViewerProps> = ({
  bookKey,
  bookDoc,
  lastLocation,
  viewSettings,
  viewerKey,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoliateView | null>(null);
  const { setView, setViewInited, setIsLoading, setProgress } = useReaderStore();

  const handleRelocate = useCallback(
    (event: Event) => {
      const e = event as CustomEvent;
      const { cfi, fraction, location, section, pageinfo, time } = e.detail ?? {};
      if (!viewRef.current) return;

      const tocItems: TOCItem[] = (bookDoc.toc as TOCItem[] | undefined) ?? [];
      const findTOCItem = (items: TOCItem[], href: string): TOCItem | null => {
        for (const item of items) {
          if (item.href && href.startsWith(item.href)) return item;
          if (item.subitems) {
            const found = findTOCItem(item.subitems, href);
            if (found) return found;
          }
        }
        return null;
      };

      const tocItem = location?.href ? findTOCItem(tocItems, location.href) : null;

      const sectionInfo: PageInfo = {
        current: section?.current ?? 0,
        total: section?.total ?? 1,
      };
      const pageinfoData: PageInfo = {
        current: pageinfo?.current ?? 0,
        next: pageinfo?.next,
        total: pageinfo?.total ?? 1,
      };
      const timeinfoData: TimeInfo = {
        section: time?.section ?? 0,
        total: time?.total ?? 0,
      };

      // Get range from CFI
      let range: Range = document.createRange();
      try {
        const resolved = viewRef.current.resolveCFI(cfi);
        const contents = viewRef.current.renderer.getContents();
        for (const { doc, index } of contents) {
          if (index === resolved.index) {
            range = resolved.anchor(doc);
            break;
          }
        }
      } catch {
        // ignore range resolution errors
      }

      setProgress(bookKey, cfi ?? '', tocItem, sectionInfo, pageinfoData, timeinfoData, range);
    },
    [bookKey, bookDoc, setProgress],
  );

  useEffect(() => {
    let mounted = true;
    let view: FoliateView | null = null;

    const initView = async () => {
      if (!containerRef.current) return;
      await ensureFoliateViewRegistered();
      if (!mounted) return;

      // Create foliate-view element
      view = document.createElement('foliate-view') as FoliateView;
      view.style.width = '100%';
      view.style.height = '100%';

      // Apply renderer attributes
      const attrs = buildRendererAttrs(viewSettings);
      for (const [key, value] of Object.entries(attrs)) {
        view.setAttribute(key, value);
      }

      containerRef.current.appendChild(view);
      viewRef.current = view;

      // Listen to events
      view.addEventListener('relocate', handleRelocate);

      view.addEventListener('load', () => {
        if (!mounted) return;
        setViewInited(bookKey, true);
        setIsLoading(bookKey, false);
      });

      // Open the book
      try {
        await view.open(bookDoc);
        if (!mounted) return;

        // Initialize with last location
        if (lastLocation) {
          view.init({ lastLocation });
        }

        // Apply user styles
        const css = buildUserStylesheet(viewSettings);
        if (css && view.renderer.setStyles) {
          view.renderer.setStyles(css);
        }

        setView(bookKey, view);
        setIsLoading(bookKey, false);
      } catch (err) {
        console.error('Failed to open book in foliate viewer:', err);
      }
    };

    initView();

    return () => {
      mounted = false;
      if (view) {
        view.removeEventListener('relocate', handleRelocate);
        try {
          view.close();
        } catch {
          // ignore
        }
        view.remove();
        viewRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerKey]); // re-init when viewerKey changes

  return (
    <div
      ref={containerRef}
      className="foliate-viewer-container"
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
};

export default FoliateViewer;
