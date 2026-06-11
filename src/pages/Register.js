import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Register | QBank";
  }, []);

  async function handleRegister() {
    setErrorMsg("");
    setSuccessMsg("");

    // Validasi input
    if (!name.trim()) {
      setErrorMsg("Nama lengkap harus diisi.");
      return;
    }
    if (!email.trim()) {
      setErrorMsg("Email harus diisi.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg("Masukkan alamat email yang valid.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password minimal 6 karakter.");
      return;
    }

    setLoading(true);

    // 1. Daftar ke Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim(), role },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      // 2. Simpan ke tabel profiles dengan status pending approval
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          [
            {
              id: userId,
              name: name.trim(),
              email: email,
              role: role,
              approval_status: "pending", // kunci: menunggu persetujuan admin
            },
          ],
          { onConflict: "id" }
        );
      if (profileError) {
        console.error("Gagal menyimpan profil:", profileError);
        setErrorMsg("Pendaftaran berhasil tetapi gagal menyimpan data profil. Silakan hubungi admin.");
        setLoading(false);
        return;
      }
    }

    // 3. Tampilkan pesan sukses (tanpa verifikasi email)
    setSuccessMsg(
      `Pendaftaran berhasil! Akun Anda (${email}) sekarang menunggu persetujuan dari admin. 
      Anda akan mendapat notifikasi setelah akun diaktifkan.`
    );
    setLoading(false);
  }

  return (
    <AuthLayout>
      <h2 style={{ marginBottom: "10px" }}>Daftar Akun Baru</h2>

      {errorMsg && (
        <div
          style={{
            backgroundColor: "#7f1d1d",
            padding: "8px",
            borderRadius: "6px",
            marginTop: "10px",
            color: "#fecaca",
            fontSize: "0.9rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            backgroundColor: "#14532d",
            padding: "15px",
            borderRadius: "8px",
            marginTop: "10px",
            color: "#bbf7d0",
            textAlign: "center",
          }}
        >
          <p>{successMsg}</p>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              marginTop: "12px",
              cursor: "pointer",
            }}
          >
            Kembali ke Halaman Login
          </button>
        </div>
      )}

      {!successMsg && (
        <>
          <input
            style={styles.input}
            placeholder="Nama Lengkap *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password * (min. 6 karakter)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            style={styles.select}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
          <button style={styles.button} onClick={handleRegister} disabled={loading}>
            {loading ? "Mendaftarkan..." : "Daftar"}
          </button>
          <p style={{ marginTop: "10px" }}>
            Sudah punya akun?{" "}
            <span style={styles.link} onClick={() => navigate("/")}>
              Login
            </span>
          </p>
        </>
      )}
    </AuthLayout>
  );
}

const styles = {
  input: {
    width: "100%",
    height: "40px",
    padding: "0 10px",
    marginTop: "10px",
    borderRadius: "6px",
    border: "none",
    background: "#334155",
    color: "white",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    height: "40px",
    padding: "0 10px",
    marginTop: "10px",
    borderRadius: "6px",
    border: "none",
    background: "#334155",
    color: "white",
    boxSizing: "border-box",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    lineHeight: "40px",
    cursor: "pointer",
  },
  button: {
    width: "100%",
    padding: "10px",
    marginTop: "15px",
    background: "#7c3aed",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  link: {
    color: "#a78bfa",
    cursor: "pointer",
  },
};