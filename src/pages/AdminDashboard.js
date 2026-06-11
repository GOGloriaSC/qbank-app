import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalPublishedQuestions: 0,
  });
  const [statusStats, setStatusStats] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [pendingUsers, setPendingUsers] = useState([]);
  const [processingApprovalId, setProcessingApprovalId] = useState(null);

  const COLORS = {
    draft: "#6b7280",
    review: "#f59e0b",
    feedback: "#ef4444",
    publish: "#10b981",
    archive: "#8b5cf6",
  };

  const fetchPendingUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPendingUsers(data || []);
    } catch (error) {
      console.error("Error fetching pending users:", error);
    }
  }, []);

  const fetchStatsAndChart = useCallback(async () => {
    setLoading(true);
    try {
      // Statistik jumlah user dan soal publish
      const { count: totalStudents } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student");
      const { count: totalTeachers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "teacher");
      const { count: totalPublishedQuestions } = await supabase
        .from("questions")
        .select("*", { count: "exact", head: true })
        .eq("status", "publish");

      setStats({
        totalStudents: totalStudents || 0,
        totalTeachers: totalTeachers || 0,
        totalPublishedQuestions: totalPublishedQuestions || 0,
      });

      // Distribusi status soal (untuk bar chart)
      const statuses = ["draft", "review", "feedback", "publish", "archive"];
      const statusCounts = await Promise.all(
        statuses.map(async (status) => {
          const { count } = await supabase
            .from("questions")
            .select("*", { count: "exact", head: true })
            .eq("status", status);
          return { name: status, value: count || 0 };
        })
      );
      setStatusStats(statusCounts);

      // Data perkembangan soal publish per bulan di tahun terpilih
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const { data: questions, error } = await supabase
        .from("questions")
        .select("created_at")
        .eq("status", "publish")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (error) throw error;

      // Inisialisasi jumlah per bulan (1-12)
      const monthlyCounts = Array(12).fill(0);
      questions.forEach((q) => {
        const month = new Date(q.created_at).getMonth(); // 0-11
        monthlyCounts[month]++;
      });

      const months = [
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Ags", "Sep", "Okt", "Nov", "Des"
      ];
      const chartArray = months.map((month, idx) => ({
        month,
        count: monthlyCounts[idx],
      }));
      setChartData(chartArray);

      await fetchPendingUsers();
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, fetchPendingUsers]);

  useEffect(() => {
    document.title = "Admin Dashboard | QBank";
    fetchStatsAndChart();
  }, [fetchStatsAndChart]);

  const handleApproveUser = async (userId) => {
    if (!window.confirm("Setujui user ini?")) return;
    setProcessingApprovalId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: "approved" })
        .eq("id", userId);
      if (error) throw error;
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      fetchStatsAndChart();
    } catch (error) {
      console.error(error);
      alert("Gagal menyetujui user.");
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleRejectUser = async (userId) => {
    if (!window.confirm("Tolak user ini? Data profile akan dihapus dari sistem.")) return;
    setProcessingApprovalId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);
      if (error) throw error;
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      fetchStatsAndChart();
    } catch (error) {
      console.error(error);
      alert("Gagal menolak user.");
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const yearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      years.push(y);
    }
    return years;
  };

  const statusNameMap = {
    draft: "Draft",
    review: "Review",
    feedback: "Feedback",
    publish: "Publish",
    archive: "Arsip",
  };

  if (loading) return <div style={styles.loading}>Memuat dashboard...</div>;

  const isAllStatusZero = statusStats.every(item => item.value === 0);
  const totalPublishedInYear = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div>
      <h2>Dashboard Admin</h2>
      <p>Selamat datang, admin! Berikut ringkasan sistem.</p>

      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>👨‍🎓</div>
          <div style={styles.statNumber}>{stats.totalStudents}</div>
          <div style={styles.statLabel}>Siswa</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>👩‍🏫</div>
          <div style={styles.statNumber}>{stats.totalTeachers}</div>
          <div style={styles.statLabel}>Guru</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📚</div>
          <div style={styles.statNumber}>{stats.totalPublishedQuestions}</div>
          <div style={styles.statLabel}>Soal Terpublish</div>
        </div>
      </div>

      {/* Distribusi Status Soal */}
      <div style={styles.section}>
        <h3>📊 Distribusi Status Soal</h3>
        <div style={styles.chartContainer}>
          {isAllStatusZero ? (
            <div style={styles.noData}>Belum ada data soal.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={statusStats}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tickFormatter={(val) => statusNameMap[val] || val}
                />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [value, "Jumlah Soal"]}
                  labelFormatter={(label) => statusNameMap[label] || label}
                  contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "8px" }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusStats.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name] || "#64748b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Perkembangan Jumlah Soal (Publish) - Filter sederhana hanya tahun */}
      <div style={styles.section}>
        <div style={styles.chartHeader}>
          <h3>📈 Perkembangan Jumlah Soal (Publish)</h3>
          <div style={styles.filterGroup}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={styles.select}
            >
              {yearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chartData.every(item => item.count === 0) ? (
          <div style={styles.noData}>
            📭 Tidak ada data soal publish untuk tahun {selectedYear}.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '12px', textAlign: 'right' }}>
              <span style={{ background: '#1e293b', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9rem' }}>
                📊 Total soal terbit: <strong>{totalPublishedInYear}</strong> soal
              </span>
            </div>
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis
                    stroke="#94a3b8"
                    label={{ value: 'Jumlah Soal', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ backgroundColor: '#1e293b', padding: '8px 12px', border: '1px solid #475569', borderRadius: '8px' }}>
                            <p style={{ margin: 0, color: '#e2e8f0' }}><strong>{label}</strong></p>
                            <p style={{ margin: '4px 0 0', color: '#a78bfa' }}>📘 Soal terbit: <strong>{payload[0].value}</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" name="Jumlah Soal" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Tabel User Menunggu Approval */}
      <div style={styles.section}>
        <h3>⏳ User Menunggu Persetujuan</h3>
        {pendingUsers.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>Tidak ada user yang menunggu approval.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Tanggal Daftar</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name || "-"}</td>
                    <td>{user.email}</td>
                    <td>
                      {user.role === "teacher"
                        ? "Guru"
                        : user.role === "student"
                        ? "Siswa"
                        : "Admin"}
                    </td>
                    <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}</td>
                    <td>
                      <button
                        onClick={() => handleApproveUser(user.id)}
                        disabled={processingApprovalId === user.id}
                        style={{ ...styles.approveButton, marginRight: "8px" }}
                      >
                        {processingApprovalId === user.id ? "..." : "✓ Setujui"}
                      </button>
                      <button
                        onClick={() => handleRejectUser(user.id)}
                        disabled={processingApprovalId === user.id}
                        style={styles.rejectButton}
                      >
                        {processingApprovalId === user.id ? "..." : "✗ Tolak"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  statsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "20px",
    marginBottom: "40px",
  },
  statCard: {
    background: "rgba(255,255,255,0.05)",
    padding: "20px",
    borderRadius: "12px",
    textAlign: "center",
    backdropFilter: "blur(4px)",
  },
  statIcon: { fontSize: "2.5rem", marginBottom: "10px" },
  statNumber: { fontSize: "2rem", fontWeight: "bold", color: "#a78bfa" },
  statLabel: { fontSize: "0.9rem", color: "#cbd5e1" },
  section: { marginBottom: "40px" },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "15px",
  },
  filterGroup: { display: "flex", gap: "10px" },
  select: {
    background: "#1e293b",
    border: "1px solid #475569",
    borderRadius: "8px",
    padding: "8px 12px",
    color: "white",
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  chartContainer: { background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "16px" },
  noData: {
    textAlign: "center",
    padding: "40px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "12px",
    color: "#94a3b8",
  },
  tableWrapper: { overflowX: "auto" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "12px",
    overflow: "hidden",
  },
  approveButton: {
    background: "#10b981",
    border: "none",
    borderRadius: "6px",
    padding: "4px 12px",
    cursor: "pointer",
    color: "white",
    fontSize: "0.8rem",
  },
  rejectButton: {
    background: "#ef4444",
    border: "none",
    borderRadius: "6px",
    padding: "4px 12px",
    cursor: "pointer",
    color: "white",
    fontSize: "0.8rem",
  },
};