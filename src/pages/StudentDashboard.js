import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useOutletContext } from "react-router-dom";

export default function StudentDashboard() {
  const { searchTerm } = useOutletContext();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishedQuestions, setPublishedQuestions] = useState([]);
  const [submitting, setSubmitting] = useState({});
  const [attemptsData, setAttemptsData] = useState({});
  const [usersMap, setUsersMap] = useState({});

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

  useEffect(() => {
    document.title = "Dashboard | Aplikasiku";
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

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

  const fetchPublishedQuestions = useCallback(async () => {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "publish")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else {
      setPublishedQuestions(data || []);
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
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPublishedQuestions();
      setLoading(false);
    };
    loadData();
  }, [fetchPublishedQuestions]);

  const handleSubmitAnswer = async (questionId, selectedAnswer) => {
    if (!selectedAnswer) {
      alert("Pilih jawaban terlebih dahulu.");
      return;
    }
    const existingAttempts = attemptsData[questionId] || [];
    if (existingAttempts.length > 0) {
      alert("Anda sudah pernah menjawab soal ini. Kesempatan hanya sekali.");
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
    const pointsEarned = isCorrect ? (question.points || 0) : 0;

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
      alert(isCorrect ? `✅ Jawaban benar! +${pointsEarned} poin` : `❌ Jawaban salah. Poin 0. Jawaban yang benar: ${question.answer?.toUpperCase()}`);
      const { data: newAttempts } = await supabase
        .from("attempts")
        .select("*")
        .eq("question_id", questionId)
        .eq("user_id", user.id);
      setAttemptsData(prev => ({ ...prev, [questionId]: newAttempts || [] }));
    }
    setSubmitting(prev => ({ ...prev, [questionId]: false }));
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div>
      <p>Selamat datang, <strong>{user?.email || "Siswa"}</strong></p>

      <div style={styles.publishSection}>
        <h2>📖 Bank Soal Publik</h2>
        <p>Kerjakan soal di bawah ini. Setiap soal hanya bisa dijawab satu kali.</p>
        {filteredQuestions.length === 0 && (
          <p>{searchTerm ? `Tidak ada soal dengan kata kunci "${searchTerm}".` : "Belum ada soal yang dipublikasi."}</p>
        )}
        {filteredQuestions.map((q) => {
          const options = q.options || {};
          const optionKeys = Object.keys(options).sort();
          const userAttempts = attemptsData[q.id] || [];
          const hasAttempted = userAttempts.length > 0;
          const lastAttempt = userAttempts[userAttempts.length - 1];
          const bonusPoints = q.points || 0;
          const creatorName = usersMap[q.user_id] || q.user_id || "Tidak diketahui";
          const publisherName = usersMap[q.reviewer_id] || q.reviewer_id || "Tidak diketahui";

          return (
            <div key={q.id} style={styles.questionCard}>
              {/* Header dengan flex: kiri metaRow, kanan badge */}
              <div style={styles.cardHeaderWrapper}>
                <div style={styles.metaRow}>
                  <span style={styles.subject}>{q.subject || "Mata Pelajaran"}</span>
                  <span style={styles.bab}>Bab: {q.chapter || "-"}</span>
                  <span style={styles.subbab}>Sub Bab: {q.subchapter || "-"}</span>
                </div>
                <span style={styles.publishBadge}>Status: Publish</span>
              </div>

              {/* Baris 2: Penyusun Soal & Publisher */}
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

              {/* Bagian attempt */}
              <div style={styles.studentAnswerSection}>
                {bonusPoints > 0 && (
                  <div style={styles.studentPointsInfo}>
                    <span style={styles.studentPointsBadge}>🏆 Bonus: +{bonusPoints} poin jika jawaban benar</span>
                  </div>
                )}

                {hasAttempted ? (
                  <div style={styles.attemptResultBox}>
                    <div style={lastAttempt.is_correct ? styles.correctResult : styles.wrongResult}>
                      {lastAttempt.is_correct ? "✅ Anda telah menjawab benar" : "❌ Anda telah menjawab salah"}
                    </div>
                    {!lastAttempt.is_correct && (
                      <div style={styles.correctAnswerDisplay}>
                        💡 Jawaban yang benar adalah: <strong>{q.answer?.toUpperCase()}</strong>
                      </div>
                    )}
                    {lastAttempt.is_correct && (
                      <div style={styles.pointEarnedDisplay}>🏅 Poin yang didapat: +{lastAttempt.points_earned}</div>
                    )}
                  </div>
                ) : (
                  <>
                    <label style={styles.label}>Jawaban Anda:</label>
                    <select
                      defaultValue=""
                      onChange={(e) => handleSubmitAnswer(q.id, e.target.value)}
                      disabled={submitting[q.id]}
                      style={styles.selectAnswer}
                    >
                      <option value="" disabled>-- Pilih jawaban --</option>
                      {optionKeys.map(key => <option key={key} value={key}>{key.toUpperCase()}</option>)}
                    </select>
                    {submitting[q.id] && <span style={styles.small}> Mengirim...</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  publishSection: { marginTop: "30px" },
  questionCard: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    backdropFilter: "blur(4px)",
    position: "relative",
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
  subject: {
    fontWeight: "bold",
    color: "#a78bfa",
  },
  bab: {
    color: "#cbd5f5",
  },
  subbab: {
    color: "#cbd5f5",
  },
  publishBadge: {
    background: "#10b981",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    color: "white",
    whiteSpace: "nowrap",
  },
  authorRow: {
    display: "flex",
    gap: "24px",
    fontSize: "0.85rem",
    color: "#94a3b8",
    marginBottom: "16px",
    borderBottom: "1px solid #334155",
    paddingBottom: "8px",
  },
  questionText: {
    fontSize: "1rem",
    marginBottom: "12px",
    lineHeight: "1.5",
  },
  optionsContainer: {
    marginBottom: "12px",
  },
  optionsList: {
    listStyle: "none",
    paddingLeft: 0,
    marginTop: "5px",
  },
  studentAnswerSection: {
    marginTop: "16px",
    padding: "12px",
    background: "rgba(0,0,0,0.3)",
    borderRadius: "8px",
  },
  studentPointsInfo: {
    marginBottom: "12px",
  },
  studentPointsBadge: {
    background: "#fbbf24",
    color: "#0f172a",
    padding: "4px 8px",
    borderRadius: "16px",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },
  label: {
    fontWeight: "bold",
    marginRight: "10px",
  },
  selectAnswer: {
    padding: "8px",
    borderRadius: "6px",
    border: "none",
    background: "#334155",
    color: "white",
    cursor: "pointer",
  },
  small: {
    marginLeft: "10px",
    fontSize: "0.8rem",
    color: "#a78bfa",
  },
  attemptResultBox: {
    marginTop: "8px",
  },
  correctResult: {
    background: "#10b98120",
    padding: "8px",
    borderRadius: "8px",
    textAlign: "center",
    color: "#10b981",
    fontWeight: "bold",
    marginBottom: "8px",
  },
  wrongResult: {
    background: "#ef444420",
    padding: "8px",
    borderRadius: "8px",
    textAlign: "center",
    color: "#ef4444",
    fontWeight: "bold",
    marginBottom: "8px",
  },
  correctAnswerDisplay: {
    background: "#3b82f620",
    padding: "8px",
    borderRadius: "8px",
    color: "#60a5fa",
    fontSize: "0.85rem",
    marginTop: "5px",
  },
  pointEarnedDisplay: {
    background: "#fbbf2420",
    padding: "8px",
    borderRadius: "8px",
    color: "#fbbf24",
    fontSize: "0.85rem",
    marginTop: "5px",
    textAlign: "center",
  },
};