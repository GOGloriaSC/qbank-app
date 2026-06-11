import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useEffect } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Login | QBank";
  }, []);

  async function handleLogin() {
    setErrorMsg("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setErrorMsg("User tidak ditemukan");
      return;
    }

    // Ambil profile dari tabel profiles
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error(fetchError);
      setErrorMsg("Gagal mengambil data profile");
      await supabase.auth.signOut();
      return;
    }

    // Jika profile belum ada → arahkan ke register
    if (!profile) {
      await supabase.auth.signOut();
      setErrorMsg("Profile tidak ditemukan. Silakan registrasi terlebih dahulu.");
      navigate("/register");
      return;
    }

    // Cek approval_status (hanya jika kolom ada dan status bukan approved)
    if (profile.approval_status && profile.approval_status !== "approved") {
      await supabase.auth.signOut();
      setErrorMsg("Akun Anda belum disetujui oleh admin. Silakan tunggu konfirmasi.");
      return;
    }

    // Navigasi berdasarkan role
    if (profile.role === "teacher") {
      navigate("/teacher");
    } else if (profile.role === "student") {
      navigate("/student");
    } else if (profile.role === "admin") {
      navigate("/admin");
    } else {
      setErrorMsg("Role tidak dikenali");
      await supabase.auth.signOut();
    }
  }

  return (
    <AuthLayout>
      <h2 style={{ marginBottom: "10px" }}>Login</h2>

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

      <input
        style={styles.input}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        style={styles.input}
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button style={styles.button} onClick={handleLogin}>
        Login
      </button>

      <p style={{ marginTop: "10px" }}>
        Belum punya akun?{" "}
        <span style={styles.link} onClick={() => navigate("/register")}>
          Register
        </span>
      </p>
    </AuthLayout>
  );
}

const styles = {
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "10px",
    borderRadius: "6px",
    border: "none",
    background: "#334155",
    color: "white",
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