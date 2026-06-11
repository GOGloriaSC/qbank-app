import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";

export default function Silabus() {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [subChapters, setSubChapters] = useState([]);
  const [learningObjectives, setLearningObjectives] = useState([]);
  
  const [filterSubjectCode, setFilterSubjectCode] = useState("all");
  
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [showSubChapterForm, setShowSubChapterForm] = useState(false);
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  
  const [newSubject, setNewSubject] = useState({ name: "", code: "" });
  const [newChapter, setNewChapter] = useState({ subject_id: "", name: "", chapter_number: "" });
  const [newSubChapter, setNewSubChapter] = useState({ chapter_id: "", name: "", subchapter_number: "" });
  const [newObjective, setNewObjective] = useState({ subchapter_id: "", description: "", code: "" });
  
  const [importRows, setImportRows] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState({});

  useEffect(() => {
    fetchSubjects();
    fetchChapters();
    fetchSubChapters();
    fetchLearningObjectives();
  }, []);

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from("subjects").select("*").order("code");
    if (!error) setSubjects(data || []);
  };

  const fetchChapters = async () => {
    const { data, error } = await supabase.from("chapters").select("*, subjects(name, code)").order("chapter_number");
    if (!error) setChapters(data || []);
  };

  const fetchSubChapters = async () => {
    const { data, error } = await supabase.from("subchapters").select("*, chapters(name, subjects(name, code))").order("subchapter_number");
    if (!error) setSubChapters(data || []);
  };

  const fetchLearningObjectives = async () => {
    const { data, error } = await supabase.from("learning_objectives").select("*, subchapters(name, chapters(name, subjects(name, code)))").order("code");
    if (!error) setLearningObjectives(data || []);
  };

  const filteredChapters = useMemo(() => {
    if (filterSubjectCode === "all") return chapters;
    return chapters.filter(ch => ch.subjects?.code === filterSubjectCode);
  }, [chapters, filterSubjectCode]);

  const filteredSubChapters = useMemo(() => {
    if (filterSubjectCode === "all") return subChapters;
    return subChapters.filter(sc => sc.chapters?.subjects?.code === filterSubjectCode);
  }, [subChapters, filterSubjectCode]);

  const filteredLearningObjectives = useMemo(() => {
    if (filterSubjectCode === "all") return learningObjectives;
    return learningObjectives.filter(obj => obj.subchapters?.chapters?.subjects?.code === filterSubjectCode);
  }, [learningObjectives, filterSubjectCode]);

  const subjectCounts = useMemo(() => {
    const counts = {};
    subjects.forEach(subject => {
      const code = subject.code;
      const subjectChapters = chapters.filter(ch => ch.subjects?.code === code);
      let total = 0;
      subjectChapters.forEach(ch => {
        const chSubs = subChapters.filter(sc => sc.chapter_id === ch.id);
        chSubs.forEach(sc => {
          total += learningObjectives.filter(obj => obj.subchapter_id === sc.id).length;
        });
      });
      counts[code] = total;
    });
    return counts;
  }, [subjects, chapters, subChapters, learningObjectives]);

  const totalObjectives = learningObjectives.length;

  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("subjects").insert([newSubject]);
    if (error) {
      setErrorMessage("Gagal menambah mata pelajaran: " + error.message);
    } else {
      setSuccessMessage("Mata pelajaran berhasil ditambahkan!");
      setNewSubject({ name: "", code: "" });
      setShowSubjectForm(false);
      fetchSubjects();
    }
    setLoading(false);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleAddChapter = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("chapters").insert([newChapter]);
    if (error) {
      setErrorMessage("Gagal menambah bab: " + error.message);
    } else {
      setSuccessMessage("Bab berhasil ditambahkan!");
      setNewChapter({ subject_id: "", name: "", chapter_number: "" });
      setShowChapterForm(false);
      fetchChapters();
    }
    setLoading(false);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleAddSubChapter = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("subchapters").insert([newSubChapter]);
    if (error) {
      setErrorMessage("Gagal menambah sub bab: " + error.message);
    } else {
      setSuccessMessage("Sub bab berhasil ditambahkan!");
      setNewSubChapter({ chapter_id: "", name: "", subchapter_number: "" });
      setShowSubChapterForm(false);
      fetchSubChapters();
    }
    setLoading(false);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleAddObjective = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("learning_objectives").insert([newObjective]);
    if (error) {
      setErrorMessage("Gagal menambah tujuan pembelajaran: " + error.message);
    } else {
      setSuccessMessage("Tujuan pembelajaran berhasil ditambahkan!");
      setNewObjective({ subchapter_id: "", description: "", code: "" });
      setShowObjectiveForm(false);
      fetchLearningObjectives();
    }
    setLoading(false);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const exportSilabusToExcel = () => {
    const rows = [];
    const headers = ["Mata Pelajaran", "Kode MP", "Bab", "No Bab", "Sub Bab", "No Sub Bab", "Kode TP", "Deskripsi Tujuan Pembelajaran"];
    rows.push(headers);

    const subjectsToUse = filterSubjectCode === "all" ? subjects : subjects.filter(s => s.code === filterSubjectCode);
    
    subjectsToUse.forEach(subject => {
      const subjectChapters = filteredChapters.filter(ch => ch.subject_id === subject.id);
      subjectChapters.forEach(chapter => {
        const chapterSubs = filteredSubChapters.filter(sc => sc.chapter_id === chapter.id);
        chapterSubs.forEach(sub => {
          const objectives = filteredLearningObjectives.filter(obj => obj.subchapter_id === sub.id);
          if (objectives.length === 0) {
            rows.push([subject.name, subject.code, chapter.name, chapter.chapter_number, sub.name, sub.subchapter_number, "", ""]);
          } else {
            objectives.forEach(obj => {
              rows.push([subject.name, subject.code, chapter.name, chapter.chapter_number, sub.name, sub.subchapter_number, obj.code, obj.description]);
            });
          }
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Silabus");
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}`;
    const filterText = filterSubjectCode === "all" ? "semua" : filterSubjectCode;
    XLSX.writeFile(wb, `silabus_${filterText}_${timestamp}.xlsx`);
    setSuccessMessage("Data silabus berhasil diekspor ke Excel!");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { "Mata Pelajaran": "Contoh Matematika", "Kode MP": "MTH101", "Bab": "Bilangan Bulat", "No Bab": 1, "Sub Bab": "Penjumlahan", "No Sub Bab": 1, "Kode TP": "MTH101.1.1", "Deskripsi Tujuan Pembelajaran": "Siswa mampu menjumlahkan dua bilangan bulat" },
      { "Mata Pelajaran": "", "Kode MP": "", "Bab": "", "No Bab": "", "Sub Bab": "", "No Sub Bab": "", "Kode TP": "", "Deskripsi Tujuan Pembelajaran": "" }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Silabus");
    XLSX.writeFile(wb, "template_import_silabus.xlsx");
    setSuccessMessage("Template berhasil didownload.");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        if (!rows || rows.length < 2) {
          setErrorMessage("File Excel kosong atau tidak memiliki data.");
          return;
        }
        const headers = rows[0];
        const expectedHeaders = ["Mata Pelajaran", "Kode MP", "Bab", "No Bab", "Sub Bab", "No Sub Bab", "Kode TP", "Deskripsi Tujuan Pembelajaran"];
        const isValid = expectedHeaders.every((h, idx) => headers[idx]?.trim() === h);
        if (!isValid) {
          setErrorMessage("Format header tidak sesuai. Silakan gunakan file dengan header yang benar.");
          return;
        }
        const dataRows = rows.slice(1).filter(row => row.some(cell => cell && cell.toString().trim() !== ""));
        const importData = dataRows.map(row => ({
          mataPelajaran: row[0]?.toString().trim() || "",
          kodeMP: row[1]?.toString().trim() || "",
          bab: row[2]?.toString().trim() || "",
          noBab: row[3] ? Number(row[3]) : null,
          subBab: row[4]?.toString().trim() || "",
          noSubBab: row[5] ? Number(row[5]) : null,
          kodeTP: row[6]?.toString().trim() || "",
          deskripsiTP: row[7]?.toString().trim() || ""
        })).filter(item => item.mataPelajaran && item.kodeMP && item.bab && item.noBab && item.kodeTP && item.deskripsiTP);
        if (importData.length === 0) {
          setErrorMessage("Data tidak lengkap.");
          return;
        }
        setImportRows(importData);
        setShowImportModal(true);
      } catch (error) {
        setErrorMessage("Gagal membaca file Excel. Pastikan formatnya benar.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ✅ PERBAIKAN UTAMA: fungsi confirmImport yang benar (tanpa duplikasi)
  const confirmImport = async () => {
    // Cek role user
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      setErrorMessage("Hanya admin yang dapat mengimport data silabus.");
      setLoading(false);
      setShowImportModal(false);
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    const subjectCache = new Map();
    const chapterCache = new Map();
    const subChapterCache = new Map();

    for (const row of importRows) {
      try {
        let subjectId = subjectCache.get(row.kodeMP);
        if (!subjectId) {
          const { data: existing } = await supabase.from("subjects").select("id").eq("code", row.kodeMP).maybeSingle();
          if (existing) {
            subjectId = existing.id;
          } else {
            const { data: newSubject, error } = await supabase.from("subjects").insert([{ name: row.mataPelajaran, code: row.kodeMP }]).select().single();
            if (error) throw error;
            subjectId = newSubject.id;
          }
          subjectCache.set(row.kodeMP, subjectId);
        }
        const chapterKey = `${subjectId}_${row.noBab}`;
        let chapterId = chapterCache.get(chapterKey);
        if (!chapterId) {
          const { data: existing } = await supabase.from("chapters").select("id").eq("subject_id", subjectId).eq("chapter_number", row.noBab).maybeSingle();
          if (existing) {
            chapterId = existing.id;
          } else {
            const { data: newChapter, error } = await supabase.from("chapters").insert([{ subject_id: subjectId, name: row.bab, chapter_number: row.noBab }]).select().single();
            if (error) throw error;
            chapterId = newChapter.id;
          }
          chapterCache.set(chapterKey, chapterId);
        }
        const subNumber = row.noSubBab && row.subBab ? row.noSubBab : 0;
        const subName = row.subBab || "Umum";
        const subKey = `${chapterId}_${subNumber}`;
        let subChapterId = subChapterCache.get(subKey);
        if (!subChapterId) {
          const { data: existing } = await supabase.from("subchapters").select("id").eq("chapter_id", chapterId).eq("subchapter_number", subNumber).maybeSingle();
          if (existing) {
            subChapterId = existing.id;
          } else {
            const { data: newSub, error } = await supabase.from("subchapters").insert([{ chapter_id: chapterId, name: subName, subchapter_number: subNumber }]).select().single();
            if (error) throw error;
            subChapterId = newSub.id;
          }
          subChapterCache.set(subKey, subChapterId);
        }
        const { error } = await supabase
          .from("learning_objectives")
          .upsert([{ subchapter_id: subChapterId, description: row.deskripsiTP, code: row.kodeTP }], 
                  { onConflict: "code" });
        if (error) {
          console.error(`Gagal upsert untuk kode TP: ${row.kodeTP}`, error);
          throw error;
        }
        successCount++;
      } catch (err) {
        errorCount++;
      }
    }
    await Promise.all([fetchSubjects(), fetchChapters(), fetchSubChapters(), fetchLearningObjectives()]);
    setSuccessMessage(`Import selesai! ${successCount} data berhasil, ${errorCount} gagal.`);
    setShowImportModal(false);
    setImportRows([]);
    setLoading(false);
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={styles.header}>
        <h2 style={styles.title}>📚 Manajemen Silabus</h2>
        <div style={styles.buttonGroup}>
          <button onClick={handleDownloadTemplate} style={styles.templateBtn}>📋 Download Template</button>
          <label style={styles.importBtn}>
            📂 Import Excel
            <input type="file" accept=".xlsx, .xls" onChange={handleImportFile} style={{ display: "none" }} />
          </label>
          <button onClick={exportSilabusToExcel} style={styles.exportBtn}>📎 Ekspor Silabus</button>
        </div>
      </div>

      {successMessage && <div style={styles.successMessage}>{successMessage}</div>}
      {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button onClick={() => setFilterSubjectCode("all")} style={{ ...filterBtnStyle, ...(filterSubjectCode === "all" ? filterBtnActive : {}) }}>
          Semua MP ({totalObjectives})
        </button>
        {subjects.map(subject => (
          <button key={subject.code} onClick={() => setFilterSubjectCode(subject.code)} style={{ ...filterBtnStyle, ...(filterSubjectCode === subject.code ? filterBtnActive : {}) }}>
            {subject.code} ({subjectCounts[subject.code] || 0})
          </button>
        ))}
      </div>

      {showImportModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Konfirmasi Import Data</h3>
            <p>Sebanyak <strong>{importRows.length}</strong> baris data siap diimport.</p>
            <div style={styles.modalButtons}>
              <button onClick={() => setShowImportModal(false)} style={styles.cancelBtn}>Batal</button>
              <button onClick={confirmImport} style={styles.confirmBtn} disabled={loading}>{loading ? "Memproses..." : "Import"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3>📖 Mata Pelajaran</h3>
          <button onClick={() => setShowSubjectForm(!showSubjectForm)} style={styles.addBtn}>+ Tambah</button>
        </div>
        {showSubjectForm && (
          <form onSubmit={handleAddSubject} style={styles.form}>
            <input type="text" placeholder="Nama Mata Pelajaran" value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} style={styles.input} required />
            <input type="text" placeholder="Kode (contoh: MTH101)" value={newSubject.code} onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })} style={styles.input} required />
            <button type="submit" style={styles.saveBtn} disabled={loading}>Simpan</button>
          </form>
        )}
        <div style={styles.subjectGrid}>
          {subjects.map((subject) => (
            <div key={subject.id} style={styles.subjectCard}>
              <div><strong>{subject.name}</strong></div>
              <small style={{ color: "#94a3b8" }}>{subject.code}</small>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3>📗 Bab & Sub Bab</h3>
          <button onClick={() => setShowChapterForm(!showChapterForm)} style={styles.addBtn}>+ Tambah Bab</button>
        </div>
        {showChapterForm && (
          <form onSubmit={handleAddChapter} style={styles.form}>
            <select value={newChapter.subject_id} onChange={(e) => setNewChapter({ ...newChapter, subject_id: e.target.value })} style={styles.select} required>
              <option value="">Pilih Mata Pelajaran</option>
              {subjects.map((subject) => (<option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>))}
            </select>
            <input type="text" placeholder="Nama Bab" value={newChapter.name} onChange={(e) => setNewChapter({ ...newChapter, name: e.target.value })} style={styles.input} required />
            <input type="number" placeholder="Nomor Bab" value={newChapter.chapter_number} onChange={(e) => setNewChapter({ ...newChapter, chapter_number: e.target.value })} style={styles.input} required />
            <button type="submit" style={styles.saveBtn} disabled={loading}>Simpan</button>
          </form>
        )}
        <div style={styles.chapterList}>
          {filteredChapters.map((chapter) => {
            const subChaps = filteredSubChapters.filter(sc => sc.chapter_id === chapter.id);
            const isExpanded = expandedChapters[chapter.id];
            return (
              <div key={chapter.id} style={styles.chapterItem}>
                <div style={styles.chapterHeader} onClick={() => toggleChapter(chapter.id)}>
                  <span style={styles.badge}>Bab {chapter.chapter_number}</span>
                  <span style={{ fontWeight: "bold", flex: 1 }}>{chapter.name}</span>
                  <span style={{ color: "#94a3b8" }}>{chapter.subjects?.code}</span>
                  <span style={styles.expandIcon}>{isExpanded ? "▼" : "▶"}</span>
                </div>
                {isExpanded && (
                  <div style={styles.subChapterContainer}>
                    {subChaps.length === 0 && <div style={styles.emptySub}>Belum ada sub bab. <button onClick={() => { setNewSubChapter({ ...newSubChapter, chapter_id: chapter.id }); setShowSubChapterForm(true); }} style={styles.linkBtn}>Tambah sub bab</button></div>}
                    {subChaps.map(sub => {
                      const objectives = filteredLearningObjectives.filter(obj => obj.subchapter_id === sub.id);
                      return (
                        <div key={sub.id} style={styles.subChapterItem}>
                          <div style={styles.subChapterHeader}>
                            <span style={styles.badgeSmall}>Sub {sub.subchapter_number}</span>
                            <strong>{sub.name}</strong>
                          </div>
                          <div style={styles.objectiveList}>
                            {objectives.length === 0 && <div style={styles.emptyObjective}>Belum ada tujuan pembelajaran.</div>}
                            {objectives.map(obj => (
                              <div key={obj.id} style={styles.objectiveItem}>
                                <span style={styles.badgeCode}>{obj.code}</span>
                                <span>{obj.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => { setNewSubChapter({ ...newSubChapter, chapter_id: chapter.id }); setShowSubChapterForm(true); }} style={styles.addSubBtn}>+ Tambah Sub Bab</button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredChapters.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
              Tidak ada bab untuk kode MP yang dipilih.
            </div>
          )}
        </div>
      </div>

      {showSubChapterForm && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3>📘 Tambah Sub Bab</h3>
            <button onClick={() => setShowSubChapterForm(false)} style={{ background: "#ef4444", padding: "4px 8px", borderRadius: "4px", border: "none", color: "white" }}>X</button>
          </div>
          <form onSubmit={handleAddSubChapter} style={styles.form}>
            <select value={newSubChapter.chapter_id} onChange={(e) => setNewSubChapter({ ...newSubChapter, chapter_id: e.target.value })} style={styles.select} required>
              <option value="">Pilih Bab</option>
              {chapters.map((chapter) => (<option key={chapter.id} value={chapter.id}>{chapter.subjects?.code} - {chapter.name}</option>))}
            </select>
            <input type="text" placeholder="Nama Sub Bab" value={newSubChapter.name} onChange={(e) => setNewSubChapter({ ...newSubChapter, name: e.target.value })} style={styles.input} required />
            <input type="number" placeholder="Nomor Sub Bab" value={newSubChapter.subchapter_number} onChange={(e) => setNewSubChapter({ ...newSubChapter, subchapter_number: e.target.value })} style={styles.input} required />
            <button type="submit" style={styles.saveBtn} disabled={loading}>Simpan</button>
          </form>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3>🎯 Tambah Tujuan Pembelajaran</h3>
          <button onClick={() => setShowObjectiveForm(!showObjectiveForm)} style={styles.addBtn}>+ Form</button>
        </div>
        {showObjectiveForm && (
          <form onSubmit={handleAddObjective} style={styles.form}>
            <select value={newObjective.subchapter_id} onChange={(e) => setNewObjective({ ...newObjective, subchapter_id: e.target.value })} style={styles.select} required>
              <option value="">Pilih Sub Bab</option>
              {subChapters.map((subchapter) => (<option key={subchapter.id} value={subchapter.id}>{subchapter.chapters?.subjects?.code} - {subchapter.name}</option>))}
            </select>
            <input type="text" placeholder="Kode (contoh: MTH101.1.1)" value={newObjective.code} onChange={(e) => setNewObjective({ ...newObjective, code: e.target.value })} style={styles.input} required />
            <textarea placeholder="Deskripsi Tujuan Pembelajaran" value={newObjective.description} onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })} style={styles.textarea} required />
            <button type="submit" style={styles.saveBtn} disabled={loading}>Simpan</button>
          </form>
        )}
      </div>
    </div>
  );
}

// Styles
const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" },
  title: { color: "#e2e8f0", margin: 0 },
  buttonGroup: { display: "flex", gap: "10px", flexWrap: "wrap" },
  templateBtn: { background: "#10b981", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", display: "inline-block" },
  exportBtn: { background: "#3b82f6", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" },
  importBtn: { background: "#3b82f6", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", display: "inline-block" },
  successMessage: { background: "#10b98120", color: "#10b981", padding: "10px", borderRadius: "8px", marginBottom: "20px", textAlign: "center" },
  errorMessage: { background: "#ef444420", color: "#ef4444", padding: "10px", borderRadius: "8px", marginBottom: "20px", textAlign: "center" },
  section: { background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", padding: "20px", marginBottom: "20px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "1px solid #334155", paddingBottom: "10px" },
  addBtn: { background: "#7c3aed", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  form: { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" },
  input: { padding: "8px 12px", borderRadius: "6px", border: "none", background: "#334155", color: "white", fontSize: "14px", flex: 1, minWidth: "150px" },
  select: { padding: "8px 12px", borderRadius: "6px", border: "none", background: "#334155", color: "white", fontSize: "14px", flex: 1, minWidth: "150px" },
  textarea: { padding: "8px 12px", borderRadius: "6px", border: "none", background: "#334155", color: "white", fontSize: "14px", flex: 2, minWidth: "200px", resize: "vertical" },
  saveBtn: { background: "#7c3aed", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" },
  subjectGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" },
  subjectCard: { background: "#1e293b", padding: "12px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "4px" },
  chapterList: { display: "flex", flexDirection: "column", gap: "8px" },
  chapterItem: { background: "#1e293b", borderRadius: "8px", overflow: "hidden" },
  chapterHeader: { display: "flex", alignItems: "center", gap: "10px", padding: "12px", cursor: "pointer", backgroundColor: "#0f172a" },
  badge: { background: "#7c3aed", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" },
  expandIcon: { fontSize: "12px", color: "#94a3b8" },
  subChapterContainer: { padding: "12px", borderTop: "1px solid #334155", backgroundColor: "#0f172a" },
  subChapterItem: { marginBottom: "16px", background: "#1e293b", borderRadius: "6px", padding: "10px" },
  subChapterHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" },
  badgeSmall: { background: "#3b82f6", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" },
  objectiveList: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" },
  objectiveItem: { display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", padding: "4px 0", borderBottom: "1px solid #334155" },
  badgeCode: { background: "#10b981", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontFamily: "monospace", whiteSpace: "nowrap" },
  emptySub: { color: "#94a3b8", fontSize: "12px", padding: "8px", textAlign: "center" },
  emptyObjective: { color: "#94a3b8", fontSize: "11px", padding: "4px" },
  addSubBtn: { background: "transparent", border: "1px dashed #3b82f6", color: "#3b82f6", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", marginTop: "8px", width: "100%", textAlign: "center" },
  linkBtn: { background: "none", border: "none", color: "#3b82f6", cursor: "pointer", textDecoration: "underline" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#1e293b", padding: "24px", borderRadius: "12px", minWidth: "300px" },
  modalButtons: { display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" },
  cancelBtn: { background: "#475569", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" },
  confirmBtn: { background: "#3b82f6", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }
};

const filterBtnStyle = {
  padding: "6px 16px",
  borderRadius: "8px",
  border: "1px solid #475569",
  background: "transparent",
  color: "#cbd5e1",
  cursor: "pointer",
  fontSize: "0.85rem",
};

const filterBtnActive = {
  background: "#7c3aed",
  border: "1px solid #7c3aed",
  color: "white",
  fontWeight: "bold",
};