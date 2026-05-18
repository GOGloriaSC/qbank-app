import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ReportQuestionStudent() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [studentData, setStudentData] = useState({
    summary: { totalPoints: 0, totalAttempts: 0, correctCount: 0, successRate: 0 },
    history: [],
    leaderboard: [],
    userRank: null,
  });

  useEffect(() => {
    document.title = "Report | Aplikasiku";
    fetchStudentReport();
  }, []);

  const fetchStudentReport = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      // 1. Ambil data user yang sedang login
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("User tidak ditemukan. Silakan login kembali.");

      // 2. Ambil semua attempts dari user ini, lengkap dengan data soal
      const { data: attempts, error: attemptsError } = await supabase
        .from("attempts")
        .select(`
          id, question_id, is_correct, points_earned, created_at,
          questions (subject, question_text)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (attemptsError) throw attemptsError;

      // Hitung data summary untuk student ini
      const totalPoints = attempts?.reduce((sum, att) => sum + (att.points_earned || 0), 0) || 0;
      const totalAttempts = attempts?.length || 0;
      const correctCount = attempts?.filter(att => att.is_correct === true).length || 0;
      const successRate = totalAttempts > 0 ? ((correctCount / totalAttempts) * 100).toFixed(1) : 0;

      setStudentData(prev => ({
        ...prev,
        summary: { totalPoints, totalAttempts, correctCount, successRate },
        history: attempts || [],
      }));

      // 3. Ambil data untuk leaderboard global
      const { data: allPoints, error: leaderboardError } = await supabase
        .from("attempts")
        .select("user_id, points_earned");

      if (leaderboardError) throw leaderboardError;

      // Hitung total poin per user
      const userPointsMap = new Map();
      allPoints?.forEach(att => {
        const userId = att.user_id;
        const currentPoints = userPointsMap.get(userId) || 0;
        userPointsMap.set(userId, currentPoints + (att.points_earned || 0));
      });

      // Konversi ke array dan urutkan
      let leaderboardData = Array.from(userPointsMap.entries()).map(([userId, total]) => ({
        user_id: userId,
        total_points: total,
      }));
      leaderboardData.sort((a, b) => b.total_points - a.total_points);

      // Batasi ke 5 besar untuk ditampilkan
      const top5 = leaderboardData.slice(0, 5);

      // Cari peringkat user saat ini
      const userRank = leaderboardData.findIndex(item => item.user_id === user.id) + 1;

      // Ambil nama user untuk top 5 dan user sendiri (untuk ditampilkan di leaderboard nanti)
      const userIdsToFetch = [...top5.map(item => item.user_id), user.id];
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIdsToFetch);
      if (profileError) throw profileError;

      const profileMap = new Map(profiles?.map(p => [p.id, p.name || "Pengguna"]));

      const leaderboardWithNames = top5.map(item => ({
        ...item,
        user_name: profileMap.get(item.user_id) || item.user_id.slice(0, 8),
      }));

      setStudentData(prev => ({
        ...prev,
        leaderboard: leaderboardWithNames,
        userRank: userRank > 0 ? userRank : null,
      }));

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={styles.loading}>Loading laporan Anda...</div>;
  if (errorMsg) return <div style={styles.error}>Error: {errorMsg}</div>;

  return (
    <div>
      <h2>📊 Laporan Perkembangan Saya</h2>
      <p>Ringkatan poin, riwayat jawaban, dan perbandingan dengan siswa lain.</p>

      {/* 1. Summary Cards */}
      <div style={styles.summaryContainer}>
        <div style={styles.summaryCard}>
          <h3>🏆 Total Poin</h3>
          <p style={styles.summaryNumber}>{studentData.summary.totalPoints}</p>
        </div>
        <div style={styles.summaryCard}>
          <h3>📝 Soal Dikerjakan</h3>
          <p style={styles.summaryNumber}>{studentData.summary.totalAttempts}</p>
          <small>✅ Benar: {studentData.summary.correctCount}</small>
        </div>
        <div style={styles.summaryCard}>
          <h3>📈 Tingkat Keberhasilan</h3>
          <p style={styles.summaryNumber}>{studentData.summary.successRate}%</p>
        </div>
        <div style={styles.summaryCard}>
          <h3>⭐ Rata-rata Poin</h3>
          <p style={styles.summaryNumber}>
            {studentData.summary.totalAttempts > 0 
              ? (studentData.summary.totalPoints / studentData.summary.totalAttempts).toFixed(1) 
              : 0}
          </p>
        </div>
      </div>

      <div style={styles.historyAndLeaderboardWrapper}>
        {/* 2. Riwayat Poin (History Table) */}
        <div style={styles.historySection}>
          <h3>📜 Riwayat Perolehan Poin</h3>
          {studentData.history.length === 0 ? (
            <p>Anda belum mengerjakan soal apapun.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Mata Pelajaran</th>
                  <th>Soal</th>
                  <th>Status</th>
                  <th>Poin Didapat</th>
                  <th>Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {studentData.history.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>{item.questions?.subject || "-"}</td>
                    <td style={styles.questionText}>
                      {item.questions?.question_text?.substring(0, 80)}
                      {item.questions?.question_text?.length > 80 ? "..." : ""}
                    </td>
                    <td>
                      <span style={item.is_correct ? styles.correctBadge : styles.wrongBadge}>
                        {item.is_correct ? "✅ Benar" : "❌ Salah"}
                      </span>
                    </td>
                    <td style={item.points_earned > 0 ? styles.pointsEarned : styles.pointsZero}>
                      {item.points_earned > 0 ? `+${item.points_earned}` : "0"}
                    </td>
                    <td>{new Date(item.created_at).toLocaleDateString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 3. Papan Peringkat (Leaderboard) */}
        <div style={styles.leaderboardSection}>
          <h3>🏅 Papan Peringkat Poin</h3>
          {studentData.leaderboard.length > 0 ? (
            <>
              <table style={styles.leaderboardTable}>
                <thead>
                  <tr>
                    <th>Peringkat</th>
                    <th>Siswa</th>
                    <th>Total Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {studentData.leaderboard.map((item, idx) => {
                    const rank = idx + 1;
                    let medal = "";
                    if (rank === 1) medal = "🥇 ";
                    else if (rank === 2) medal = "🥈 ";
                    else if (rank === 3) medal = "🥉 ";
                    return (
                      <tr key={item.user_id}>
                        <td style={styles.rankCell}>{medal}{rank}</td>
                        <td>{item.user_name}</td>
                        <td style={styles.pointsCell}>{item.total_points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {studentData.userRank && studentData.userRank > 5 && (
                <div style={styles.userRankInfo}>
                  ✨ Peringkat Anda saat ini: <strong>#{studentData.userRank}</strong>
                </div>
              )}
            </>
          ) : (
            <p>Data leaderboard belum tersedia.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  error: { textAlign: "center", padding: "50px", color: "#ef4444" },
  summaryContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  summaryCard: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "16px",
    textAlign: "center",
    backdropFilter: "blur(4px)",
  },
  summaryNumber: {
    fontSize: "2rem",
    fontWeight: "bold",
    margin: "8px 0",
    color: "#a78bfa",
  },
  historyAndLeaderboardWrapper: {
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
  },
  historySection: {
    flex: 3,
    minWidth: "300px",
    overflowX: "auto",
  },
  leaderboardSection: {
    flex: 1,
    minWidth: "250px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "12px",
    padding: "16px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "8px",
    overflow: "hidden",
    marginTop: "12px",
  },
  leaderboardTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "12px",
  },
  questionText: {
    textAlign: "left",
  },
  correctBadge: {
    background: "#10b98120",
    color: "#10b981",
    padding: "4px 8px",
    borderRadius: "16px",
    fontSize: "0.75rem",
    fontWeight: "bold",
  },
  wrongBadge: {
    background: "#ef444420",
    color: "#ef4444",
    padding: "4px 8px",
    borderRadius: "16px",
    fontSize: "0.75rem",
    fontWeight: "bold",
  },
  pointsEarned: {
    color: "#10b981",
    fontWeight: "bold",
    textAlign: "center",
  },
  pointsZero: {
    color: "#6b7280",
    textAlign: "center",
  },
  rankCell: {
    fontWeight: "bold",
  },
  pointsCell: {
    fontWeight: "bold",
    color: "#fbbf24",
    textAlign: "center",
  },
  userRankInfo: {
    marginTop: "16px",
    padding: "12px",
    background: "#3b82f620",
    borderRadius: "8px",
    textAlign: "center",
    fontSize: "0.9rem",
  },
};

// Global style untuk tabel
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  table th, table td {
    border: 1px solid rgba(255,255,255,0.2);
    padding: 10px;
    text-align: left;
  }
  table th {
    background: rgba(0,0,0,0.3);
    font-weight: bold;
  }
  .leaderboard-section table th, .leaderboard-section table td {
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
`;
document.head.appendChild(styleSheet);