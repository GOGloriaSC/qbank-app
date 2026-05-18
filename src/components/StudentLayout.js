import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, NavLink, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";

export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [showDropdown, setShowDropdown] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef(null);
  const [badgeCounts, setBadgeCounts] = useState({ review: 0, feedback: 0 });

  // Ambil jumlah untuk badge
  const fetchBadgeCounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count: reviewCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("status", "review")
      .eq("reviewer_id", user.id);

    const { count: feedbackCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("status", "feedback")
      .eq("user_id", user.id);

    setBadgeCounts({
      review: reviewCount || 0,
      feedback: feedbackCount || 0,
    });
  };

  // Update badge saat navigasi
  useEffect(() => {
    fetchBadgeCounts();
  }, [location.pathname]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        if (error && error.code !== "PGRST116") console.error(error);
        setProfile({
          name: profileData?.name || user.email?.split("@")[0] || "Siswa",
          email: user.email,
        });
        await fetchBadgeCounts();
      }
    };
    getUser();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    const confirmLogout = window.confirm("Apakah Anda yakin ingin keluar?");
    if (confirmLogout) {
      setLoggingOut(true);
      await supabase.auth.signOut();
      navigate("/");
    }
  };

  const getInitials = () => {
    const name = profile.name;
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const avatarColor = () => {
    let hash = 0;
    for (let i = 0; i < profile.email.length; i++) {
      hash = profile.email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`;
  };

  // Menu items dengan ikon versi B dan badge
  const menuItems = [
    { path: "/student", icon: "🏠", tooltip: "Dashboard", exact: true, badge: null },
    { path: "/student/add-question", icon: "✏️", tooltip: "Add Question", exact: false, badge: null },
    { path: "/student/review-question", icon: "🔍", tooltip: "Review", exact: false, badge: badgeCounts.review > 0 ? badgeCounts.review : null },
    { path: "/student/feedback-question", icon: "💬", tooltip: "Feedback", exact: false, badge: badgeCounts.feedback > 0 ? badgeCounts.feedback : null },
    { path: "/student/report", icon: "📈", tooltip: "Report", exact: false, badge: null },
  ];

  return (
    <>
      <style>
        {`
          .student-layout {
            min-height: 100vh;
            background: linear-gradient(135deg, #0f172a, #1e293b);
            color: white;
            padding: 20px;
          }
          .student-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.2);
            position: relative;
          }
          .logo-area {
            display: flex;
            align-items: center;
            gap: 15px;
            background: rgba(0,0,0,0.3);
            padding: 8px 16px;
            border-radius: 12px;
          }
          .logo-img {
            width: 80px;
            height: auto;
            filter: brightness(1.1) drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          }
          .logo-text h2 {
            margin: 0;
            font-size: 1.5rem;
            color: white;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          .logo-text p {
            margin: 0;
            font-size: 0.8rem;
            color: #e2e8f0;
          }
          .search-form {
            display: flex;
            gap: 10px;
            flex: 1;
            max-width: 400px;
          }
          .search-input {
            flex: 1;
            padding: 10px 15px;
            border-radius: 30px;
            border: none;
            background: #334155;
            color: white;
            font-size: 1rem;
            outline: none;
          }
          .search-input::placeholder {
            color: #94a3b8;
          }
          .search-button {
            background: #7c3aed;
            border: none;
            border-radius: 30px;
            padding: 0 20px;
            cursor: pointer;
            font-size: 1rem;
            color: white;
            transition: background 0.2s;
          }
          .search-button:hover {
            background: #6d28d9;
          }
          .profile-area {
            position: relative;
          }
          .profile-avatar {
            width: 45px;
            height: 45px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.3rem;
            color: white;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          .profile-avatar:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          .dropdown-menu {
            position: absolute;
            top: 55px;
            right: 0;
            background: #1e293b;
            border-radius: 12px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            min-width: 220px;
            z-index: 1000;
            overflow: hidden;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.1);
          }
          .dropdown-item {
            padding: 10px 16px;
            cursor: pointer;
            transition: background 0.2s;
            color: #e2e8f0;
          }
          .dropdown-item:hover:not(.disabled) {
            background: #334155;
          }
          .dropdown-item.disabled {
            cursor: default;
            opacity: 0.8;
          }
          .dropdown-divider {
            margin: 4px 0;
            border-color: #475569;
          }
          .logout {
            color: #f87171;
          }
          .logout:hover {
            background: #451a1a;
          }
          .student-body {
            display: flex;
            gap: 20px;
          }
          .sidebar {
            width: 80px;
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(8px);
            border-radius: 16px;
            padding: 20px 0;
            border: 1px solid rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .menu-item {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            padding: 12px 0;
            color: #cbd5f5;
            text-decoration: none;
            transition: background 0.2s;
            margin: 4px 0;
          }
          .menu-item:hover {
            background: rgba(255,255,255,0.1);
            color: white;
          }
          .menu-item.active {
            background: rgba(124, 58, 237, 0.3);
            border-left: 3px solid #7c3aed;
            color: white;
          }
          .menu-icon {
            font-size: 1.6rem;
            position: relative;
            display: inline-block;
          }
          .menu-badge {
            position: absolute;
            top: -8px;
            right: -12px;
            background-color: #ef4444;
            color: white;
            font-size: 0.65rem;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 999px;
            min-width: 18px;
            text-align: center;
            line-height: 1.2;
            box-shadow: 0 0 0 2px #1e293b;
          }
          .menu-item .tooltip-text {
            visibility: hidden;
            position: absolute;
            left: 70px;
            background: #1e293b;
            color: white;
            text-align: center;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.8rem;
            white-space: nowrap;
            z-index: 1;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
          .menu-item:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
          }
          .main-content {
            flex: 1;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 16px;
            padding: 20px;
          }
          .content-card {
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            padding: 20px;
          }
          @media (max-width: 768px) {
            .student-header {
              flex-direction: column;
              align-items: stretch;
            }
            .student-body {
              flex-direction: column;
            }
            .sidebar {
              width: 100%;
              flex-direction: row;
              justify-content: center;
              gap: 20px;
              padding: 10px;
            }
            .menu-item {
              width: auto;
              padding: 8px 16px;
            }
            .menu-badge {
              top: -5px;
              right: -5px;
            }
            .menu-item .tooltip-text {
              left: auto;
              top: 50px;
            }
          }
        `}
      </style>

      <div className="student-layout">
        <header className="student-header">
          <div className="logo-area">
            <img src={logo} alt="Logo" className="logo-img" />
            <div className="logo-text">
              <h2>QBank</h2>
              <p>Student Dashboard</p>
            </div>
          </div>

          <form className="search-form" onSubmit={(e) => {
            e.preventDefault();
            // Pindah ke dashboard utama (StudentDashboard) dengan searchTerm yang sudah diinput
            navigate("/student");
            }}>

            <input
              type="text"
              placeholder="Cari berdasarkan mata pelajaran, bab, sub bab, atau kata kunci..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="search-button">🔍</button>
          </form>

          <div className="profile-area" ref={dropdownRef}>
            <div
              className="profile-avatar"
              style={{ backgroundColor: avatarColor() }}
              onClick={() => setShowDropdown(!showDropdown)}
              title={profile.name}
            >
              {getInitials()}
            </div>
            {showDropdown && (
              <div className="dropdown-menu">
                <div className="dropdown-item disabled">
                  <strong>{profile.name}</strong><br />
                  <small>{profile.email}</small>
                </div>
                <hr className="dropdown-divider" />
                <div className="dropdown-item" onClick={() => navigate("/student/profile")}>
                  👤 Profil Saya
                </div>
                <div className="dropdown-item" onClick={() => navigate("/student/settings")}>
                  ⚙️ Pengaturan
                </div>
                <hr className="dropdown-divider" />
                <div className="dropdown-item logout" onClick={handleLogout}>
                  {loggingOut ? "⏳ Keluar..." : "🚪 Keluar"}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="student-body">
          <aside className="sidebar">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) => 
                  isActive ? "menu-item active" : "menu-item"
                }
              >
                <span className="menu-icon">
                  {item.icon}
                  {item.badge !== null && (
                    <span className="menu-badge">{item.badge}</span>
                  )}
                </span>
                <span className="tooltip-text">{item.tooltip}</span>
              </NavLink>
            ))}
          </aside>
          <main className="main-content">
            <div className="content-card">
              <Outlet context={{ searchTerm }} />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}