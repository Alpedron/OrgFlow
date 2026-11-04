import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import orgflowLogo from "../assets/sg200.png";

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="landing-header">
      <Link className="landing-brand" to="/" onClick={closeMenu} aria-label="OrgFlow home">
        <img src={orgflowLogo} alt="OrgFlow Logo" className="landing-brand-mark" />
        <span>
          <strong>OrgFlow</strong>
          <small>STUDENT ORGANIZATION HUB</small>
        </span>
      </Link>
      <button
        className="landing-menu-toggle"
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav className={`landing-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
        <Link to="/" onClick={closeMenu}>Home</Link>
        <Link to="/upcoming-events" onClick={closeMenu}>Upcoming events</Link>
        <Link to="/past-events" onClick={closeMenu}>Past events</Link>
        <Link to="/organizations" onClick={closeMenu}>Orgs / Clubs</Link>
        <Link to="/#about" onClick={closeMenu}>About us</Link>
        <Link className="landing-login-link" to="/login" onClick={closeMenu}>Log in to OrgFlow</Link>
      </nav>
    </header>
  );
}
