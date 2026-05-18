import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function AddQuestion() {
  const [loading, setLoading] = useState(false);
  const [reviewers, setReviewers] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    document.title = "Add Question | Aplikasiku";
  }, []);

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

  // Ambil daftar reviewer (user lain) untuk fitur minta review
  useEffect(() => {
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
    setRequestReview(false);
    setSelectedReviewerId("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("User tidak ditemukan. Silakan login ulang.");
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
      alert("Gagal menyimpan soal: " + error.message);
    } else {
      setSuccessMessage(`✅ Soal berhasil disimpan dengan status ${status === "draft" ? "Draft" : "Menunggu Review"}`);
      resetForm();
      // Tidak ada navigate -> tetap di halaman AddQuestion
    }
    setLoading(false);
  };

  return (
    <div>
      <h2>Tambah Soal Baru</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        {successMessage && <div style={styles.successMessage}>{successMessage}</div>}
        
        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Mata Pelajaran</label>
            <input type="text" name="subject" value={form.subject} onChange={handleChange} style={styles.input} required />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Bab</label>
            <input type="text" name="chapter" value={form.chapter} onChange={handleChange} style={styles.input} required />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Tujuan Pembelajaran</label>
            <input type="text" name="learning_objective" value={form.learning_objective} onChange={handleChange} style={styles.input} required />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Sumber</label>
            <input type="text" name="source" value={form.source} onChange={handleChange} style={styles.input} required />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Sub Bab</label>
            <input type="text" name="subchapter" value={form.subchapter} onChange={handleChange} style={styles.input} required />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Indikator</label>
            <input type="text" name="indicator" value={form.indicator} onChange={handleChange} style={styles.input} required />
          </div>
        </div>

        <div>
          <label style={styles.label}>Teks Pertanyaan</label>
          <textarea name="question_text" rows="4" style={styles.textarea} value={form.question_text} onChange={handleChange} required />
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
  label: { fontWeight: "bold", marginBottom: "5px", display: "block" },
  input: { padding: "10px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", boxSizing: "border-box" },
  textarea: { padding: "10px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", fontFamily: "inherit", boxSizing: "border-box" },
  select: { padding: "10px", borderRadius: "8px", border: "none", background: "#334155", color: "white", width: "100%", cursor: "pointer" },
  optionsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "10px", marginTop: "5px" },
  optionItem: { display: "flex", alignItems: "center", gap: "10px" },
  optionLetter: { fontWeight: "bold", width: "30px", textAlign: "center", background: "#7c3aed", borderRadius: "4px", padding: "8px 0" },
  checkboxGroup: { display: "flex", gap: "15px", flexWrap: "wrap", marginTop: "5px" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" },
  button: { background: "#7c3aed", color: "white", border: "none", borderRadius: "8px", padding: "12px", fontSize: "1rem", cursor: "pointer", marginTop: "10px" },
  successMessage: { background: "#10b98120", color: "#10b981", padding: "10px", borderRadius: "8px", marginBottom: "10px", textAlign: "center" },
};