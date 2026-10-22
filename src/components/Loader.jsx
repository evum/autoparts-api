export default function Loader({ children }) {
  return (
    <div className="d-flex align-items-center gap-3 text-secondary py-4" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
