type WeddingNavProps = {
  onRSVPClick?: () => void;
};

export function WeddingNav({ onRSVPClick }: WeddingNavProps) {
  return (
    <nav className="wedding-nav">
      <a href="#top" className="wedding-nav-brand">
        JP &amp; J
      </a>

      <div className="wedding-nav-links">
        <a href="#details">Details</a>
        <a href="#celebration">Celebration</a>

        <button type="button" onClick={onRSVPClick}>
          RSVP
        </button>
      </div>
    </nav>
  );
}
