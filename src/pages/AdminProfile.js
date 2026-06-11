import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminProfile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    document.title = "Profil Admin | Aplikasiku";
    fetchUserAndProfile();
  }, []);

  const fetchUserAndProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      if (error) console.error(error);
      setProfile({
        name: profileData?.name || "",
        email: user.email,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage({ text: "", type: "" });

    // Cek apakah profil sudah ada
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    let error = null;
    if (existingProfile) {
      // UPDATE: hanya ubah kolom name
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ name: profile.name })
        .eq("id", user.id);
      error = updateError;
    } else {
      // INSERT: buat profil baru dengan role wajib
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ id: user.id, name: profile.name, role: "admin" });
      error = insertError;
    }

    if (error) {
      setMessage({ text: "Gagal menyimpan: " + error.message, type: "error" });
    } else {
      setMessage({ text: "Profil berhasil diperbarui!", type: "success" });
    }
    setSaving(false);
  };

  if (loading) return <div style={styles.loading}>Memuat profil admin...</div>;

  return (
    <div>
      <h2>👤 Profil Admin</h2>
      <p>Informasi akun Anda sebagai administrator.</p>
      <div style={styles.formContainer}>
        <div style={styles.fieldGroup}>
          <label>Email (tidak dapat diubah)</label>
          <input type="email" value={profile.email} disabled style={styles.inputDisabled} />
        </div>
        <div style={styles.fieldGroup}>
          <label>Nama Lengkap</label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            placeholder="Masukkan nama Anda"
            style={styles.input}
          />
        </div>
        <button onClick={handleSave} disabled={saving} style={styles.button}>
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
        {message.text && (
          <div style={message.type === "success" ? styles.successMsg : styles.errorMsg}>
            {message.text}
          </div>
        )}
      </div>
      <div style={styles.note}>
        <small>💡 Untuk mengganti password, gunakan halaman <strong>Pengaturan Admin</strong>.</small>
      </div>
    </div>
  );
}

const styles = {
  loading: { textAlign: "center", padding: "50px" },
  formContainer: { maxWidth: "500px", marginTop: "20px" },
  fieldGroup: { marginBottom: "20px" },
  input: {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#1e293b",
    color: "white",
    fontSize: "1rem",
  },
  inputDisabled: {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "#334155",
    color: "#94a3b8",
    fontSize: "1rem",
    cursor: "not-allowed",
  },
  button: {
    background: "#7c3aed",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  successMsg: { marginTop: "15px", padding: "10px", background: "#10b98120", color: "#10b981", borderRadius: "8px" },
  errorMsg: { marginTop: "15px", padding: "10px", background: "#ef444420", color: "#ef4444", borderRadius: "8px" },
  note: { marginTop: "30px", color: "#94a3b8" },
};