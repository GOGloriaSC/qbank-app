import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useEffect } from "react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("guru");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Register | Aplikasiku";
  }, []);

  async function handleRegister() {
    // Validasi
    if (!name.trim()) {
      alert("Full name is required.");
      return;
    }
    if (!email.trim()) {
      alert("Email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    // Sign up dengan metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim(), role },
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    // Ambil user dari response signUp
    const userId = data.user?.id;
    
    if (userId) {
      // Upsert profile (abaikan error jika user belum aktif atau RLS)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert([{ id: userId, name: name.trim(), role }], { onConflict: "id" });
      
      if (profileError) {
        console.warn("Profile creation skipped (user may need email verification):", profileError.message);
      }
    }

    alert("Registration successful! Please check your email to verify your account.");
    navigate("/");
  }

  return (
    <AuthLayout>
      <h2 style={{ marginBottom: "10px" }}>Register</h2>
      <input
        style={styles.input}
        placeholder="Full Name *"
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
        placeholder="Password * (min. 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <select
        style={styles.select}
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="guru">Teacher</option>
        <option value="murid">Student</option>
      </select>
      <button style={styles.button} onClick={handleRegister} disabled={loading}>
        {loading ? "Registering..." : "Register"}
      </button>
      <p style={{ marginTop: "10px" }}>
        Already have an account?{" "}
        <span style={styles.link} onClick={() => navigate("/")}>
          Login
        </span>
      </p>
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