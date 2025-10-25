export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__content">
        <div>
          <span className="site-footer__brand">Dreamscribe</span>
          <p className="site-footer__tagline">
            Craft immersive tales, revisit past drafts, and build the worlds you dream about.
          </p>
        </div>
        <div className="site-footer__links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a href="mailto:support@dreamscribe.app">Support</a>
        </div>
      </div>
      <div className="site-footer__meta">
        <span>© {new Date().getFullYear()} Dreamscribe Labs</span>
        <div className="site-footer__meta-links">
          <a href="#terms">Terms</a>
          <a href="#privacy">Privacy</a>
        </div>
      </div>
    </footer>
  );
}
