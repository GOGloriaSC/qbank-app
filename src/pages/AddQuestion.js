import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { logActivity } from "../components/logActivity";
import { supabase } from "../supabaseClient";

function RichTextEditor({ value, onChange, resetKey }) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  }, [resetKey]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !editor) return;
    setUploadingImage(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `question_${Date.now()}.${fileExt}`;
      const filePath = `questions/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("question-images")
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("question-images")
        .getPublicUrl(filePath);
      editor.chain().focus().setImage({ src: publicUrl }).run();
    } catch (err) {
      console.error(err);
      alert("Gagal mengupload gambar: " + err.message);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const toolbarButtons = [
    { label: "B", title: "Bold", style: { fontWeight: "bold" }, action: () => editor?.chain().focus().toggleBold().run(), isActive: () => editor?.isActive("bold") },
    { label: "I", title: "Italic", style: { fontStyle: "italic" }, action: () => editor?.chain().focus().toggleItalic().run(), isActive: () => editor?.isActive("italic") },
    { label: "U", title: "Underline", style: { textDecoration: "underline" }, action: () => editor?.chain().focus().toggleUnderline().run(), isActive: () => editor?.isActive("underline") },
    { label: "≡", title: "Bullet List", style: {}, action: () => editor?.chain().focus().toggleBulletList().run(), isActive: () => editor?.isActive("bulletList") },
    { label: "1.", title: "Ordered List", style: {}, action: () => editor?.chain().focus().toggleOrderedList().run(), isActive: () => editor?.isActive("orderedList") },
  ];

  return (
    <div style={editorStyles.wrapper}>
      <div style={editorStyles.toolbar}>
        {toolbarButtons.map((btn) => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            onClick={btn.action}
            style={{
              ...editorStyles.toolbarBtn,
              ...btn.style,
              ...(btn.isActive() ? editorStyles.toolbarBtnActive : {}),
            }}
          >
            {btn.label}
          </button>
        ))}
        <button
          type="button"
          title="Upload Gambar"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploadingImage}
          style={editorStyles.toolbarBtn}
        >
          {uploadingImage ? "⏳ Uploading..." : "🖼️ Gambar"}
        </button>
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />
      </div>
      <EditorContent editor={editor} className="tiptap-editor" />
    </div>
  );
}

const editorStyles = {
  wrapper: {
    border: "1px solid #475569",
    borderRadius: "8px",
    overflow: "hidden",
  },
  toolbar: {
    display: "flex",
    gap: "4px",
    padding: "8px",
    background: "#1e293b",
    borderBottom: "1px solid #475569",
    flexWrap: "wrap",
  },
  toolbarBtn: {
    background: "#334155",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    cursor: "pointer",
    color: "white",
    fontSize: "0.85rem",
  },
  toolbarBtnActive: {
    background: "#7c3aed",
  },
};

export default function AddQuestion() {
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [editorResetKey, setEditorResetKey] = useState(0);

  // State untuk data silabus
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [subchapters, setSubchapters] = useState([]);
  const [objectives, setObjectives] = useState([]);

  // State pilihan ID (cascading)
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedSubChapterId, setSelectedSubChapterId] = useState("");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState("");

  const [form, setForm] = useState({
    subject: "",
    chapter: "",
    subchapter: "",
    learning_objective: "",
    indicator: "",
    question_type: "PG",
    question_text: "",
    options: { a: "", b: "", c: "", d: "", e: "" },
    answer_pg: "a",
    answer_pgk: [],
    source: "",
  });
  const [requestReview, setRequestReview] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");

  // ========== FETCH DATA SILABUS ==========
  useEffect(() => {
    fetchSubjects();
    fetchReviewers();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchChapters(selectedSubjectId);
    } else {
      setChapters([]);
      setSelectedChapterId("");
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    if (selectedChapterId) {
      fetchSubchapters(selectedChapterId);
    } else {
      setSubchapters([]);
      setSelectedSubChapterId("");
    }
  }, [selectedChapterId]);

  useEffect(() => {
    if (selectedSubChapterId) {
      fetchObjectives(selectedSubChapterId);
    } else {
      setObjectives([]);
      setSelectedObjectiveId("");
    }
  }, [selectedSubChapterId]);

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, code")
      .order("name");
    if (error) {
      setErrorMessage("Gagal mengambil mata pelajaran: " + error.message);
    } else {
      setSubjects(data || []);
    }
  };

  const fetchChapters = async (subjectId) => {
    const { data, error } = await supabase
      .from("chapters")
      .select("id, name, chapter_number")
      .eq("subject_id", subjectId)
      .order("chapter_number");
    if (error) {
      setErrorMessage("Gagal mengambil bab: " + error.message);
    } else {
      setChapters(data || []);
      if (data.length === 0) {
        setErrorMessage("Belum ada bab untuk mata pelajaran ini.");
      }
    }
  };

  const fetchSubchapters = async (chapterId) => {
    const { data, error } = await supabase
      .from("subchapters")
      .select("id, name, subchapter_number")
      .eq("chapter_id", chapterId)
      .order("subchapter_number");
    if (error) {
      setErrorMessage("Gagal mengambil sub bab: " + error.message);
    } else {
      setSubchapters(data || []);
      if (data.length === 0) {
        setErrorMessage("Belum ada sub bab untuk bab ini.");
      }
    }
  };

  const fetchObjectives = async (subchapterId) => {
    const { data, error } = await supabase
      .from("learning_objectives")
      .select("id, description, code")
      .eq("subchapter_id", subchapterId)
      .order("code");
    if (error) {
      setErrorMessage("Gagal mengambil tujuan pembelajaran: " + error.message);
    } else {
      setObjectives(data || []);
      if (data.length === 0) {
        setErrorMessage("Belum ada tujuan pembelajaran untuk sub bab ini.");
      } else {
        setErrorMessage("");
      }
    }
  };

  const fetchReviewers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role")
      .neq("id", user.id);
    if (!error) setReviewers(data || []);
  };

  // ========== HANDLER ==========
  const handleSubjectChange = (e) => {
    const subjectId = e.target.value;
    setSelectedSubjectId(subjectId);
    const selectedSubject = subjects.find(s => s.id === subjectId);
    setForm(prev => ({ ...prev, subject: selectedSubject ? selectedSubject.name : "" }));
    // Reset dependent fields
    setForm(prev => ({ ...prev, chapter: "", subchapter: "", learning_objective: "" }));
    setSelectedChapterId("");
    setSelectedSubChapterId("");
    setSelectedObjectiveId("");
  };

  const handleChapterChange = (e) => {
    const chapterId = e.target.value;
    setSelectedChapterId(chapterId);
    const selectedChapter = chapters.find(c => c.id === chapterId);
    setForm(prev => ({ ...prev, chapter: selectedChapter ? selectedChapter.name : "" }));
    setForm(prev => ({ ...prev, subchapter: "", learning_objective: "" }));
    setSelectedSubChapterId("");
    setSelectedObjectiveId("");
  };

  const handleSubChapterChange = (e) => {
    const subId = e.target.value;
    setSelectedSubChapterId(subId);
    const selectedSub = subchapters.find(s => s.id === subId);
    setForm(prev => ({ ...prev, subchapter: selectedSub ? selectedSub.name : "" }));
    setForm(prev => ({ ...prev, learning_objective: "" }));
    setSelectedObjectiveId("");
  };

  const handleObjectiveChange = (e) => {
    const objectiveId = e.target.value;
    setSelectedObjectiveId(objectiveId);
    const selectedObjective = objectives.find(o => o.id === objectiveId);
    setForm(prev => ({ ...prev, learning_objective: selectedObjective ? selectedObjective.description : "" }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOptionChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      options: { ...prev.options, [key]: value },
    }));
  };

  const handlePgkChange = (letter) => {
    setForm((prev) => {
      const newAnswer = prev.answer_pgk.includes(letter)
        ? prev.answer_pgk.filter((l) => l !== letter)
        : [...prev.answer_pgk, letter];
      return { ...prev, answer_pgk: newAnswer };
    });
  };

  const resetForm = () => {
    setForm({
      subject: "",
      chapter: "",
      subchapter: "",
      learning_objective: "",
      indicator: "",
      question_type: "PG",
      question_text: "",
      options: { a: "", b: "", c: "", d: "", e: "" },
      answer_pg: "a",
      answer_pgk: [],
      source: "",
    });
    setSelectedSubjectId("");
    setSelectedChapterId("");
    setSelectedSubChapterId("");
    setSelectedObjectiveId("");
    setRequestReview(false);
    setSelectedReviewerId("");
    setSuccessMessage("");
    setErrorMessage("");
    setEditorResetKey(prev => prev + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage("User tidak ditemukan. Silakan login ulang.");
      setLoading(false);
      return;
    }

    // Validasi: pastikan tujuan pembelajaran sudah dipilih
    if (!form.learning_objective) {
      setErrorMessage("Silakan pilih Tujuan Pembelajaran terlebih dahulu.");
      setLoading(false);
      return;
    }

    let finalAnswer = "";
    if (form.question_type === "PG") {
      finalAnswer = form.answer_pg;
    } else {
      finalAnswer = form.answer_pgk.sort().join(",");
    }

    const options = form.options;

    let status = "draft";
    let reviewer_id = null;
    if (requestReview && selectedReviewerId) {
      status = "review";
      reviewer_id = selectedReviewerId;
    }

    const newQuestion = {
      subject: form.subject,
      chapter: form.chapter,
      subchapter: form.subchapter,
      learning_objective: form.learning_objective,
      indicator: form.indicator,
      question_type: form.question_type,
      question_text: form.question_text,
      options: options,
      answer: finalAnswer,
      source: form.source,
      status: status,
      reviewer_id: reviewer_id,
      user_id: user.id,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("questions").insert([newQuestion]);

    if (error) {
      console.error(error);
      setErrorMessage("Gagal menyimpan soal: " + error.message);
    } else {
      setSuccessMessage(`✅ Soal berhasil disimpan dengan status ${status === "draft" ? "Draft" : "Menunggu Review"}`);
      resetForm();
    }
    setLoading(false);

    // Log aktivitas
    await logActivity(
      status === "draft" ? "question_draft" : "question_review",
      status === "draft"
        ? `Menyimpan soal baru sebagai draft: "${form.question_text?.substring(0, 50)}"`
        : `Mengirim soal untuk review: "${form.question_text?.substring(0, 50)}"`,
      null
    );
  };

  return (
    <div>
      <h2 style={{ color: '#e2e8f0', marginBottom: '20px' }}>Tambah Soal Baru</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        {successMessage && <div style={styles.successMessage}>{successMessage}</div>}
        {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Mata Pelajaran</label>
            <select value={selectedSubjectId} onChange={handleSubjectChange} style={styles.select} required>
              <option value="">-- Pilih Mata Pelajaran --</option>
              {subjects.map(subj => (
                <option key={subj.id} value={subj.id}>{subj.name} ({subj.code})</option>
              ))}
            </select>
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Bab</label>
            <select value={selectedChapterId} onChange={handleChapterChange} style={styles.select} required disabled={!selectedSubjectId}>
              <option value="">-- Pilih Bab --</option>
              {chapters.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name} (Bab {ch.chapter_number})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Sub Bab</label>
            <select value={selectedSubChapterId} onChange={handleSubChapterChange} style={styles.select} required disabled={!selectedChapterId}>
              <option value="">-- Pilih Sub Bab --</option>
              {subchapters.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name} (Sub {sub.subchapter_number})</option>
              ))}
            </select>
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Tujuan Pembelajaran</label>
            <select value={selectedObjectiveId} onChange={handleObjectiveChange} style={styles.select} required disabled={!selectedSubChapterId}>
              <option value="">-- Pilih Tujuan Pembelajaran --</option>
              {objectives.map(obj => (
                <option key={obj.id} value={obj.id}>{obj.code} - {obj.description.substring(0, 80)}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Indikator</label>
            <input type="text" name="indicator" value={form.indicator} onChange={handleChange} style={styles.input} required />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Sumber</label>
            <input type="text" name="source" value={form.source} onChange={handleChange} style={styles.input} required />
          </div>
        </div>

        <div>
          <label style={styles.label}>Teks Pertanyaan</label>
          <RichTextEditor
            value={form.question_text}
            onChange={(html) => setForm(prev => ({ ...prev, question_text: html }))}
            resetKey={editorResetKey}
          />
        </div>

        <div>
          <label style={styles.label}>Pilihan Jawaban</label>
          <div style={styles.optionsGrid}>
            {["a", "b", "c", "d", "e"].map((opt) => (
              <div key={opt} style={styles.optionItem}>
                <span style={styles.optionLetter}>{opt.toUpperCase()}</span>
                <input
                  type="text"
                  placeholder={`Opsi ${opt.toUpperCase()}`}
                  value={form.options[opt] || ""}
                  onChange={(e) => handleOptionChange(opt, e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
            ))}
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Tipe Soal</label>
            <select name="question_type" value={form.question_type} onChange={handleChange} style={styles.select}>
              <option value="PG">Pilihan Ganda (PG)</option>
              <option value="PGK">Pilihan Ganda Kompleks (PGK)</option>
            </select>
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Kunci Jawaban</label>
            {form.question_type === "PG" ? (
              <select value={form.answer_pg} onChange={(e) => setForm({ ...form, answer_pg: e.target.value })} style={styles.select}>
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
                <option value="d">D</option>
                <option value="e">E</option>
              </select>
            ) : (
              <div style={styles.checkboxGroup}>
                {["a", "b", "c", "d", "e"].map((letter) => (
                  <label key={letter} style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      value={letter}
                      checked={form.answer_pgk.includes(letter)}
                      onChange={() => handlePgkChange(letter)}
                      style={{ marginRight: "4px" }}
                    />
                    {letter.toUpperCase()}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: "10px", marginBottom: "10px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" checked={requestReview} onChange={(e) => setRequestReview(e.target.checked)} />
            Minta review ke user lain
          </label>
          {requestReview && (
            <div style={{ marginTop: "10px" }}>
              <select value={selectedReviewerId} onChange={(e) => setSelectedReviewerId(e.target.value)} style={styles.select} required>
                <option value="">Pilih Reviewer</option>
                {reviewers.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.role})</option>
                ))}
              </select>
              {reviewers.length === 0 && (
                <p style={{ color: "#f87171", fontSize: "0.85rem", marginTop: "5px" }}>
                  ⚠️ Tidak ada user lain yang tersedia.
                </p>
              )}
            </div>
          )}
        </div>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Soal"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" },
  row: { display: "flex", gap: "20px", flexWrap: "wrap" },
  col: { flex: 1, minWidth: "200px" },
  label: { fontWeight: "bold", marginBottom: "5px", display: "block", color: "#e2e8f0" },
  input: { padding: "10px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "10px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", fontFamily: "inherit", boxSizing: "border-box" },
  select: { padding: "10px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", cursor: "pointer" },
  optionsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "10px", marginTop: "5px" },
  optionItem: { display: "flex", alignItems: "center", gap: "10px" },
  optionLetter: { fontWeight: "bold", width: "30px", textAlign: "center", background: "#7c3aed", borderRadius: "4px", padding: "8px 0", color: "white" },
  checkboxGroup: { display: "flex", gap: "15px", flexWrap: "wrap", marginTop: "5px" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", color: "#e2e8f0" },
  button: { background: "#7c3aed", color: "white", border: "none", borderRadius: "8px", padding: "12px", fontSize: "1rem", cursor: "pointer", marginTop: "10px" },
  successMessage: { background: "#10b98120", color: "#10b981", padding: "10px", borderRadius: "8px", marginBottom: "10px", textAlign: "center" },
  errorMessage: { background: "#ef444420", color: "#ef4444", padding: "10px", borderRadius: "8px", marginBottom: "10px", textAlign: "center" },
};