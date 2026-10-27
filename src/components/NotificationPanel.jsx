export default function NotificationPanel({ items = [] }) {
  return (
    <div className="panel">
      <div className="section-head">
        <h2>Notifications</h2>
        <span className="badge">
          {items.filter((x) => !x.is_read).length} new
        </span>
      </div>
      {items.map((n) => (
        <div className={`notification ${n.is_read ? "" : "unread"}`} key={n.id}>
          <b>{n.title}</b>
          <p>{n.message}</p>
          <small>{new Date(n.created_at).toLocaleString()}</small>
        </div>
      ))}
      {!items.length && <p className="muted">No notifications.</p>}
    </div>
  );
}
