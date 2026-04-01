import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithPassword } from "../api/endpoints";
import { extractError } from "../utils/extractError";
import "./login.css";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email आणि Password भरा");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await loginWithPassword(email, password);
      // Backend envelope: { success, message, data: { token }, meta }
      const token = res.data?.data?.token;
      if (!token) { setError("लॉगिन अयशस्वी — token मिळाला नाही"); return; }
      localStorage.setItem("token", token);
      navigate("/");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Advika Auto Accessories</h1>
        <p className="login-sub">Staff Login</p>

        <form onSubmit={handleLogin} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            autoComplete="email"
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            autoComplete="current-password"
          />

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" disabled={loading}>
            {loading ? "लॉगिन होत आहे..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
