import logo from "../assets/logo.png";

export default function AuthLayout({ children }) {
  return (
    <div style={styles.container}>

      {/* LEFT */}
      <div style={styles.left}>
        <img src={logo} alt="logo" style={styles.logo} />

        <h2 style={styles.title}>Question Bank System</h2>
        <p style={styles.desc}>
          Platform untuk membantu teacher membuat, mereview, dan mengelola bank soal secara terstruktur dan kolaboratif.
        </p>
      </div>

      {/* RIGHT */}
      <div style={styles.right}>
        <div style={styles.card}>
          {children} {/* 🔥 ISI DINAMIS */}
        </div>
      </div>

    </div>
  );
}

const styles = {
  container: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    height: "100vh",
    background: "linear-gradient(135deg, #0f172a, #1e293b)",
    alignItems: "center",
  },

  left: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "40px",
    color: "white",
    textAlign: "center",
  },

  logo: {
    width: "150px",
    marginBottom: "20px",
  },

  title: {
    margin: "0",
    marginBottom: "12px",
  },

  desc: {
    margin: "0",
    marginTop: "10px",
    maxWidth: "300px",
    color: "#cbd5f5",
    lineHeight: "1.6",
  },

  right: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    width: "320px",
    background: "rgba(255,255,255,0.05)",
    padding: "30px",
    borderRadius: "12px",
    color: "white",
  },
};