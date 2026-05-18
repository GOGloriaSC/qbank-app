import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useEffect } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Login | Aplikasiku";
  }, []);
  
  async function handleLogin() {
    console.log("LOGIN START");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    const user = data.user;

    if (!user) {
      alert("User tidak ditemukan");
      return;
    }

    console.log("USER LOGIN:", user.id);

    // Ambil profile dari tabel profiles
    const { data: profiles, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id);

    if (fetchError) {
      console.error(fetchError);
      alert("Gagal mengambil profile");
      return;
    }

    const profile = profiles[0];

    // 🔥 Jika profile belum ada → arahkan ke register
    if (!profile) {
      console.log("PROFILE BELUM ADA → REGISTER");

      // Logout agar tidak dalam state login tanpa profile
      await supabase.auth.signOut();
      
      alert("Profile tidak ditemukan. Silakan registrasi terlebih dahulu.");
      navigate("/register");
      return;
    }

    console.log("PROFILE:", profile);

    // Navigasi berdasarkan role
    if (profile.role === "guru") {
      console.log("KE TEACHER");
      navigate("/teacher");
    } else if (profile.role === "murid") {
      console.log("KE STUDENT");
      navigate("/student");
    } else {
      alert("Role tidak dikenali");
    }
  }

  return (
    <AuthLayout>
      <h2 style={{ marginBottom: "10px" }}>Login</h2>

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

      <button
        style={styles.button}
        onClick={() => {
          console.log("TOMBOL DIKLIK");
          handleLogin();
        }}
      >
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