import { createFileRoute } from '@tanstack/react-router';
import Reader from '@/components/reader/Reader';

export const Route = createFileRoute('/reader/$bookId')({
  component: ReaderPage,
});

function ReaderPage() {
  const { bookId } = Route.useParams();
  return <Reader bookId={bookId} />;
}
