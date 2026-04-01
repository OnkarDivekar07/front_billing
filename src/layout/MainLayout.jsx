import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import "./layout.css";

const NAV = [
  { to: "/",              label: "🏠 होम",             end: true  },
  { to: "/search",        label: "🔍 प्रॉडक्ट शोधा",  end: false },
  { to: "/daily",         label: "📘 दैनंदिन नोंदी",   end: false },
  { to: "/search-stock",  label: "📦 स्टॉक अपडेट",    end: false },
  { to: "/missing-items", label: "🛒 नसलेल्या वस्तू",  end: false },
  { to: "/expenses",       label: "💸 खर्च व बॅलन्स",        end: false },
];

export default function MainLayout() {
  const [open, setOpen]   = useState(false);
  const navigate          = useNavigate();
  const location          = useLocation();

  // Close sidebar on route change (covers programmatic navigations too)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="app">
      {/* Mobile hamburger */}
      <button
        className="hamburger"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2>Advika Auto</h2>
          <button className="close-btn" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
        </div>

        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          🚪 लॉगआउट
        </button>
      </aside>

      {/* Overlay */}
      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      {/* Page content */}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
