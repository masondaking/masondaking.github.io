import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { DevBadge } from "../ui/DevBadge";
import { useDebug } from "../../context/DebugContext";
import { clsx } from "clsx";
import { useRoles } from "../../context/RolesContext";
import { RoleBadge } from "../ui/RoleBadge";

const navLinks = [
  { label: "Features", to: "/#features" },
  { label: "Stories", to: "/stories" },
  { label: "AI Studio", to: "/studio" },
  { label: "Pricing", to: "/#pricing" },
  { label: "FAQ", to: "/#faq" },
];

export function MainNav() {
  const { user, logout } = useAuth();
  const { getRole, getUserRoleId } = useRoles();
  const { toggleConsole } = useDebug();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === "/";

  const handleNavigate = () => {
    setIsOpen(false);
  };

  return (
    <header className={clsx("site-header", location.pathname === "/" && "site-header--glass")}>
      <div className="site-header__inner">
        <Link to="/" className="site-logo" onClick={handleNavigate}>
          <span className="site-logo__mark" aria-hidden>
            <img src="/brand-mark.svg" alt="" />
          </span>
          <span className="site-logo__text">Dreamscribe</span>
        </Link>
        <nav className={clsx("site-nav", isOpen && "site-nav--open")}>
          {navLinks.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              onClick={handleNavigate}
              className={({ isActive }) => clsx("site-nav__link", isActive && "site-nav__link--active")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="site-header__cta">
          {isLanding && (
            <span className="site-header__version" aria-label="Site version">v1.0 · Public</span>
          )}
          <button type="button" className="site-header__link" onClick={toggleConsole}>
            Debug
          </button>
          {user && (
            <>
              <Link to="/settings" className="site-header__link" onClick={handleNavigate}>
                Settings
              </Link>
              {(user.isDev || user.isAdmin) && (
                <Link to="/dev" className="site-header__link" onClick={handleNavigate}>
                  Dev tools
                </Link>
              )}
            </>
          )}
          {user ? (
            <div className="site-header__user">
              <div className="site-header__user-main">
                <span className="site-header__avatar">{user.displayName?.[0]?.toUpperCase() ?? "U"}</span>
                <div className="site-header__name-wrap">
                  <span className="site-header__username">{user.displayName}</span>
                  <span className="site-header__email">{user.email}</span>
                </div>
              </div>
              <div className="site-header__user-tags">
                {(() => {
                  const id = getUserRoleId(user.username, { isDev: user.isDev, isAdmin: user.isAdmin });
                  const role = getRole(id);
                  return <RoleBadge role={role} size="sm" />;
                })()}
                {user.isDev && <DevBadge size="sm" />}
                <button type="button" className="logout-button" onClick={logout}>
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <div className="site-header__auth">
              <Link to="/login" className="ghost-button" onClick={handleNavigate}>
                Log in
              </Link>
              <Link to="/signup" className="primary-button" onClick={handleNavigate}>
                Sign up
              </Link>
            </div>
          )}
        </div>
        <button
          type="button"
          className="site-header__menu"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}

