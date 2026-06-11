import { useState, useEffect } from "react";
import { logActivity } from "../components/logActivity";
import { supabase } from "../supabaseClient";

export default function StudentSettings() { // ← nama fungsi konsisten
  const [profile, setProfile] = useState({ name: "", email: "", role: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    document.title = "Pengaturan | Aplikasiku";
    fetchUserAndProfile();
  }, []);

  const fetchUserAndProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("id", user.id)
        .single();
      if (error && error.code !== "PGRST116") console.error(error);
      setProfile({
        name: profileData?.name || "",
        email: user.email,
        role: profileData?.role || "student",
      });
    }
    setLoading(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ text: "Password baru dan konfirmasi tidak cocok.", type: "error" });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ text: "Password minimal 6 karakter.", type: "error" });
      return;
    }
    setSaving(true);
    setMessage({ text: "", type: "" });
    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    });
    if (error) {
      setMessage({ text: "Gagal mengubah password: " + error.message, type: "error" });
    } else {
      setMessage({ text: "Password berhasil diubah!", type: "success" });
      setPasswordData({ newPassword: "", confirmPassword: "" });
    }
    setSaving(false);

    // Log aktivitas
    await logActivity("change_password", "Mengubah password akun");
  };

  if (loading) return <div style={styles.loading}>Memuat pengaturan...</div>;

  return (
    <div>
      <h2>⚙️ Pengaturan Akun</h2>
      <p>Kelola keamanan dan informasi akun Anda sebagai student.</p>
      <div style={styles.infoCard}>
        <h3>Informasi Akun</h3>
        <div style={styles.infoRow}><strong>Email:</strong> {profile.email}</div>
        <div style={styles.infoRow}><strong>Role:</strong> {profile.role === "student" ? "student" : "Pengguna"}</div>
        <div style={styles.infoRow}><strong>Nama:</strong> {profile.name || "Belum diisi"}</div>
        <small style={styles.note}>💡 Nama dapat diubah di halaman <strong>Profil Saya</strong>.</small>
      </div>
      <div style={styles.formContainer}>
        <h3>Ubah Password</h3>
        <form onSubmit={handlePasswordChange}>
          <div style={styles.fieldGroup}>
            <label>Password Baru</label>
            <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} placeholder="Minimal 6 karakter" style={styles.input} required />
          </div>
          <div style={styles.fieldGroup}>
            <label>Konfirmasi Password Baru</label>
            <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} placeholder="Ketik ulang password baru" style={styles.input} required />
          </div>
          <button type="submit" disabled={saving} style={styles.button}>{saving ? "Menyimpan..." : "Update Password"}</button>
          {message.text && <div style={message.type === "success" ? styles.successMsg : styles.errorMsg}>{message.text}</div>}
        </form>
      </div>
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  infoCard: { background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px", marginBottom: "24px" },
  infoRow: { marginBottom: "8px", fontSize: "0.95rem" },
  formContainer: { maxWidth: "500px", marginTop: "20px" },
  fieldGroup: { marginBottom: "20px" },
  input: { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b", color: "white", fontSize: "1rem" },
  button: { background: "#7c3aed", border: "none", borderRadius: "8px", padding: "10px 20px", color: "white", fontWeight: "bold", cursor: "pointer" },
  successMsg: { marginTop: "15px", padding: "10px", background: "#10b98120", color: "#10b981", borderRadius: "8px" },
  errorMsg: { marginTop: "15px", padding: "10px", background: "#ef444420", color: "#ef4444", borderRadius: "8px" },
  note: { display: "block", marginTop: "8px", color: "#94a3b8", fontSize: "0.8rem" },
};