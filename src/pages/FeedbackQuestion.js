import { useEffect, useState } from "react";
import { logActivity } from "../components/logActivity";
import { supabase } from "../supabaseClient";

export default function FeedbackQuestion() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [revisionNote, setRevisionNote] = useState({});
  const [uploading, setUploading] = useState({});
  const [revisionImage, setRevisionImage] = useState({});
  const [reviewersMap, setReviewersMap] = useState({}); // reviewer_id -> name

  useEffect(() => {
    document.title = "Feedback Question | Aplikasiku";
    fetchFeedbackQuestions();
  }, []);

  const fetchFeedbackQuestions = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("User not found");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "feedback")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      alert("Failed to load feedback questions.");
    } else {
      setQuestions(data || []);
      // Ambil nama reviewer (reviewer_id) dari setiap soal
      const reviewerIds = [...new Set(data.map(q => q.reviewer_id).filter(Boolean))];
      if (reviewerIds.length) {
        const { data: profiles, error: profError } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", reviewerIds);
        if (!profError && profiles) {
          const map = {};
          profiles.forEach(p => { map[p.id] = p.name; });
          setReviewersMap(map);
        }
      }
    }
    setLoading(false);
  };

  const uploadRevisionImage = async (questionId, file) => {
    if (!file) return null;
    const fileExt = file.name.split(".").pop();
    const fileName = `revision_${questionId}_${Date.now()}.${fileExt}`;
    const filePath = `revisions/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("feedback-images")
      .upload(filePath, file);
    if (uploadError) {
      console.error(uploadError);
      alert("Image upload failed: " + uploadError.message);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage
      .from("feedback-images")
      .getPublicUrl(filePath);
    return publicUrl;
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
    setRevisionNote((prev) => ({ ...prev, [q.id]: "" }));
    setRevisionImage((prev) => ({ ...prev, [q.id]: null }));
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

  const handleSendToReview = async (id) => {
    const note = revisionNote[id] || "";
    const file = revisionImage[id];
    if (!note && !file) {
      alert("Please provide a revision note or upload an image to explain your changes.");
      return;
    }
    const question = questions.find(q => q.id === id);
    const reviewerName = reviewersMap[question?.reviewer_id] || "reviewer";

    setProcessingId(id);
    let imageUrl = null;
    if (file) {
      setUploading((prev) => ({ ...prev, [id]: true }));
      imageUrl = await uploadRevisionImage(id, file);
      setUploading((prev) => ({ ...prev, [id]: false }));
      if (!imageUrl && file) {
        setProcessingId(null);
        return;
      }
    }

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
        status: "review",
        revision_note: note,
        revision_image_url: imageUrl,
        // reviewer_comment dan feedback_image_url tidak dihapus agar tetap tersimpan
      })
      .eq("id", id);
    if (error) {
      console.error(error);
      alert("Failed to send revised question to review.");
    } else {
      alert(`✅ Revisi terkirim ke reviewer: ${reviewerName}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    }
    setProcessingId(null);
    setEditingId(null);

    //log aktivitas
    await logActivity("question_revision", `Mengirim revisi soal ke reviewer: ${reviewerName}`, id);
  };

  if (loading) return <div style={styles.loading}>Loading feedback questions...</div>;
  if (questions.length === 0) return <div style={styles.empty}>No feedback from reviewers yet.</div>;

  return (
    <div>
      <h2>Feedback from Reviewers</h2>
      <p>Reviewers have provided feedback on your questions. Please revise and resubmit.</p>
      {questions.map((q) => {
        const reviewerName = reviewersMap[q.reviewer_id] || "Tidak diketahui";
        return (
          <div key={q.id} style={styles.card}>
            {editingId === q.id ? (
              // EDIT MODE
              <div>
                <h3>Edit Question</h3>
                <form onSubmit={(e) => { e.preventDefault(); handleSendToReview(q.id); }} style={styles.form}>
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
                  
                  <div style={styles.feedbackBox}>
                    <strong>Reviewer Feedback:</strong>
                    <p>{q.reviewer_comment || "No comment provided."}</p>
                    {q.feedback_image_url && (
                      <div>
                        <img src={q.feedback_image_url} alt="Reviewer feedback" style={{ maxWidth: "100%", maxHeight: "150px" }} />
                      </div>
                    )}
                  </div>

                  <label style={styles.label}>Revision Note (explain your changes)</label>
                  <textarea
                    rows="2"
                    value={revisionNote[q.id] || ""}
                    onChange={(e) => setRevisionNote((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    style={styles.textarea}
                    placeholder="Describe what changes you made based on reviewer feedback..."
                  />
                  <label style={styles.label}>Upload Revision Image (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setRevisionImage((prev) => ({ ...prev, [q.id]: e.target.files[0] }))}
                    style={styles.fileInput}
                  />
                  {revisionImage[q.id] && (
                    <div style={styles.imagePreview}>
                      <span>📷 {revisionImage[q.id].name}</span>
                      <button onClick={() => setRevisionImage((prev) => ({ ...prev, [q.id]: null }))} style={styles.removeBtn}>❌</button>
                    </div>
                  )}
                  <div style={styles.actionButtons}>
                    <button type="submit" style={styles.saveBtn} disabled={processingId === q.id || uploading[q.id]}>
                      {processingId === q.id ? "Sending..." : "📤 Send to Review"}
                    </button>
                    <button type="button" onClick={cancelEdit} style={styles.cancelBtn}>Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              // VIEW MODE dengan layout baru
              <div>
                {/* Baris 1: Mata Pelajaran, Bab, Sub-Bab di kiri, badge di kanan */}
                <div style={styles.headerRow}>
                  <div style={styles.metaGroup}>
                    <span style={styles.subject}>{q.subject || "Mata Pelajaran"}</span>
                    <span style={styles.bab}>Bab: {q.chapter || "-"}</span>
                    <span style={styles.subbab}>Sub Bab: {q.subchapter || "-"}</span>
                  </div>
                  <span style={styles.badgeFeedback}>Status: Feedback</span>
                </div>

                {/* Baris 2: Reviewer info */}
                <div style={styles.authorRow}>
                  <span>📢 Reviewer: {reviewerName}</span>
                </div>

                {/* Soal */}
                <div
                  style={styles.questionText}
                  dangerouslySetInnerHTML={{ __html: q.question_text || "" }}
                />

                {/* Opsi */}
                <div style={styles.options}>
                  <strong>Pilihan Jawaban:</strong>
                  <ul>
                    {Object.entries(q.options || {}).map(([key, val]) => (
                      <li key={key}>{key.toUpperCase()}: {val}</li>
                    ))}
                  </ul>
                </div>

                {/* Jawaban */}
                <div style={styles.answer}>
                  <strong>Kunci Jawaban:</strong> {q.answer}
                </div>

                {/* Feedback Reviewer */}
                <div style={styles.feedbackBox}>
                  <strong>📝 Feedback Reviewer:</strong>
                  <p>{q.reviewer_comment || "Tidak ada komentar."}</p>
                  {q.feedback_image_url && (
                    <div>
                      <a href={q.feedback_image_url} target="_blank" rel="noopener noreferrer">Lihat gambar feedback</a>
                    </div>
                  )}
                </div>

                {/* Tombol aksi */}
                <div style={styles.actions}>
                  <button onClick={() => startEdit(q)} style={styles.editBtn}>✏️ Revise Question</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  empty: { textAlign: "center", padding: "50px", color: "#cbd5f5" },
  card: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    backdropFilter: "blur(4px)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "12px",
  },
  metaGroup: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",
    fontSize: "0.9rem",
  },
  subject: { fontWeight: "bold", color: "#a78bfa" },
  bab: { color: "#cbd5f5" },
  subbab: { color: "#cbd5f5" },
  badgeFeedback: {
    background: "#f59e0b",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    color: "white",
  },
  authorRow: {
    display: "flex",
    fontSize: "0.85rem",
    color: "#94a3b8",
    marginBottom: "16px",
    borderBottom: "1px solid #334155",
    paddingBottom: "8px",
  },
  questionText: { fontSize: "1rem", marginBottom: "12px", lineHeight: "1.5" },
  options: { marginBottom: "12px", fontSize: "0.9rem" },
  answer: { marginBottom: "16px", fontSize: "0.9rem", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px" },
  feedbackBox: {
    margin: "12px 0",
    padding: "12px",
    background: "rgba(245,158,11,0.1)",
    borderLeft: "3px solid #f59e0b",
    borderRadius: "4px",
  },
  actions: { display: "flex", gap: "12px", marginTop: "8px" },
  editBtn: { background: "#3b82f6", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white" },
  // Form edit styles
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  row: { display: "flex", gap: "20px", flexWrap: "wrap" },
  col: { flex: 1, minWidth: "200px" },
  label: { fontWeight: "bold", marginBottom: "5px", display: "block" },
  input: { padding: "8px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "8px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", fontFamily: "inherit", boxSizing: "border-box" },
  select: { padding: "8px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", cursor: "pointer" },
  fileInput: { marginBottom: "8px", color: "white" },
  imagePreview: { display: "flex", alignItems: "center", gap: "8px", marginTop: "5px", background: "#1e293b", padding: "4px 8px", borderRadius: "8px" },
  removeBtn: { background: "#ef4444", border: "none", borderRadius: "4px", cursor: "pointer", padding: "2px 6px", fontSize: "12px" },
  actionButtons: { display: "flex", gap: "10px", marginTop: "10px" },
  saveBtn: { background: "#10b981", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white" },
  cancelBtn: { background: "#6b7280", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white" },
};