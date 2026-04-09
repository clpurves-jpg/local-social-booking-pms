import type { BookingStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`badge ${status}`}>{status.replace('_', ' ')}</span>;
}
