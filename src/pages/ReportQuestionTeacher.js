import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

export default function ReportQuestionTeacher() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [subchapters, setSubchapters] = useState([]);
  const [publishers, setPublishers] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedSubchapter, setSelectedSubchapter] = useState("");
  const [selectedPublisher, setSelectedPublisher] = useState("");

  // Ambil semua data (soal, attempts, profiles)
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      // 1. Ambil semua soal publish
      const { data: questionsData, error: qErr } = await supabase
        .from("questions")
        .select("id, subject, chapter, subchapter, question_text, user_id")
        .eq("status", "publish")
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      if (!questionsData || questionsData.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      // 2. Ambil semua attempts untuk soal-soal ini
      const questionIds = questionsData.map(q => q.id);
      const { data: attempts, error: aErr } = await supabase
        .from("attempts")
        .select("question_id, user_id, is_correct")
        .in("question_id", questionIds);
      if (aErr) throw aErr;

      // Hitung per soal: set user yang pernah benar, dan map untuk tracking
      const correctUsersMap = new Map();   // Map<questionId, Set<userId>>
      const allAttemptedUsersMap = new Map(); // Map<questionId, Set<userId>>
      attempts?.forEach(att => {
        const qId = att.question_id;
        const userId = att.user_id;
        if (!allAttemptedUsersMap.has(qId)) allAttemptedUsersMap.set(qId, new Set());
        allAttemptedUsersMap.get(qId).add(userId);
        
        if (att.is_correct) {
          if (!correctUsersMap.has(qId)) correctUsersMap.set(qId, new Set());
          correctUsersMap.get(qId).add(userId);
        }
      });

      // 3. Ambil semua profiles dari user_id unik (publisher)
      const userIds = [...new Set(questionsData.map(q => q.user_id).filter(Boolean))];
      let profileMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);
        if (pErr) throw pErr;
        profiles?.forEach(p => profileMap.set(p.id, p.name || p.id.slice(0, 8)));
      }
      userIds.forEach(uid => {
        if (!profileMap.has(uid)) profileMap.set(uid, uid.slice(0, 8) + "...");
      });

      // Gabungkan data
      const combined = questionsData.map(q => {
        const totalAttempted = allAttemptedUsersMap.get(q.id)?.size || 0;
        const correctCount = correctUsersMap.get(q.id)?.size || 0;
        const wrongCount = totalAttempted - correctCount; // siswa yang pernah menjawab tapi tidak pernah benar
        return {
          ...q,
          correct_count: correctCount,
          wrong_count: wrongCount,
          publisher_name: profileMap.get(q.user_id) || q.user_id?.slice(0, 8) || "-"
        };
      });

      setQuestions(combined);

      // Ekstrak opsi filter unik
      const uniqueSubjects = [...new Set(combined.map(q => q.subject).filter(Boolean))];
      const uniqueChapters = [...new Set(combined.map(q => q.chapter).filter(Boolean))];
      const uniqueSubchapters = [...new Set(combined.map(q => q.subchapter).filter(Boolean))];
      const publisherMap = new Map();
      combined.forEach(q => {
        if (q.user_id && !publisherMap.has(q.user_id)) {
          publisherMap.set(q.user_id, { id: q.user_id, name: q.publisher_name });
        }
      });
      setSubjects(uniqueSubjects);
      setChapters(uniqueChapters);
      setSubchapters(uniqueSubchapters);
      setPublishers(Array.from(publisherMap.values()));

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Report | Aplikasiku";
    fetchAllData();
  }, [fetchAllData]);

  // Filter data berdasarkan pilihan
  const getFilteredQuestions = useCallback(() => {
    let filtered = questions;
    if (selectedSubject) filtered = filtered.filter(q => q.subject === selectedSubject);
    if (selectedChapter) filtered = filtered.filter(q => q.chapter === selectedChapter);
    if (selectedSubchapter) filtered = filtered.filter(q => q.subchapter === selectedSubchapter);
    if (selectedPublisher) filtered = filtered.filter(q => q.user_id === selectedPublisher);
    return filtered;
  }, [questions, selectedSubject, selectedChapter, selectedSubchapter, selectedPublisher]);

  const filteredQuestions = getFilteredQuestions();

  const resetFilters = () => {
    setSelectedSubject("");
    setSelectedChapter("");
    setSelectedSubchapter("");
    setSelectedPublisher("");
  };

  if (loading) return <div style={styles.loading}>Loading report...</div>;
  if (errorMsg) return <div style={styles.error}>Error: {errorMsg}</div>;

  return (
    <div>
      <h2>📊 Laporan Soal Publish</h2>
      <p>Statistik jawaban siswa per soal.</p>

      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label>Mata Pelajaran</label>
          <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={styles.select}>
            <option value="">Semua</option>
            {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label>Bab</label>
          <select value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} style={styles.select}>
            <option value="">Semua</option>
            {chapters.map(ch => <option key={ch} value={ch}>{ch}</option>)}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label>Sub Bab</label>
          <select value={selectedSubchapter} onChange={(e) => setSelectedSubchapter(e.target.value)} style={styles.select}>
            <option value="">Semua</option>
            {subchapters.map(sc => <option key={sc} value={sc}>{sc}</option>)}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label>Publisher (Guru)</label>
          <select value={selectedPublisher} onChange={(e) => setSelectedPublisher(e.target.value)} style={styles.select}>
            <option value="">Semua</option>
            {publishers.map(pub => <option key={pub.id} value={pub.id}>{pub.name}</option>)}
          </select>
        </div>
        <button onClick={resetFilters} style={styles.resetBtn}>Reset Filter</button>
      </div>

      {filteredQuestions.length === 0 ? (
        <p>Tidak ada data sesuai filter.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th>No</th>
              <th>Mata Pelajaran</th>
              <th>Bab</th>
              <th>Sub Bab</th>
              <th>Soal</th>
              <th>Publisher</th>
              <th>✅ Jawaban Benar</th>
              <th>❌ Jawaban Salah</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuestions.map((q, idx) => (
              <tr key={q.id}>
                <td>{idx + 1}</td>
                <td>{q.subject || "-"}</td>
                <td>{q.chapter || "-"}</td>
                <td>{q.subchapter || "-"}</td>
                <td style={styles.questionText}>{q.question_text}</td>
                <td>{q.publisher_name}</td>
                <td style={styles.correctCount}>{q.correct_count}</td>
                <td style={styles.wrongCount}>{q.wrong_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  error: { textAlign: "center", padding: "50px", color: "#ef4444" },
  filterContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
    alignItems: "flex-end",
    background: "rgba(255,255,255,0.03)",
    padding: "16px",
    borderRadius: "12px",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: "150px",
  },
  select: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#1e293b",
    color: "white",
    cursor: "pointer",
  },
  resetBtn: {
    padding: "8px 16px",
    background: "#475569",
    border: "none",
    borderRadius: "8px",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    alignSelf: "center",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "20px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "8px",
    overflow: "hidden",
  },
  questionText: { textAlign: "left" },
  correctCount: { textAlign: "center", fontWeight: "bold", color: "#10b981" },
  wrongCount: { textAlign: "center", fontWeight: "bold", color: "#ef4444" },
};

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
`;
document.head.appendChild(styleSheet);