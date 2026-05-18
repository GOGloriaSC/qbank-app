import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useOutletContext } from "react-router-dom";

export default function TeacherDashboard() {
  const { searchTerm } = useOutletContext();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [stats, setStats] = useState({
    totalQuestions: 0,
    reviewQuestions: 0,
    publishedQuestions: 0,
  });
  const [publishedQuestions, setPublishedQuestions] = useState([]);
  const [submitting, setSubmitting] = useState({});
  const [attemptsData, setAttemptsData] = useState({});
  const [showAnswer, setShowAnswer] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [usersMap, setUsersMap] = useState({}); // mapping id -> name

  // Filter soal berdasarkan searchTerm
  const filteredQuestions = publishedQuestions.filter((q) => {
    if (!searchTerm || !searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (q.subject && q.subject.toLowerCase().includes(term)) ||
      (q.chapter && q.chapter.toLowerCase().includes(term)) ||
      (q.subchapter && q.subchapter.toLowerCase().includes(term)) ||
      (q.question_text && q.question_text.toLowerCase().includes(term))
    );
  });

  // Ambil user & role
  useEffect(() => {
    document.title = "Dashboard | Aplikasiku";
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(profile?.role || "murid");
      }
    };
    fetchUser();
  }, []);

  // Ambil nama dari profiles
  const fetchUserNames = useCallback(async (userIds) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", uniqueIds);
    if (error) {
      console.error(error);
      return;
    }
    const map = {};
    data.forEach(prof => {
      map[prof.id] = prof.name || prof.id;
    });
    setUsersMap(prev => ({ ...prev, ...map }));
  }, []);

  const getDateRange = useCallback((period) => {
    const now = new Date();
    const start = new Date();
    switch (period) {
      case "day": start.setHours(0,0,0,0); break;
      case "week": start.setDate(now.getDate() - 7); break;
      case "month": start.setMonth(now.getMonth() - 1); break;
      case "semester": start.setMonth(now.getMonth() - 6); break;
      case "year": start.setFullYear(now.getFullYear() - 1); break;
      default: start.setDate(now.getDate() - 7);
    }
    return { start, end: now };
  }, []);

  const fetchStats = useCallback(async () => {
    if (userRole !== "guru") return;
    const { start, end } = getDateRange(period);
    const { count: totalCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());
    const { count: reviewCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("status", "review")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());
    const { count: publishCount } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("status", "publish")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());
    setStats({
      totalQuestions: totalCount || 0,
      reviewQuestions: reviewCount || 0,
      publishedQuestions: publishCount || 0,
    });
  }, [period, getDateRange, userRole]);

  const fetchPublishedQuestions = useCallback(async () => {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "publish")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else {
      setPublishedQuestions(data || []);
      // Kumpulkan user_id dan reviewer_id
      const userIds = [];
      (data || []).forEach(q => {
        if (q.user_id) userIds.push(q.user_id);
        if (q.reviewer_id) userIds.push(q.reviewer_id);
      });
      if (userIds.length) await fetchUserNames(userIds);
    }
  }, [fetchUserNames]);

  useEffect(() => {
    if (!user) return;
    const fetchAttempts = async () => {
      const { data: attempts } = await supabase
        .from("attempts")
        .select("*")
        .eq("user_id", user.id);
      const map = {};
      (attempts || []).forEach(att => {
        if (!map[att.question_id]) map[att.question_id] = [];
        map[att.question_id].push(att);
      });
      setAttemptsData(map);
    };
    fetchAttempts();
  }, [user, publishedQuestions]);

  useEffect(() => {
    if (userRole === null) return;
    const loadData = async () => {
      setLoading(true);
      await fetchPublishedQuestions();
      if (userRole === "guru") await fetchStats();
      setLoading(false);
    };
    loadData();
  }, [userRole, fetchPublishedQuestions, fetchStats, period]);

  const handleSubmitAnswer = async (questionId, selectedAnswer) => {
    if (!selectedAnswer) {
      alert("Pilih jawaban terlebih dahulu.");
      return;
    }
    if (userRole !== "murid") {
      alert("Hanya siswa yang bisa menjawab soal.");
      return;
    }
    setSubmitting(prev => ({ ...prev, [questionId]: true }));
    const question = publishedQuestions.find(q => q.id === questionId);
    if (!question) {
      alert("Soal tidak ditemukan.");
      setSubmitting(prev => ({ ...prev, [questionId]: false }));
      return;
    }
    const isCorrect = selectedAnswer.toLowerCase() === question.answer?.toLowerCase();
    const pointsEarned = isCorrect ? (question.points || 10) : 0;

    const { error } = await supabase.from("attempts").insert({
      question_id: questionId,
      user_id: user.id,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    });
    if (error) {
      console.error(error);
      alert("Gagal menyimpan jawaban.");
    } else {
      alert(isCorrect ? `✅ Jawaban benar! +${pointsEarned} poin` : "❌ Jawaban salah.");
      const { data: newAttempts } = await supabase
        .from("attempts")
        .select("*")
        .eq("question_id", questionId)
        .eq("user_id", user.id);
      setAttemptsData(prev => ({ ...prev, [questionId]: newAttempts || [] }));
    }
    setSubmitting(prev => ({ ...prev, [questionId]: false }));
  };

  const handleArchive = async (id) => {
    const question = publishedQuestions.find(q => q.id === id);
    if (!question) {
      alert("Soal tidak ditemukan.");
      return;
    }
    if (!window.confirm("Arsipkan soal ini? Soal asli tetap dipublikasi, salinan akan disimpan di arsip pribadi Anda.")) return;
    setProcessingId(id);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("User tidak ditemukan.");
      setProcessingId(null);
      return;
    }

    const archivedQuestion = {
      subject: question.subject,
      chapter: question.chapter,
      subchapter: question.subchapter,
      learning_objective: question.learning_objective,
      indicator: question.indicator,
      question_type: question.question_type,
      question_text: question.question_text,
      options: question.options,
      answer: question.answer,
      source: question.source,
      points: question.points || 0,
      status: "archive",
      user_id: question.user_id,                 // penyusun asli
      reviewer_id: question.reviewer_id,         // publisher asli
      archived_by: user.id,                      // ✅ siapa yang mengarsipkan
      created_at: new Date().toISOString(),
      reviewer_comment: null,
      feedback_image_url: null,
      revision_note: null,
      revision_image_url: null,
    };

    const { error } = await supabase.from("questions").insert([archivedQuestion]);
    if (error) {
      console.error(error);
      alert("Gagal mengarsipkan soal.");
    } else {
      alert("Soal berhasil diarsipkan ke arsip pribadi Anda.");
    }
    setProcessingId(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus soal ini secara permanen? Tindakan ini tidak dapat dibatalkan.")) return;
    setProcessingId(id);
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Gagal menghapus soal.");
    } else {
      alert("Soal berhasil dihapus.");
      setPublishedQuestions(prev => prev.filter(q => q.id !== id));
      if (userRole === "guru") await fetchStats();
    }
    setProcessingId(null);
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div>
      <p>Selamat datang, <strong>{user?.email || "Pengguna"}</strong></p>

      {userRole === "guru" && (
        <>
          <div style={styles.filterBar}>
            <label>Filter Periode: </label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} style={styles.select}>
              <option value="day">Hari Ini</option>
              <option value="week">Minggu Ini</option>
              <option value="month">Bulan Ini</option>
              <option value="semester">Semester Ini</option>
              <option value="year">Tahun Ini</option>
            </select>
          </div>
          <div style={styles.statsContainer}>
            <div style={styles.statCard}><h3>📝 Add Question</h3><p style={styles.statNumber}>{stats.totalQuestions}</p><small>Soal dibuat</small></div>
            <div style={styles.statCard}><h3>👁️ Review Question</h3><p style={styles.statNumber}>{stats.reviewQuestions}</p><small>Menunggu review</small></div>
            <div style={styles.statCard}><h3>📢 Publish</h3><p style={styles.statNumber}>{stats.publishedQuestions}</p><small>Soal terpublish</small></div>
          </div>
        </>
      )}

      <div style={styles.publishSection}>
        <h2>📖 Bank Soal Publik</h2>
        <p>
          {userRole === "murid"
            ? "Kerjakan soal di bawah ini. Jawaban Anda dicatat secara privat."
            : "Berikut soal-soal yang telah dipublikasi. Guru dapat mengarsipkan (menyalin ke arsip) atau menghapus soal."}
        </p>
        {filteredQuestions.length === 0 && (
          <p>{searchTerm ? `Tidak ada soal dengan kata kunci "${searchTerm}".` : "Belum ada soal yang dipublikasi."}</p>
        )}
        {filteredQuestions.map((q) => {
          const options = q.options || {};
          const optionKeys = Object.keys(options).sort();
          const userAttempts = attemptsData[q.id] || [];
          const lastAttempt = userAttempts[userAttempts.length - 1];
          const bonusPoints = q.points || 0;
          const creatorName = usersMap[q.user_id] || q.user_id || "Tidak diketahui";
          const publisherName = usersMap[q.reviewer_id] || q.reviewer_id || "Tidak diketahui";

          return (
            <div key={q.id} style={styles.questionCard}>
              {/* Baris 1: kiri (meta) + kanan (badge dan tombol) */}
              <div style={styles.cardHeaderWrapper}>
                <div style={styles.metaRow}>
                  <span style={styles.subject}>{q.subject || "Mata Pelajaran"}</span>
                  <span style={styles.bab}>Bab: {q.chapter || "-"}</span>
                  <span style={styles.subbab}>Sub Bab: {q.subchapter || "-"}</span>
                </div>
                <div style={styles.rightGroup}>
                  <span style={styles.publishBadge}>Status: Publish</span>
                  {bonusPoints > 0 && (
                    <span style={styles.pointsBadge}>🏆 +{bonusPoints} poin</span>
                  )}
                  {userRole === "guru" && (
                    <div style={styles.buttonGroup}>
                      <button onClick={() => handleArchive(q.id)} disabled={processingId === q.id} style={styles.archiveBtn}>
                        {processingId === q.id ? "..." : "📦 Arsip"}
                      </button>
                      <button onClick={() => handleDelete(q.id)} disabled={processingId === q.id} style={styles.deleteBtn}>
                        🗑️ Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Baris 2: Penyusun & Publisher */}
              <div style={styles.authorRow}>
                <span>✍️ Penyusun Soal: {creatorName}</span>
                <span>📢 Publisher: {publisherName}</span>
              </div>

              {/* Soal */}
              <div style={styles.questionText}>{q.question_text}</div>

              {/* Opsi jawaban */}
              <div style={styles.optionsContainer}>
                <strong>Pilihan Jawaban:</strong>
                <ul style={styles.optionsList}>
                  {optionKeys.map((key) => (
                    <li key={key}><strong>{key.toUpperCase()}.</strong> {options[key]}</li>
                  ))}
                </ul>
              </div>

              {userRole === "guru" && (
                <div style={styles.teacherAnswer}>
                  <button onClick={() => setShowAnswer(prev => ({ ...prev, [q.id]: !prev[q.id] }))} style={styles.toggleAnswerBtn}>
                    {showAnswer[q.id] ? "Sembunyikan" : "Lihat"} Kunci Jawaban
                  </button>
                  {showAnswer[q.id] && <div style={styles.answerBox}><strong>Jawaban Benar:</strong> {q.answer?.toUpperCase()}</div>}
                </div>
              )}

              {userRole === "murid" && (
                <div style={styles.studentAnswerSection}>
                  <div style={styles.studentPointsInfo}>
                    {bonusPoints > 0 && (
                      <span style={styles.studentPointsBadge}>✨ Bonus: +{bonusPoints} poin jika jawaban benar</span>
                    )}
                  </div>
                  <label style={styles.label}>Jawaban Anda:</label>
                  <select defaultValue="" onChange={(e) => handleSubmitAnswer(q.id, e.target.value)} disabled={submitting[q.id]} style={styles.selectAnswer}>
                    <option value="" disabled>-- Pilih jawaban --</option>
                    {optionKeys.map(key => <option key={key} value={key}>{key.toUpperCase()}</option>)}
                  </select>
                  {submitting[q.id] && <span style={styles.small}> Mengirim...</span>}
                  {userAttempts.length > 0 && (
                    <div style={styles.attemptInfo}>
                      <p>Anda telah mencoba {userAttempts.length} kali.</p>
                      {lastAttempt && <p>Hasil terakhir: {lastAttempt.is_correct ? "✅ Benar" : "❌ Salah"}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  filterBar: { margin: "20px 0", display: "flex", alignItems: "center", gap: "10px" },
  select: { padding: "8px 12px", borderRadius: "8px", border: "none", background: "#334155", color: "white", cursor: "pointer" },
  statsContainer: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "40px" },
  statCard: { background: "rgba(255,255,255,0.05)", padding: "20px", borderRadius: "12px", textAlign: "center", backdropFilter: "blur(4px)" },
  statNumber: { fontSize: "2.5rem", margin: "10px 0", fontWeight: "bold", color: "#a78bfa" },
  publishSection: { marginTop: "30px" },
  questionCard: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    backdropFilter: "blur(4px)",
  },
  cardHeaderWrapper: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "12px",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",
    fontSize: "0.9rem",
  },
  subject: { fontWeight: "bold", color: "#a78bfa" },
  bab: { color: "#cbd5f5" },
  subbab: { color: "#cbd5f5" },
  rightGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  publishBadge: {
    background: "#10b981",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    color: "white",
  },
  pointsBadge: {
    background: "#f59e0b",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    color: "#1e293b",
  },
  buttonGroup: { display: "flex", gap: "8px" },
  archiveBtn: { background: "#f59e0b", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", color: "white", fontSize: "0.8rem" },
  deleteBtn: { background: "#dc2626", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", color: "white", fontSize: "0.8rem" },
  authorRow: {
    display: "flex",
    gap: "24px",
    fontSize: "0.85rem",
    color: "#94a3b8",
    marginBottom: "16px",
    borderBottom: "1px solid #334155",
    paddingBottom: "8px",
  },
  questionText: { fontSize: "1rem", marginBottom: "12px", lineHeight: "1.5" },
  optionsContainer: { marginBottom: "12px" },
  optionsList: { listStyle: "none", paddingLeft: 0, marginTop: "5px" },
  teacherAnswer: { marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px" },
  toggleAnswerBtn: { background: "#3b82f6", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", color: "white", fontSize: "0.85rem" },
  answerBox: { marginTop: "8px", background: "#1e293b", padding: "8px", borderRadius: "6px" },
  studentAnswerSection: { marginTop: "16px", padding: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px" },
  studentPointsInfo: { marginBottom: "12px" },
  studentPointsBadge: { background: "#fbbf24", color: "#0f172a", padding: "4px 8px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: "bold" },
  label: { fontWeight: "bold", marginRight: "10px" },
  selectAnswer: { padding: "8px", borderRadius: "6px", border: "none", background: "#334155", color: "white", cursor: "pointer" },
  small: { marginLeft: "10px", fontSize: "0.8rem", color: "#a78bfa" },
  attemptInfo: { marginTop: "8px", fontSize: "0.85rem", color: "#cbd5f5" },
};