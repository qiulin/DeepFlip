import { createFileRoute } from '@tanstack/react-router';
import Library from '@/components/library/Library';

export const Route = createFileRoute('/library')({
  component: LibraryPage,
});

function LibraryPage() {
  return <Library />;
}
