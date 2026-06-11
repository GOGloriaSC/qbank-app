import { useEffect, useState, useCallback } from "react";
import { logActivity } from "../components/logActivity";
import { supabase } from "../supabaseClient";

export default function ReviewQuestionTeacher() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [activeComment, setActiveComment] = useState({});
  const [activeImage, setActiveImage] = useState({});
  const [uploading, setUploading] = useState({});
  const [usersMap, setUsersMap] = useState({});

  // Filter state
  const [typeFilter, setTypeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [tempTypeFilter, setTempTypeFilter] = useState("all");
  const [tempSubjectFilter, setTempSubjectFilter] = useState("");
  const [tempChapterFilter, setTempChapterFilter] = useState("");

  const [showPointsModal, setShowPointsModal] = useState(false);
  const [currentPublishId, setCurrentPublishId] = useState(null);
  const [pointsValue, setPointsValue] = useState(10);

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
    document.title = "Review Questions | Aplikasiku";
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
      alert("Upload failed: " + uploadError.message);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage
      .from("feedback-images")
      .getPublicUrl(filePath);
    return publicUrl;
  }, []);

  const handlePublishClick = (id) => {
    setCurrentPublishId(id);
    const q = questions.find(q => q.id === id);
    setPointsValue(q?.points ?? 10);
    setShowPointsModal(true);
  };

  const handlePublishWithPoints = useCallback(async () => {
    if (!currentPublishId) return;
    // Ambil data soal dan nama penyusun
    const question = questions.find(q => q.id === currentPublishId);
    const creatorName = question ? (usersMap[question.user_id] || "penyusun") : "penyusun";
    
    setProcessingId(currentPublishId);
    const { error } = await supabase
      .from("questions")
      .update({ status: "publish", points: pointsValue })
      .eq("id", currentPublishId);
    if (error) {
      console.error(error);
      alert("Failed to publish.");
    } else {
      alert(`✅ Soal berhasil dipublikasi dengan ${pointsValue} poin. (Soal milik ${creatorName})`);
      setQuestions(prev => prev.filter(q => q.id !== currentPublishId));
    }
    setProcessingId(null);
    setShowPointsModal(false);
    setCurrentPublishId(null);

    // Log aktivitas
    await logActivity("question_publish", `Mempublish soal dengan ${pointsValue} poin (milik ${creatorName})`, currentPublishId);

  }, [currentPublishId, pointsValue, questions, usersMap]);

  const handleSendFeedback = useCallback(async (id) => {
    const comment = activeComment[id] || "";
    const file = activeImage[id];
    if (!comment && !file) {
      alert("Please provide feedback comment or image.");
      return;
    }
    // Ambil data soal dan nama penyusun
    const question = questions.find(q => q.id === id);
    const creatorName = question ? (usersMap[question.user_id] || "penyusun") : "penyusun";
    
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
        revision_note: null,
        revision_image_url: null,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Failed to send feedback.");
    } else {
      alert(`📨 Feedback terkirim ke ${creatorName}.`);
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
    setProcessingId(null);
    setActiveComment(prev => ({ ...prev, [id]: "" }));
    setActiveImage(prev => ({ ...prev, [id]: null }));

    // Log aktivitas
    await logActivity("question_feedback", `Mengirim feedback ke ${creatorName}`, id);
  }, [activeComment, activeImage, uploadImage, questions, usersMap]);

  const handleArchive = useCallback(async (id) => {
    if (!window.confirm("Archive this question?")) return;
    setProcessingId(id);
    const { error } = await supabase
      .from("questions")
      .update({ status: "archive" })
      .eq("id", id);
    if (error) {
      console.error(error);
      alert("Archive failed.");
    } else {
      alert("Archived.");
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
    setProcessingId(null);

    // Log aktivitas
    await logActivity("question_archive", `Mengarsipkan soal`, id);
  }, []);

  // Filter functions
  const filterBySubjectChapter = useCallback((list) => {
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
  }, [subjectFilter, chapterFilter]);

  const allNew = questions.filter(q => !(q.revision_note || q.revision_image_url));
  const allRevision = questions.filter(q => q.revision_note || q.revision_image_url);

  let filteredNew = filterBySubjectChapter(allNew);
  let filteredRevision = filterBySubjectChapter(allRevision);

  let showNewSection = false, showRevisionSection = false;
  if (typeFilter === "all") {
    showNewSection = filteredNew.length > 0;
    showRevisionSection = filteredRevision.length > 0;
  } else if (typeFilter === "new") {
    showNewSection = filteredNew.length > 0;
  } else if (typeFilter === "revision") {
    showRevisionSection = filteredRevision.length > 0;
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

  const renderQuestionCard = (q, isRevision) => {
    const creatorName = usersMap[q.user_id] || "Tidak diketahui";
    const hasPreviousFeedback = (q.reviewer_comment && q.reviewer_comment.trim() !== "") || q.feedback_image_url;

    return (
      <div key={q.id} style={styles.card}>
        {/* Baris 1 */}
        <div style={styles.headerRow}>
          <div style={styles.metaGroup}>
            <span style={styles.subject}>{q.subject || "Mata Pelajaran"}</span>
            <span style={styles.bab}>Bab: {q.chapter || "-"}</span>
            <span style={styles.subbab}>Sub Bab: {q.subchapter || "-"}</span>
            <span style={styles.creator}>👤 {creatorName}</span>
          </div>
          <span style={isRevision ? styles.revisionBadge : styles.badge}>
            {isRevision ? "🔄 Resubmitted" : "🆕 Review"}
          </span>
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
        <div style={styles.answer}>
          <strong>Kunci Jawaban:</strong> {q.answer?.toUpperCase()}
        </div>

        {/* Revisi terakhir dari teacher */}
        {isRevision && (q.revision_note || q.revision_image_url) && (
          <div style={styles.revisionBox}>
            <div style={{ fontWeight: "bold", marginBottom: "8px" }}>📝 Revisi terakhir dari penyusun:</div>
            {q.revision_note && <div style={styles.revisionNote}>✏️ {q.revision_note}</div>}
            {q.revision_image_url && (
              <div style={styles.revisionImage}>
                🖼️ <a href={q.revision_image_url} target="_blank" rel="noopener noreferrer">Lihat gambar revisi</a>
              </div>
            )}
          </div>
        )}

        {/* Feedback sebelumnya dari reviewer */}
        {hasPreviousFeedback && (
          <div style={styles.previousFeedback}>
            <div style={{ fontWeight: "bold", marginBottom: "8px" }}>📋 Feedback Anda sebelumnya:</div>
            {q.reviewer_comment && <div style={styles.prevComment}>💬 {q.reviewer_comment}</div>}
            {q.feedback_image_url && (
              <div style={styles.prevImage}>
                🖼️ <a href={q.feedback_image_url} target="_blank" rel="noopener noreferrer">Lihat lampiran sebelumnya</a>
              </div>
            )}
          </div>
        )}

        {/* Form feedback baru */}
        <div style={styles.feedbackSection}>
          <label style={styles.label}>Feedback baru (jika masih perlu perbaikan)</label>
          <textarea
            rows="3"
            value={activeComment[q.id] || ""}
            onChange={(e) => setActiveComment(prev => ({ ...prev, [q.id]: e.target.value }))}
            style={styles.textarea}
            placeholder="Tulis feedback untuk perbaikan lebih lanjut..."
          />
          <label style={styles.label}>Upload gambar (opsional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setActiveImage(prev => ({ ...prev, [q.id]: e.target.files[0] }))}
            style={styles.fileInput}
          />
          {activeImage[q.id] && (
            <div style={styles.imagePreview}>
              <span>📷 {activeImage[q.id].name}</span>
              <button onClick={() => setActiveImage(prev => ({ ...prev, [q.id]: null }))} style={styles.removeBtn}>✖</button>
            </div>
          )}
        </div>

        <div style={styles.actions}>
          <button onClick={() => handlePublishClick(q.id)} disabled={processingId === q.id} style={styles.approveBtn}>
            ✅ Publish
          </button>
          <button onClick={() => handleSendFeedback(q.id)} disabled={processingId === q.id || uploading[q.id]} style={styles.feedbackBtn}>
            {uploading[q.id] ? "Uploading..." : "📨 Kirim Feedback"}
          </button>
          <button onClick={() => handleArchive(q.id)} disabled={processingId === q.id} style={styles.archiveBtn}>
            📦 Arsip
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <div style={styles.loading}>Loading review requests...</div>;
  if (questions.length === 0)
    return <div style={styles.empty}>Tidak ada soal yang perlu direview.</div>;

  return (
    <div>
      <h2>📋 Review Soal</h2>
      <p>Soal yang perlu evaluasi Anda sebelum dipublikasi.</p>

      {/* Filter Panel */}
      <div style={styles.filterPanel}>
        <div style={styles.filterControls}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Tipe:</label>
            <select value={tempTypeFilter} onChange={(e) => setTempTypeFilter(e.target.value)} style={styles.filterSelect}>
              <option value="all">Semua</option>
              <option value="new">Baru (belum pernah direvisi)</option>
              <option value="revision">Revisi (pernah direvisi)</option>
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

      {showNewSection && (
        <>
          <h3 style={styles.sectionHeader}>🆕 Soal baru (belum pernah direvisi)</h3>
          {filteredNew.map(q => renderQuestionCard(q, false))}
        </>
      )}

      {showRevisionSection && (
        <>
          <h3 style={{ ...styles.sectionHeader, color: "#f97316" }}>🔄 Soal revisi (penyusun sudah memperbaiki)</h3>
          {filteredRevision.map(q => renderQuestionCard(q, true))}
        </>
      )}

      {(!showNewSection && !showRevisionSection) && (
        <div style={styles.empty}>Tidak ada soal yang sesuai dengan filter.</div>
      )}

      {/* Modal poin */}
      {showPointsModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Setel Poin Bonus</h3>
            <p>Poin yang akan diberikan kepada student jika menjawab benar.</p>
            <input
              type="number"
              value={pointsValue}
              onChange={(e) => setPointsValue(parseInt(e.target.value) || 0)}
              min="0"
              style={styles.input}
            />
            <div style={styles.modalActions}>
              <button onClick={handlePublishWithPoints} style={styles.confirmBtn}>Publish</button>
              <button onClick={() => setShowPointsModal(false)} style={styles.cancelBtn}>Batal</button>
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
  sectionHeader: { marginTop: "20px", marginBottom: "10px", color: "#fbbf24" },
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
  creator: { color: "#94a3b8", fontSize: "0.85rem" },
  badge: { background: "#f59e0b", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold", color: "#1e293b" },
  revisionBadge: { background: "#f97316", padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold", color: "white" },
  questionText: { fontSize: "1rem", marginBottom: "12px", lineHeight: "1.5" },
  options: { marginBottom: "12px" },
  answer: { background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px", marginBottom: "16px" },
  revisionBox: {
    background: "rgba(34,197,94,0.1)",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px",
    borderLeft: "4px solid #22c55e",
  },
  revisionNote: { marginTop: "5px", fontSize: "0.9rem" },
  revisionImage: { marginTop: "5px", fontSize: "0.9rem" },
  previousFeedback: {
    background: "rgba(249,115,22,0.15)",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px",
    borderLeft: "4px solid #f97316",
  },
  prevComment: { marginTop: "5px", fontSize: "0.9rem" },
  prevImage: { marginTop: "5px", fontSize: "0.9rem" },
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
  approveBtn: { background: "#10b981", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: "bold" },
  feedbackBtn: { background: "#3b82f6", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: "bold" },
  archiveBtn: { background: "#6b7280", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: "bold" },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: { background: "#1e293b", borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "400px" },
  input: { width: "100%", padding: "10px", margin: "16px 0", background: "#0f172a", border: "1px solid #475569", borderRadius: "8px", color: "white" },
  modalActions: { display: "flex", gap: "12px", justifyContent: "flex-end" },
  confirmBtn: { background: "#10b981", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: "bold" },
  cancelBtn: { background: "#ef4444", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", color: "white", fontWeight: "bold" },
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