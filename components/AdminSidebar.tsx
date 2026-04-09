import Link from 'next/link';

export function AdminSidebar() {
  return (
    <aside className="card sidebar">
      <div className="card-pad">
        <h2 className="heading-md">Admin</h2>
        <div className="text-muted" style={{ marginBottom: 14 }}>Visual calendar + motel operations</div>
        <div className="grid">
          <Link href="/admin/calendar">Calendar</Link>
          <Link href="/admin/bookings">Bookings</Link>
          <Link href="/admin/rooms">Rooms</Link>
          <Link href="/admin/reports">Reports</Link>
        </div>
      </div>
    </aside>
  );
}
