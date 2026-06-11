import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

export default function ActivityUser() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("all");
  const [searchUser, setSearchUser] = useState("");

  const actionList = [
    "question_draft",
    "question_review",
    "question_feedback",
    "question_revision",
    "question_publish",
    "question_archive",
    "change_password"
  ];

  // Helper: hapus tag HTML dan ubah entitas menjadi teks biasa
  const stripHtml = (html) => {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("Tidak ada user login");
        setActivities([]);
        setLoading(false);
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profileError || profile?.role !== "admin") {
        console.warn("User bukan admin, tidak bisa melihat aktivitas");
        setActivities([]);
        setLoading(false);
        return;
      }

      const { data: activitiesData, error: actError } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (actError) {
        console.error("❌ Error fetching activities:", actError);
        setActivities([]);
        setLoading(false);
        return;
      }

      if (!activitiesData || activitiesData.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(activitiesData.map(a => a.user_id).filter(Boolean))];
      let profilesMap = new Map();
      if (userIds.length > 0) {
        const { data: profilesData, error: profError } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);
        if (!profError && profilesData) {
          profilesMap = new Map(profilesData.map(p => [p.id, p]));
        } else {
          console.error("Error fetching profiles:", profError);
        }
      }

      // Hanya gabungkan data profil, tidak perlu mengambil soal
      const enriched = activitiesData.map(act => ({
        ...act,
        profiles: profilesMap.get(act.user_id) || null,
      }));

      setActivities(enriched);
    } catch (err) {
      console.error("🔥 Unexpected error:", err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const filteredActivities = activities.filter((act) => {
    const matchAction = filterAction === "all" || act.action === filterAction;
    const userName = act.profiles?.name?.toLowerCase() || "";
    const userEmail = act.profiles?.email?.toLowerCase() || "";
    const searchLower = searchUser.toLowerCase();
    const matchUser = searchUser === "" || userName.includes(searchLower) || userEmail.includes(searchLower);
    return matchAction && matchUser;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadge = (action) => {
    const styles = {
      question_draft: { bg: "#6b7280", label: "Draft" },
      question_review: { bg: "#f59e0b", label: "Kirim Review" },
      question_feedback: { bg: "#ef4444", label: "Feedback" },
      question_revision: { bg: "#8b5cf6", label: "Revisi" },
      question_publish: { bg: "#10b981", label: "Publish" },
      question_archive: { bg: "#3b82f6", label: "Arsip" },
      change_password: { bg: "#ef4444", label: "Ubah Password" },
    };
    const s = styles[action] || { bg: "#64748b", label: action.replace(/_/g, " ") };
    return (
      <span
        style={{
          background: s.bg,
          padding: "2px 10px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: "bold",
          color: "white",
          display: "inline-block",
        }}
      >
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 16px" }}>
      <div style={styles.header}>
        <h2>📜 Riwayat Aktivitas User</h2>
        <button onClick={fetchActivities} style={styles.refreshBtn} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Aksi:</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={styles.select}
          >
            <option value="all">Semua Aksi</option>
            {actionList.map((act) => (
              <option key={act} value={act}>
                {act.replace(/_/g, " ").toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Cari User:</label>
          <input
            type="text"
            placeholder="Nama atau email..."
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={{ overflowX: "auto", background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "4px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155" }}>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Aksi</th>
              <th style={thStyle}>Deskripsi</th>
              <th style={thStyle}>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", padding: "40px" }}>
                  ⏳ Memuat data...
                </td>
              </tr>
            )}
            {!loading && filteredActivities.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", padding: "40px" }}>
                  Tidak ada aktivitas yang ditemukan.
                </td>
              </tr>
            )}
            {!loading &&
              filteredActivities.map((activity) => {
                // Bersihkan deskripsi dari HTML
                const cleanDescription = stripHtml(activity.description);

                return (
                  <tr key={activity.id} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={tdStyle}>
                      <strong>{activity.profiles?.name || "-"}</strong>
                      <br />
                      <small style={{ color: "#94a3b8" }}>{activity.profiles?.email || "-"}</small>
                    </td>
                    <td style={tdStyle}>{getActionBadge(activity.action)}</td>
                    <td style={tdStyle}>{cleanDescription || "-"}</td>
                    <td style={tdStyle}>{formatDate(activity.created_at)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "10px",
  },
  refreshBtn: {
    background: "#7c3aed",
    border: "none",
    borderRadius: "8px",
    padding: "6px 16px",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  },
  filterBar: {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
    flexWrap: "wrap",
    background: "rgba(255,255,255,0.05)",
    padding: "12px 16px",
    borderRadius: "12px",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  label: {
    color: "#cbd5e1",
    fontWeight: "500",
  },
  select: {
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#1e293b",
    color: "white",
    cursor: "pointer",
  },
  searchInput: {
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#1e293b",
    color: "white",
    width: "220px",
  },
};

const thStyle = {
  textAlign: "left",
  padding: "12px",
  background: "rgba(0,0,0,0.3)",
  borderBottom: "1px solid #334155",
  color: "#e2e8f0",
};

const tdStyle = {
  padding: "12px",
  verticalAlign: "top",
};