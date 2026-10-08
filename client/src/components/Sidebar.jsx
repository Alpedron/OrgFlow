import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Sparkles,
  FolderOpen,
  Flame,
  ChevronDown,
  GraduationCap,
  LogOut,
  Settings,
  Copy,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { copyTextToClipboard } from "../utils/clipboard.js";
import "./Sidebar.css";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard",    Icon: LayoutDashboard },
    ],
  },
  {
    label: "Plan & Execute",
    items: [
      { to: "/events",  label: "Event Planner",  Icon: Calendar },
      { to: "/tasks",   label: "Tasks",           Icon: CheckSquare },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { to: "/ask",       label: "Ask OrgFlow",  Icon: Sparkles },
      { to: "/resources", label: "Resources",    Icon: FolderOpen },
    ],
  },
  {
    label: "Organization",
    items: [
      { to: "/organization", label: "Members & Roles", Icon: Settings },
    ],
  },
  {
    label: "Handoff",
    items: [
      { to: "/pass-the-torch", label: "Pass the Torch", Icon: Flame },
    ],
  },
];

const SHOW_DEV = import.meta.env.VITE_SHOW_DEV_BANNER === "true";

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const orgName = user?.org?.name || "Student Government";
  const orgInitials = orgName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const inviteCode = user?.org?.join_code;

  async function copyInvite() {
    setCopyError("");
    try {
      await copyTextToClipboard(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyError("Couldn't copy. Select the invite code and copy it manually.");
    }
  }
  const menuRef = useRef(null);

  // Close the org menu when clicking anywhere else
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">
          <GraduationCap size={18} />
        </span>
        <span className="sidebar-logo-text">OrgFlow</span>
      </div>

      {/* Org switcher */}
      <div className="sidebar-org" ref={menuRef}>
        <button className="sidebar-org-btn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
          <span className="sidebar-org-avatar">{orgInitials}</span>
          <span className="sidebar-org-info">
            <span className="sidebar-org-label">Organization</span>
            <span className="sidebar-org-name" title={orgName}>{orgName}</span>
          </span>
          <ChevronDown size={13} className="sidebar-org-chevron" />
        </button>
        {menuOpen && (
          <div className="sidebar-org-menu" role="menu">
            <div className="sidebar-org-menu-user">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
            {inviteCode && (
              <div className="sidebar-org-invite">
                <span>Invite code — share with officers and your successors</span>
                <div>
                  <code>{inviteCode}</code>
                  <button onClick={copyInvite} title="Copy invite code">
                    <Copy size={13} /> {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {copyError && <span role="status">{copyError}</span>}
              </div>
            )}
            <button role="menuitem" onClick={() => { setMenuOpen(false); navigate("/setup"); }}>
              <Settings size={14} /> Edit organization
            </button>
            <button role="menuitem" onClick={handleSignOut}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label}>
            <span className="sidebar-group-label">{label}</span>
            {items.map(({ to, label: itemLabel, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  "sidebar-link" + (isActive ? " sidebar-link--active" : "")
                }
              >
                <span className="sidebar-icon">
                  <Icon size={15} />
                </span>
                {itemLabel}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {SHOW_DEV && <span className="sidebar-mock-badge" style={{ marginBottom: 8, display: "inline-flex" }}>⚙ Mock mode</span>}
        <button className="sidebar-signout-btn" onClick={handleSignOut}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
