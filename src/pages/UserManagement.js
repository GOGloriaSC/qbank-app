import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const fileInputRef = useRef(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "student" });
  const [resettingUserId, setResettingUserId] = useState(null);
  const [filterRole, setFilterRole] = useState("all");

  const filteredUsers = users.filter(u => {
    if (u.role === "admin") return false;
    if (filterRole === "all") return true;
    return u.role === filterRole;
  });

  const teacherCount = users.filter(u => u.role === "teacher").length;
  const studentCount = users.filter(u => u.role === "student").length;

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) showMessage("error", error.message);
    else setUsers(data || []);
    setLoading(false);
  }, [showMessage]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      showMessage("error", "Semua field harus diisi.");
      return;
    }
    if (newUser.password.length < 6) {
      showMessage("error", "Password minimal 6 karakter.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: { name: newUser.name, role: newUser.role },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpError) throw signUpError;
      const userId = data.user?.id;
      if (userId) {
        await supabase.from("profiles").upsert(
          [{ id: userId, name: newUser.name, email: newUser.email, role: newUser.role, approval_status: "approved" }],
          { onConflict: "id" }
        );
      }
      showMessage("success", `User ${newUser.name} berhasil ditambahkan.`);
      setNewUser({ name: "", email: "", password: "", role: "student" });
      fetchUsers();
    } catch (err) {
      showMessage("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Hapus user "${userName}"? Data akan dihapus dari profiles (auth masih ada).`)) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) showMessage("error", error.message);
    else {
      showMessage("success", `User ${userName} dihapus dari profiles.`);
      fetchUsers();
    }
    setLoading(false);
  };

  // Reset password menggunakan Edge Function
  const handleResetPassword = async (userId, email) => {
    const newPassword = prompt(`Masukkan password baru untuk ${email}:`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      showMessage("error", "Password minimal 6 karakter.");
      return;
    }
    if (!window.confirm(`Reset password untuk ${email}?`)) return;

    setResettingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { email, new_password: newPassword }
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      showMessage("success", `Password untuk ${email} berhasil direset.`);
    } catch (err) {
      console.error(err);
      showMessage("error", err.message);
    } finally {
      setResettingUserId(null);
    }
  };

  const handleExport = () => {
    if (users.length === 0) {
      showMessage("error", "Tidak ada data untuk diekspor.");
      return;
    }
    const exportData = users.map((u) => ({
      Nama: u.name || "",
      Email: u.email,
      Role: u.role === "teacher" ? "Guru" : u.role === "student" ? "Siswa" : "Admin",
      Bergabung: u.created_at ? new Date(u.created_at).toLocaleDateString("id-ID") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pengguna");
    XLSX.writeFile(wb, `pengguna_${new Date().toISOString().slice(0, 19)}.xlsx`);
    showMessage("success", `Ekspor ${users.length} user berhasil.`);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { Nama: "Contoh Nama", Email: "contoh@email.com", Role: "Guru", Password: "password123" },
      { Nama: "", Email: "", Role: "Siswa", Password: "" },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 10 },
      { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template User");
    XLSX.writeFile(wb, "template_import_user.xlsx");
    showMessage("success", "Template berhasil didownload.");
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (!rows.length) throw new Error("File kosong");

        const required = ["Nama", "Email", "Role", "Password"];
        const headers = Object.keys(rows[0]).map(h => h.toLowerCase());
        const missing = required.filter(r => !headers.includes(r.toLowerCase()));
        if (missing.length) throw new Error(`Kolom hilang: ${missing.join(", ")}`);

        const usersToImport = [];
        for (const row of rows) {
          const name = row.Nama || row.nama || "";
          const email = row.Email || row.email || "";
          const roleRaw = (row.Role || row.role || "").toLowerCase();
          const password = row.Password || row.password || "";
          let role = "";
          if (roleRaw === "guru" || roleRaw === "teacher") role = "teacher";
          else if (roleRaw === "siswa" || roleRaw === "student") role = "student";
          else continue;
          if (name && email && password && role && password.length >= 6) {
            usersToImport.push({ name, email, password, role });
          }
        }
        if (!usersToImport.length) throw new Error("Tidak ada data valid.");

        let success = 0, fail = 0;
        for (const u of usersToImport) {
          try {
            const { data, error: signUpError } = await supabase.auth.signUp({
              email: u.email,
              password: u.password,
              options: {
                data: { name: u.name, role: u.role },
                emailRedirectTo: `${window.location.origin}/login`,
              },
            });
            if (signUpError) throw signUpError;
            const userId = data.user?.id;
            if (userId) {
              await supabase.from("profiles").upsert(
                [{ id: userId, name: u.name, email: u.email, role: u.role, approval_status: "approved" }],
                { onConflict: "id" }
              );
            }
            success++;
          } catch (err) {
            console.error(err);
            fail++;
          }
        }
        showMessage("success", `Import selesai: ${success} berhasil, ${fail} gagal.`);
        fetchUsers();
      } catch (error) {
        showMessage("error", error.message);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => showMessage("error", "Gagal membaca file.");
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
        <h2>Manajemen Pengguna</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleDownloadTemplate} style={buttonStyle.template}>📋 Download Template</button>
          <button onClick={() => fileInputRef.current?.click()} disabled={loading} style={buttonStyle.secondary}>📂 Import Excel</button>
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleImport} style={{ display: "none" }} />
          <button onClick={handleExport} disabled={loading} style={buttonStyle.secondary}>📎 Ekspor Excel</button>
        </div>
      </div>

      {message.text && (
        <div style={{ padding: "10px", borderRadius: "6px", marginBottom: "15px", backgroundColor: message.type === "error" ? "#7f1d1d" : "#14532d", color: "#fff" }}>
          {message.text}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button
          onClick={() => setFilterRole("all")}
          style={{ ...filterBtnStyle, ...(filterRole === "all" ? filterBtnActive : {}) }}
        >
          Semua ({teacherCount + studentCount})
        </button>
        <button
          onClick={() => setFilterRole("teacher")}
          style={{ ...filterBtnStyle, ...(filterRole === "teacher" ? filterBtnActive : {}) }}
        >
          Guru ({teacherCount})
        </button>
        <button
          onClick={() => setFilterRole("student")}
          style={{ ...filterBtnStyle, ...(filterRole === "student" ? filterBtnActive : {}) }}
        >
          Siswa ({studentCount})
        </button>
      </div>

      <div style={{ overflowX: "auto", background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "4px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155" }}>
              <th style={{ ...thStyle, width: "20%" }}>Nama</th>
              <th style={{ ...thStyle, width: "35%" }}>Email</th>
              <th style={{ ...thStyle, width: "10%" }}>Role</th>
              <th style={{ ...thStyle, width: "35%" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} style={{ borderBottom: "1px solid #334155" }}>
                <td style={tdStyle}>{user.name || "-"}</td>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>
                  {user.role === "teacher" ? "Guru" : user.role === "student" ? "Siswa" : "Admin"}
                </td>
                <td style={tdStyle}>
                  <button
                    onClick={() => handleResetPassword(user.id, user.email)}
                    disabled={resettingUserId === user.id}
                    style={{ ...buttonStyle.small, backgroundColor: "#f59e0b", marginRight: "8px" }}
                  >
                    {resettingUserId === user.id ? "..." : "Reset PW"}
                  </button>
                  <button
                    onClick={() => handleDelete(user.id, user.name)}
                    style={{ ...buttonStyle.small, backgroundColor: "#dc2626" }}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && !loading && (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", padding: "40px" }}>Belum ada user.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "30px", background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "20px" }}>
        <h3>Tambah User Baru</h3>
        <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input type="text" placeholder="Nama Lengkap" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required style={inputStyle} />
          <input type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required style={inputStyle} />
          <input type="password" placeholder="Password (min 6)" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required style={inputStyle} />
          <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={inputStyle}>
            <option value="student">Siswa</option>
            <option value="teacher">Guru</option>
          </select>
          <button type="submit" disabled={loading} style={buttonStyle.primary}>Tambah User</button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #475569",
  background: "#1e293b", color: "white", outline: "none"
};
const buttonStyle = {
  primary: { background: "#7c3aed", color: "white", padding: "10px 16px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  secondary: { background: "#3b82f6", color: "white", padding: "8px 16px", border: "none", borderRadius: "8px", cursor: "pointer", display: "inline-block" },
  small: { background: "#f59e0b", color: "#1e293b", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "0.8rem", marginRight: "4px" },
  template: { background: "#10b981", color: "white", padding: "8px 16px", border: "none", borderRadius: "8px", cursor: "pointer", display: "inline-block" }
};
const thStyle = { textAlign: "left", padding: "12px", background: "rgba(0,0,0,0.3)", borderBottom: "1px solid #334155" };
const tdStyle = { padding: "10px 12px" };

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