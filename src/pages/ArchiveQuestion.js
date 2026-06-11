import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

export default function ArchiveQuestion() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState({});
  const [processing, setProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [usersMap, setUsersMap] = useState({});

  // Ambil nama pengguna untuk daftar user_id dan reviewer_id yang ada di questions
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

  // Ambil soal-soal yang berstatus archive dan diarsipkan oleh user yang sedang login
  const fetchArchivedQuestions = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("User not found. Please login again.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "archive")
      .eq("archived_by", user.id)   // ✅ filter berdasarkan yang mengarsipkan
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      alert("Failed to load archived questions.");
    } else {
      setQuestions(data || []);
      const userIds = [];
      (data || []).forEach(q => {
        if (q.user_id) userIds.push(q.user_id);
        if (q.reviewer_id) userIds.push(q.reviewer_id);
      });
      if (userIds.length) await fetchUserNames(userIds);
    }
    setLoading(false);
  }, [fetchUserNames]);

  // Set document title
  useEffect(() => {
    document.title = "Archive Question | Aplikasiku";
    fetchArchivedQuestions();
  }, [fetchArchivedQuestions]);

  const handleSelectAll = (e) => {
    const checked = e.target.checked;
    const newSelected = {};
    questions.forEach(q => { newSelected[q.id] = checked; });
    setSelectedIds(newSelected);
  };

  const handleSelectOne = (id, checked) => {
    setSelectedIds(prev => ({ ...prev, [id]: checked }));
  };

  const restoreSelected = async () => {
    const idsToRestore = Object.keys(selectedIds).filter(id => selectedIds[id]);
    if (idsToRestore.length === 0) {
      alert("Select at least one question to restore.");
      return;
    }
    if (!window.confirm(`Restore ${idsToRestore.length} question(s)? They will be copied to published questions. The archive copies will remain.`)) return;
    setProcessing(true);
    const questionsToRestore = questions.filter(q => idsToRestore.includes(q.id));
    const newQuestions = questionsToRestore.map(q => ({
      subject: q.subject,
      chapter: q.chapter,
      subchapter: q.subchapter,
      learning_objective: q.learning_objective,
      indicator: q.indicator,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options,
      answer: q.answer,
      source: q.source,
      points: q.points || 0,
      status: "publish",
      user_id: q.user_id,
      reviewer_id: q.reviewer_id,           // ✅ Publisher tetap
      created_at: new Date().toISOString(),
      reviewer_comment: null,
      feedback_image_url: null,
      revision_note: null,
      revision_image_url: null,
    }));
    const { error } = await supabase.from("questions").insert(newQuestions);
    if (error) {
      console.error(error);
      alert("Failed to restore questions.");
    } else {
      alert(`${idsToRestore.length} question(s) restored successfully.`);
      setSelectedIds({});
    }
    setProcessing(false);
  };

  const restoreSingle = async (id) => {
    if (!window.confirm("Restore this question? It will be copied to published questions. The archive copy will remain.")) return;
    setProcessing(true);
    const q = questions.find(q => q.id === id);
    if (!q) {
      alert("Question not found.");
      setProcessing(false);
      return;
    }
    const newQuestion = {
      subject: q.subject,
      chapter: q.chapter,
      subchapter: q.subchapter,
      learning_objective: q.learning_objective,
      indicator: q.indicator,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options,
      answer: q.answer,
      source: q.source,
      points: q.points || 0,
      status: "publish",
      user_id: q.user_id,
      reviewer_id: q.reviewer_id,           // ✅ Publisher tetap
      created_at: new Date().toISOString(),
      reviewer_comment: null,
      feedback_image_url: null,
      revision_note: null,
      revision_image_url: null,
    };
    const { error } = await supabase.from("questions").insert([newQuestion]);
    if (error) {
      console.error(error);
      alert("Failed to restore question.");
    } else {
      alert("Question restored successfully.");
    }
    setProcessing(false);
  };

  const handleDeletePermanent = async (id) => {
    if (!window.confirm("Hapus soal ini secara permanen? Tindakan ini tidak dapat dibatalkan.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Gagal menghapus soal.");
    } else {
      alert("Soal berhasil dihapus permanen.");
      setQuestions(prev => prev.filter(q => q.id !== id));
      setSelectedIds(prev => {
        const newSelected = { ...prev };
        delete newSelected[id];
        return newSelected;
      });
    }
    setDeletingId(null);
  };

  const escapeHtml = (text) => {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const exportToWord = () => {
    const idsToExport = Object.keys(selectedIds).filter(id => selectedIds[id]);
    if (idsToExport.length === 0) {
      alert("Select at least one question to export.");
      return;
    }
    const selectedQuestions = questions.filter(q => idsToExport.includes(q.id));

    let html = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Kartu Soal - Bank Soal (Arsip)</title>
        <style>
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
        }
        .question-card {
            margin-bottom: 20px;
            page-break-after: always;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        td, th {
            border: 1px solid black;
            padding: 8px;
            vertical-align: top;
        }
        .label {
            font-weight: bold;
        }
        .options {
            margin: 0;
            padding-left: 20px;
        }
        .options li {
            margin: 4px 0;
        }
        </style>
    </head>
    <body>
    `;

    selectedQuestions.forEach((q, idx) => {
      const materi = [q.subject, q.chapter, q.subchapter].filter(Boolean).join(' - ') || '-';
      const options = q.options || {};
      const optionKeys = Object.keys(options).sort();
      const optionsHtml = optionKeys.length > 0
        ? `<ul class="options">${optionKeys.map(key => `<li><strong>${key.toUpperCase()}.</strong> ${escapeHtml(options[key])}</li>`).join('')}</ul>`
        : '';
      const rumusanSoal = `
        <strong>NO SOAL : ${idx + 1}</strong><br><br>
        ${escapeHtml(q.question_text)}<br><br>
        ${optionsHtml}<br>
        <strong>KUNCI JAWABAN : ${q.answer ? escapeHtml(q.answer.toUpperCase()) : '-'}</strong>
      `;

      html += `
      <div class="question-card">
      <table>
          <tr>
            <td class="label">TUJUAN PEMBELAJARAN</td>
            <td class="label">SUMBER</td>
          </tr>
          <tr>
            <td>${escapeHtml(q.learning_objective || '-')}</td>
            <td>${escapeHtml(q.source || '-')}</td>
          </tr>
          <tr>
            <td class="label">MATERI</td>
            <td class="label">RUMUSAN SOAL</td>
          </tr>
          <tr>
            <td>${escapeHtml(materi)}</td>
            <td rowspan="3">${rumusanSoal}</td>
          </tr>
          <tr>
            <td class="label">INDIKATOR SOAL</td>
          </tr>
          <tr>
            <td>${escapeHtml(q.indicator || '-')}</td>
          </tr>
        </table>
      </div>
      `;
    });

    html += `</body></html>`;

    const blob = new Blob([html], { type: "application/msword" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "kartu_soal_arsip.doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={styles.loading}>Loading archived questions...</div>;

  return (
    <div>
      <h2>📦 Arsip Soal</h2>
      <p>Berikut soal-soal yang telah diarsipkan. Anda dapat mengembalikan (copy) ke published, mengekspor, atau menghapus permanen.</p>
      {questions.length === 0 ? (
        <p>Belum ada soal yang diarsipkan.</p>
      ) : (
        <>
          <div style={styles.toolbar}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" onChange={handleSelectAll} checked={questions.length > 0 && Object.keys(selectedIds).length === questions.length} />
              Pilih Semua
            </label>
            <button onClick={restoreSelected} disabled={processing} style={styles.restoreBtn}>
              {processing ? "Memproses..." : "↩️ Restore Terpilih (Copy)"}
            </button>
            <button onClick={exportToWord} disabled={processing} style={styles.exportBtn}>📄 Export ke Word</button>
          </div>
          {questions.map((q) => {
            const options = q.options || {};
            const optionKeys = Object.keys(options).sort();
            const creatorName = usersMap[q.user_id] || q.user_id || "Tidak diketahui";
            const publisherName = usersMap[q.reviewer_id] || q.reviewer_id || "Tidak diketahui";

            return (
              <div key={q.id} style={styles.questionCard}>
                <div style={styles.cardHeaderWrapper}>
                  <div style={styles.metaRow}>
                    <span style={styles.subject}>{q.subject || "Mata Pelajaran"}</span>
                    <span style={styles.bab}>Bab: {q.chapter || "-"}</span>
                    <span style={styles.subbab}>Sub Bab: {q.subchapter || "-"}</span>
                  </div>
                  <div style={styles.rightGroup}>
                    <span style={styles.archiveBadge}>Status: Archive</span>
                    {q.points > 0 && (
                      <span style={styles.pointsBadge}>🏆 +{q.points} poin</span>
                    )}
                    <button onClick={() => restoreSingle(q.id)} disabled={processing} style={styles.restoreSingleBtn}>
                      ↪️ Restore
                    </button>
                    <button onClick={() => handleDeletePermanent(q.id)} disabled={deletingId === q.id} style={styles.deleteBtn}>
                      {deletingId === q.id ? "..." : "🗑️ Hapus"}
                    </button>
                  </div>
                </div>

                <div style={styles.authorRow}>
                  <span>✍️ Penyusun Soal: {creatorName}</span>
                  <span>📢 Publisher: {publisherName}</span>
                </div>

                <div
                  style={styles.questionText}
                  dangerouslySetInnerHTML={{ __html: q.question_text || "" }}
                />

                <div style={styles.optionsContainer}>
                  <strong>Pilihan Jawaban:</strong>
                  <ul style={styles.optionsList}>
                    {optionKeys.map((key) => (
                      <li key={key}><strong>{key.toUpperCase()}.</strong> {options[key]}</li>
                    ))}
                  </ul>
                </div>

                <div style={styles.answerBox}>
                  <strong>🔑 Kunci Jawaban:</strong> {q.answer?.toUpperCase() || "-"}
                </div>

                <div style={styles.checkboxFooter}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds[q.id] || false}
                      onChange={(e) => handleSelectOne(q.id, e.target.checked)}
                    />
                    Pilih untuk restore massal / export
                  </label>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    marginBottom: "20px",
    padding: "10px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "8px",
    flexWrap: "wrap",
  },
  restoreBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    cursor: "pointer",
    color: "white",
    fontWeight: "bold",
  },
  exportBtn: {
    background: "#10b981",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    cursor: "pointer",
    color: "white",
    fontWeight: "bold",
  },
  questionCard: {
    background: "rgba(255, 255, 255, 0.05)",
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
  archiveBadge: {
    background: "#6b7280",
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
  restoreSingleBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    padding: "4px 12px",
    cursor: "pointer",
    color: "white",
    fontSize: "0.8rem",
  },
  deleteBtn: {
    background: "#dc2626",
    border: "none",
    borderRadius: "6px",
    padding: "4px 12px",
    cursor: "pointer",
    color: "white",
    fontSize: "0.8rem",
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
  questionText: { fontSize: "1rem", marginBottom: "12px", lineHeight: "1.5" },
  optionsContainer: { marginBottom: "12px" },
  optionsList: { listStyle: "none", paddingLeft: 0, marginTop: "5px" },
  answerBox: {
    background: "#1e293b",
    padding: "8px 12px",
    borderRadius: "8px",
    marginTop: "12px",
    fontSize: "0.9rem",
    borderLeft: "3px solid #f59e0b",
  },
  checkboxFooter: {
    marginTop: "12px",
    paddingTop: "8px",
    borderTop: "1px solid #334155",
    textAlign: "right",
  },
};