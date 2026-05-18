import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

export default function ReviewQuestionStudent() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [activeComment, setActiveComment] = useState({});
  const [activeImage, setActiveImage] = useState({});
  const [uploading, setUploading] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [usersMap, setUsersMap] = useState({});

  // Filter state
  const [typeFilter, setTypeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [tempTypeFilter, setTempTypeFilter] = useState("all");
  const [tempSubjectFilter, setTempSubjectFilter] = useState("");
  const [tempChapterFilter, setTempChapterFilter] = useState("");

  // Ambil daftar guru
  useEffect(() => {
    document.title = "Review Questions | Aplikasiku";
    const fetchTeachers = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "guru");
      if (error) {
        console.error("Error fetching teachers:", error);
      } else {
        setTeachers(data || []);
      }
    };
    fetchTeachers();
  }, []);

  // Ambil nama dari profiles untuk penyusun soal
  const fetchUserNames = useCallback(async (userIds) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", uniqueIds);
    if (error) return;
    const map = {};
    data.forEach(prof => { map[prof.id] = prof.name || prof.id; });
    setUsersMap(prev => ({ ...prev, ...map }));
  }, []);

  const fetchReviewQuestions = useCallback(async () => {
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
      .eq("status", "review")
      .eq("reviewer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      alert("Failed to load review questions.");
    } else {
      setQuestions(data || []);
      const userIds = (data || []).map(q => q.user_id).filter(Boolean);
      if (userIds.length) await fetchUserNames(userIds);
    }
    setLoading(false);
  }, [fetchUserNames]);

  useEffect(() => {
    fetchReviewQuestions();
  }, [fetchReviewQuestions]);

  const uploadImage = useCallback(async (questionId, file) => {
    if (!file) return null;
    const fileExt = file.name.split(".").pop();
    const fileName = `${questionId}_${Date.now()}.${fileExt}`;
    const filePath = `feedback/${fileName}`;
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
  }, []);

  const handleSendFeedback = useCallback(async (id) => {
    const comment = activeComment[id] || "";
    const file = activeImage[id];
    if (!comment && !file) {
      alert("Please provide feedback comment or image.");
      return;
    }
    const question = questions.find(q => q.id === id);
    const creatorName = usersMap[question?.user_id] || "penyusun";

    setProcessingId(id);
    let imageUrl = null;
    if (file) {
      setUploading(prev => ({ ...prev, [id]: true }));
      imageUrl = await uploadImage(id, file);
      setUploading(prev => ({ ...prev, [id]: false }));
      if (!imageUrl && file) {
        setProcessingId(null);
        return;
      }
    }

    const { error } = await supabase
      .from("questions")
      .update({
        status: "feedback",
        reviewer_comment: comment,
        feedback_image_url: imageUrl,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to send feedback: " + error.message);
    } else {
      alert(`📨 Feedback terkirim ke ${creatorName}.`);
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
    setProcessingId(null);
    setActiveComment(prev => ({ ...prev, [id]: "" }));
    setActiveImage(prev => ({ ...prev, [id]: null }));
  }, [activeComment, activeImage, uploadImage, questions, usersMap]);

  const openTeacherModal = (id) => {
    setCurrentQuestionId(id);
    setSelectedTeacherId("");
    setShowTeacherModal(true);
  };

  const handleRequestTeacherReview = useCallback(async () => {
    if (!selectedTeacherId) {
      alert("Please select a teacher.");
      return;
    }
    const question = questions.find(q => q.id === currentQuestionId);
    const { data: { user } } = await supabase.auth.getUser();
    if (question?.reviewer_id !== user?.id) {
      alert("You are not the assigned reviewer for this question.");
      setShowTeacherModal(false);
      return;
    }
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    const teacherName = teacher ? teacher.name : "guru terpilih";

    setProcessingId(currentQuestionId);
    const { error } = await supabase
      .from("questions")
      .update({ reviewer_id: selectedTeacherId })
      .eq("id", currentQuestionId);
    if (error) {
      console.error(error);
      alert("Failed to transfer review to teacher: " + error.message);
    } else {
      alert(`📢 Permintaan review diteruskan ke ${teacherName}.`);
      setQuestions(prev => prev.filter(q => q.id !== currentQuestionId));
    }
    setProcessingId(null);
    setShowTeacherModal(false);
    setCurrentQuestionId(null);
  }, [selectedTeacherId, currentQuestionId, questions, teachers]);

  // Filtering logic
  const filterBySubjectChapter = (list) => {
    return list.filter(q => {
      let match = true;
      if (subjectFilter.trim() !== "") {
        if (!(q.subject || "").toLowerCase().includes(subjectFilter.toLowerCase())) match = false;
      }
      if (chapterFilter.trim() !== "") {
        if (!(q.chapter || "").toLowerCase().includes(chapterFilter.toLowerCase())) match = false;
      }
      return match;
    });
  };

  const allNew = questions.filter(q => !(q.revision_note || q.revision_image_url));
  const allRevision = questions.filter(q => q.revision_note || q.revision_image_url);

  let filteredNew = filterBySubjectChapter(allNew);
  let filteredRevision = filterBySubjectChapter(allRevision);

  let finalQuestions = [];
  if (typeFilter === "all") {
    finalQuestions = [...filteredNew, ...filteredRevision];
  } else if (typeFilter === "new") {
    finalQuestions = filteredNew;
  } else if (typeFilter === "revision") {
    finalQuestions = filteredRevision;
  }

  const applyFilters = () => {
    setTypeFilter(tempTypeFilter);
    setSubjectFilter(tempSubjectFilter);
    setChapterFilter(tempChapterFilter);
  };
  const resetFilters = () => {
    setTempTypeFilter("all");
    setTempSubjectFilter("");
    setTempChapterFilter("");
    setTypeFilter("all");
    setSubjectFilter("");
    setChapterFilter("");
  };

  if (loading) return <div style={styles.loading}>Loading review requests...</div>;
  if (questions.length === 0) return <div style={styles.empty}>No questions assigned to you for review.</div>;

  return (
    <div>
      <h2>Review Questions (Student)</h2>
      <p>Review the questions and provide feedback. You can also request teacher's final review.</p>

      {/* Filter Panel */}
      <div style={styles.filterPanel}>
        <div style={styles.filterControls}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Tipe:</label>
            <select value={tempTypeFilter} onChange={(e) => setTempTypeFilter(e.target.value)} style={styles.filterSelect}>
              <option value="all">Semua</option>
              <option value="new">Baru (belum pernah direvisi)</option>
              <option value="revision">Revisi (sudah direvisi)</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Mata Pelajaran:</label>
            <input
              type="text"
              placeholder="Cari mata pelajaran..."
              value={tempSubjectFilter}
              onChange={(e) => setTempSubjectFilter(e.target.value)}
              style={styles.filterInput}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Bab:</label>
            <input
              type="text"
              placeholder="Cari bab..."
              value={tempChapterFilter}
              onChange={(e) => setTempChapterFilter(e.target.value)}
              style={styles.filterInput}
            />
          </div>
        </div>
        <div style={styles.filterActions}>
          <button onClick={applyFilters} style={styles.applyFilterBtn}>🔍 Filter</button>
          <button onClick={resetFilters} style={styles.resetFilterBtn} title="Reset semua filter">🔄</button>
        </div>
      </div>

      {/* Daftar Soal */}
      {finalQuestions.length === 0 ? (
        <div style={styles.empty}>Tidak ada soal yang sesuai dengan filter.</div>
      ) : (
        finalQuestions.map((q) => {
          const creatorName = usersMap[q.user_id] || "Tidak diketahui";
          const isRevision = !!(q.revision_note || q.revision_image_url);
          return (
            <div key={q.id} style={styles.card}>
              {/* Baris 1: Mata Pelajaran, Bab, Sub-Bab, Status di pojok kanan */}
              <div style={styles.headerRow}>
                <div style={styles.metaGroup}>
                  <span style={styles.subject}>{q.subject || "Mata Pelajaran"}</span>
                  <span style={styles.bab}>Bab: {q.chapter || "-"}</span>
                  <span style={styles.subbab}>Sub Bab: {q.subchapter || "-"}</span>
                </div>
                <span style={isRevision ? styles.revisionBadge : styles.badge}>
                  {isRevision ? "🔄 Resubmitted" : "🆕 New"}
                </span>
              </div>
              {/* Baris 2: Penyusun (opsional) */}
              <div style={styles.authorRow}>
                <span>✍️ Penyusun: {creatorName}</span>
              </div>
              {/* Soal */}
              <div style={styles.questionText}>{q.question_text}</div>
              <div style={styles.options}>
                <strong>Options:</strong>
                <ul>
                  {Object.entries(q.options || {}).map(([key, val]) => (
                    <li key={key}>{key.toUpperCase()}: {val}</li>
                  ))}
                </ul>
              </div>
              <div style={styles.answer}>
                <strong>Correct Answer:</strong> {q.answer}
              </div>
              {/* Tampilkan revisi terakhir jika revisi */}
              {isRevision && (q.revision_note || q.revision_image_url) && (
                <div style={styles.revisionBox}>
                  <strong>📝 Revisi terakhir dari penyusun:</strong>
                  {q.revision_note && <div style={{ marginTop: "5px" }}>✏️ {q.revision_note}</div>}
                  {q.revision_image_url && (
                    <div style={{ marginTop: "5px" }}>
                      🖼️ <a href={q.revision_image_url} target="_blank" rel="noopener noreferrer">Lihat gambar revisi</a>
                    </div>
                  )}
                </div>
              )}
              {/* Feedback sebelumnya */}
              {(q.reviewer_comment || q.feedback_image_url) && (
                <div style={styles.previousFeedback}>
                  <strong>📋 Feedback Anda sebelumnya:</strong>
                  {q.reviewer_comment && <div style={{ marginTop: "5px" }}>💬 {q.reviewer_comment}</div>}
                  {q.feedback_image_url && (
                    <div style={{ marginTop: "5px" }}>
                      🖼️ <a href={q.feedback_image_url} target="_blank" rel="noopener noreferrer">Lihat lampiran sebelumnya</a>
                    </div>
                  )}
                </div>
              )}
              {/* Form feedback baru */}
              <div style={styles.feedbackSection}>
                <label style={styles.label}>Feedback Comment</label>
                <textarea
                  rows="3"
                  value={activeComment[q.id] || ""}
                  onChange={(e) => setActiveComment(prev => ({ ...prev, [q.id]: e.target.value }))}
                  style={styles.textarea}
                  placeholder="Provide feedback for the teacher..."
                />
                <label style={styles.label}>Upload Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setActiveImage(prev => ({ ...prev, [q.id]: e.target.files[0] }))}
                  style={styles.fileInput}
                />
                {activeImage[q.id] && (
                  <div style={styles.imagePreview}>
                    <span>📷 {activeImage[q.id].name}</span>
                    <button onClick={() => setActiveImage(prev => ({ ...prev, [q.id]: null }))} style={styles.removeBtn}>❌</button>
                  </div>
                )}
              </div>
              <div style={styles.actions}>
                <button
                  onClick={() => handleSendFeedback(q.id)}
                  disabled={processingId === q.id || uploading[q.id]}
                  style={styles.feedbackBtn}
                >
                  {uploading[q.id] ? "Uploading..." : "📨 Send Feedback"}
                </button>
                <button
                  onClick={() => openTeacherModal(q.id)}
                  disabled={processingId === q.id || uploading[q.id]}
                  style={styles.requestBtn}
                >
                  {processingId === q.id ? "Processing..." : "📢 Request Teacher Review"}
                </button>
              </div>
            </div>
          );
        })
      )}
      {showTeacherModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Select Teacher to Review</h3>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              style={styles.select}
            >
              <option value="">-- Choose a teacher --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {teachers.length === 0 && (
              <p style={{ color: "#f87171" }}>No teachers available. Please contact admin.</p>
            )}
            <div style={styles.modalActions}>
              <button onClick={handleRequestTeacherReview} style={styles.confirmBtn}>Send Request</button>
              <button onClick={() => setShowTeacherModal(false)} style={styles.cancelBtn}>Cancel</button>
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
    marginBottom: "8px",
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
  badge: { background: "#f59e0b", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold", color: "#1e293b" },
  revisionBadge: { background: "#f97316", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold", color: "white" },
  authorRow: {
    fontSize: "0.85rem",
    color: "#94a3b8",
    marginBottom: "16px",
    borderBottom: "1px solid #334155",
    paddingBottom: "8px",
  },
  questionText: { fontSize: "1rem", marginBottom: "12px", lineHeight: "1.5" },
  options: { marginBottom: "12px", fontSize: "0.9rem" },
  answer: { marginBottom: "16px", fontSize: "0.9rem", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px" },
  revisionBox: {
    background: "rgba(34,197,94,0.1)",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px",
    borderLeft: "4px solid #22c55e",
  },
  previousFeedback: {
    background: "rgba(249,115,22,0.15)",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px",
    borderLeft: "4px solid #f97316",
  },
  feedbackSection: {
    background: "rgba(255,255,255,0.03)",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px",
  },
  label: { fontWeight: "bold", display: "block", marginBottom: "5px" },
  textarea: { width: "100%", padding: "8px", borderRadius: "8px", border: "none", background: "#334155", color: "white", fontFamily: "inherit" },
  fileInput: { marginBottom: "8px", color: "white" },
  imagePreview: { display: "flex", alignItems: "center", gap: "8px", background: "#1e293b", padding: "4px 8px", borderRadius: "8px" },
  removeBtn: { background: "#ef4444", border: "none", borderRadius: "4px", cursor: "pointer", padding: "2px 6px", fontSize: "12px", color: "white" },
  actions: { display: "flex", gap: "12px", flexWrap: "wrap" },
  feedbackBtn: { background: "#3b82f6", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: "bold" },
  requestBtn: { background: "#8b5cf6", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: "bold" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#1e293b", padding: "24px", borderRadius: "16px", width: "320px", textAlign: "center" },
  modalActions: { display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px" },
  confirmBtn: { background: "#8b5cf6", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", color: "white" },
  cancelBtn: { background: "#6b7280", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", color: "white" },
  select: { padding: "8px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", cursor: "pointer", marginTop: "10px" },
  // Filter styles
  filterPanel: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "15px",
    marginBottom: "25px",
    padding: "15px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "12px",
  },
  filterControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "15px",
    flex: 1,
  },
  filterActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  filterLabel: {
    fontSize: "0.8rem",
    fontWeight: "bold",
    color: "#cbd5f5",
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#1e293b",
    color: "white",
    cursor: "pointer",
  },
  filterInput: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#1e293b",
    color: "white",
    minWidth: "180px",
  },
  applyFilterBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "8px",
    padding: "8px 20px",
    cursor: "pointer",
    color: "white",
    fontWeight: "bold",
  },
  resetFilterBtn: {
    background: "#475569",
    border: "none",
    borderRadius: "8px",
    padding: "8px 16px",
    cursor: "pointer",
    color: "white",
    fontWeight: "bold",
    fontSize: "1rem",
  },
};