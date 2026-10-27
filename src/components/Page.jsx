export default function Page({
  title,
  eyebrow,
  description,
  action,
  children,
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
