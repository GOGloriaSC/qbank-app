import { useEffect, useState } from "react";
import { logActivity } from "../components/logActivity";
import { supabase } from "../supabaseClient";

export default function DraftQuestion() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [reviewers, setReviewers] = useState([]);
  const [showReviewerModal, setShowReviewerModal] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [currentQuestionId, setCurrentQuestionId] = useState(null);

  // Ambil daftar reviewer (user lain)
  useEffect(() => {
    document.title = "Draft Question | Aplikasiku";
    const fetchReviewers = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, role")
        .neq("id", user.id);
      if (!error) setReviewers(data || []);
    };
    fetchReviewers();
  }, []);

  useEffect(() => {
    fetchDraftQuestions();
  }, []);

  const fetchDraftQuestions = async () => {
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
      .eq("status", "draft")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Failed to load draft questions.");
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    setProcessingId(id);
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Failed to delete question.");
    } else {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      alert("Question deleted.");
    }
    setProcessingId(null);
  };

  const openReviewerModal = (id) => {
    setCurrentQuestionId(id);
    setSelectedReviewerId("");
    setShowReviewerModal(true);
  };

  const handleSendToReview = async () => {
    if (!selectedReviewerId) {
      alert("Please select a reviewer.");
      return;
    }
    // Ambil nama reviewer untuk notifikasi
    const reviewer = reviewers.find(r => r.id === selectedReviewerId);
    const reviewerName = reviewer ? reviewer.name : "reviewer terpilih";

    setProcessingId(currentQuestionId);
    const { error } = await supabase
      .from("questions")
      .update({ status: "review", reviewer_id: selectedReviewerId })
      .eq("id", currentQuestionId);
    if (error) {
      console.error(error);
      alert("Failed to send to review.");
    } else {
      setQuestions((prev) => prev.filter((q) => q.id !== currentQuestionId));
      alert(`Soal dikirim ke reviewer: ${reviewerName}`); // ✅ Gunakan reviewerName
    }
    setProcessingId(null);
    setShowReviewerModal(false);
    setCurrentQuestionId(null);

    // Log aktivitas
    await logActivity("question_review", `Mengirim soal ke reviewer: ${reviewerName}`, currentQuestionId);
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setEditForm({
      subject: q.subject || "",
      chapter: q.chapter || "",
      subchapter: q.subchapter || "",
      learning_objective: q.learning_objective || "",
      indicator: q.indicator || "",
      question_type: q.question_type || "PG",
      question_text: q.question_text || "",
      options: q.options || { a: "", b: "", c: "", d: "", e: "" },
      answer: q.answer || "",
      source: q.source || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOptionChange = (key, value) => {
    setEditForm((prev) => ({
      ...prev,
      options: { ...prev.options, [key]: value },
    }));
  };

  const handleUpdate = async (id) => {
    setProcessingId(id);
    const { error } = await supabase
      .from("questions")
      .update({
        subject: editForm.subject,
        chapter: editForm.chapter,
        subchapter: editForm.subchapter,
        learning_objective: editForm.learning_objective,
        indicator: editForm.indicator,
        question_type: editForm.question_type,
        question_text: editForm.question_text,
        options: editForm.options,
        answer: editForm.answer,
        source: editForm.source,
      })
      .eq("id", id);
    if (error) {
      console.error(error);
      alert("Failed to update question.");
    } else {
      alert("Question updated.");
      setEditingId(null);
      fetchDraftQuestions();
    }
    setProcessingId(null);
  };

  if (loading) return <div style={styles.loading}>Loading draft questions...</div>;
  if (questions.length === 0) return <div style={styles.empty}>No draft questions found.</div>;

  return (
    <div>
      <h2>Draft Questions</h2>
      <p>Your questions that are still in draft. You can edit, delete, or send to review.</p>
      {questions.map((q) => (
        <div key={q.id} style={styles.card}>
          {editingId === q.id ? (
            // EDIT MODE
            <div>
              <h3>Edit Question</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleUpdate(q.id); }} style={styles.form}>
                <div style={styles.row}>
                  <div style={styles.col}>
                    <label style={styles.label}>Subject</label>
                    <input name="subject" value={editForm.subject} onChange={handleEditChange} style={styles.input} required />
                  </div>
                  <div style={styles.col}>
                    <label style={styles.label}>Chapter</label>
                    <input name="chapter" value={editForm.chapter} onChange={handleEditChange} style={styles.input} required />
                  </div>
                </div>
                <div style={styles.row}>
                  <div style={styles.col}>
                    <label style={styles.label}>Learning Objective</label>
                    <input name="learning_objective" value={editForm.learning_objective} onChange={handleEditChange} style={styles.input} />
                  </div>
                  <div style={styles.col}>
                    <label style={styles.label}>Source</label>
                    <input name="source" value={editForm.source} onChange={handleEditChange} style={styles.input} />
                  </div>
                </div>
                <div style={styles.row}>
                  <div style={styles.col}>
                    <label style={styles.label}>Subchapter</label>
                    <input name="subchapter" value={editForm.subchapter} onChange={handleEditChange} style={styles.input} />
                  </div>
                  <div style={styles.col}>
                    <label style={styles.label}>Indicator</label>
                    <input name="indicator" value={editForm.indicator} onChange={handleEditChange} style={styles.input} />
                  </div>
                </div>
                <label style={styles.label}>Question Text</label>
                <textarea name="question_text" rows="3" value={editForm.question_text} onChange={handleEditChange} style={styles.textarea} required />
                <label style={styles.label}>Options (A-E)</label>
                {["a", "b", "c", "d", "e"].map((opt) => (
                  <div key={opt} style={{ marginBottom: "8px" }}>
                    <span style={{ display: "inline-block", width: "30px" }}>{opt.toUpperCase()}</span>
                    <input
                      type="text"
                      value={editForm.options[opt] || ""}
                      onChange={(e) => handleOptionChange(opt, e.target.value)}
                      style={{ ...styles.input, width: "calc(100% - 40px)" }}
                    />
                  </div>
                ))}
                <label style={styles.label}>Question Type</label>
                <select name="question_type" value={editForm.question_type} onChange={handleEditChange} style={styles.select}>
                  <option value="PG">PG</option>
                  <option value="PGK">PGK</option>
                </select>
                <label style={styles.label}>Answer</label>
                <input name="answer" value={editForm.answer} onChange={handleEditChange} style={styles.input} required />
                <div style={styles.actionButtons}>
                  <button type="submit" style={styles.saveBtn} disabled={processingId === q.id}>
                    {processingId === q.id ? "Saving..." : "Save"}
                  </button>
                  <button type="button" onClick={cancelEdit} style={styles.cancelBtn}>Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            // VIEW MODE - Layout baru: Baris 1 di header dengan meta dan badge
            <div>
              {/* Baris 1: Mata Pelajaran, Bab, Sub-Bab di kiri, Status Draft di kanan */}
              <div style={styles.header}>
                <div style={styles.metaRow}>
                  <span style={styles.subject}>{q.subject || "Mata Pelajaran"}</span>
                  <span style={styles.bab}>Bab: {q.chapter || "-"}</span>
                  <span style={styles.subbab}>Sub Bab: {q.subchapter || "-"}</span>
                </div>
                <span style={styles.badgeDraft}>Status: Draft</span>
              </div>

              {/* Baris 2: Soal */}
              <div
                style={styles.questionText}
                dangerouslySetInnerHTML={{ __html: q.question_text || "" }}
              />

              {/* Opsi Jawaban */}
              <div style={styles.options}>
                <strong>Pilihan Jawaban:</strong>
                <ul>
                  {Object.entries(q.options || {}).map(([key, val]) => (
                    <li key={key}>{key.toUpperCase()}: {val}</li>
                  ))}
                </ul>
              </div>

              {/* Kunci Jawaban */}
              <div style={styles.answer}>
                <strong>Kunci Jawaban:</strong> {q.answer?.toUpperCase()}
              </div>

              {/* Tombol Aksi */}
              <div style={styles.actions}>
                <button onClick={() => startEdit(q)} style={styles.editBtn} disabled={processingId === q.id}>✏️ Edit</button>
                <button onClick={() => openReviewerModal(q.id)} style={styles.reviewBtn} disabled={processingId === q.id}>
                  {processingId === q.id ? "Processing..." : "📤 Minta Review"}
                </button>
                <button onClick={() => handleDelete(q.id)} style={styles.deleteBtn} disabled={processingId === q.id}>🗑️ Hapus</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Modal Pilih Reviewer */}
      {showReviewerModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Pilih Reviewer</h3>
            <select
              value={selectedReviewerId}
              onChange={(e) => setSelectedReviewerId(e.target.value)}
              style={styles.select}
            >
              <option value="">-- Pilih reviewer --</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.role})</option>
              ))}
            </select>
            {reviewers.length === 0 && (
              <p style={{ color: "#f87171" }}>Tidak ada user lain yang tersedia sebagai reviewer.</p>
            )}
            <div style={styles.modalActions}>
              <button onClick={handleSendToReview} style={styles.saveBtn}>Kirim</button>
              <button onClick={() => setShowReviewerModal(false)} style={styles.cancelBtn}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  empty: { textAlign: "center", padding: "50px", color: "#cbd5f5" },
  card: {
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    backdropFilter: "blur(4px)",
  },
  header: {
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
  badgeDraft: {
    background: "#6b7280",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    color: "white",
  },
  questionText: { fontSize: "1rem", marginBottom: "12px", lineHeight: "1.5" },
  options: { marginBottom: "12px", fontSize: "0.9rem" },
  answer: { marginBottom: "16px", fontSize: "0.9rem", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px" },
  actions: { display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "8px" },
  editBtn: { background: "#3b82f6", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", color: "white" },
  reviewBtn: { background: "#f59e0b", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", color: "white" },
  deleteBtn: { background: "#ef4444", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", color: "white" },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  row: { display: "flex", gap: "20px", flexWrap: "wrap" },
  col: { flex: 1, minWidth: "200px" },
  label: { fontWeight: "bold", marginBottom: "5px", display: "block" },
  input: { padding: "8px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "8px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", fontFamily: "inherit", boxSizing: "border-box" },
  select: { padding: "8px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", cursor: "pointer" },
  actionButtons: { display: "flex", gap: "10px", marginTop: "10px" },
  saveBtn: { background: "#10b981", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white" },
  cancelBtn: { background: "#6b7280", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white" },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#1e293b",
    padding: "24px",
    borderRadius: "16px",
    width: "320px",
    textAlign: "center",
  },
  modalActions: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    marginTop: "20px",
  },
};