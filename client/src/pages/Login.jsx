import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
import { login, register } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = mode === "login" ? login : register;
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const { token, user } = await fn(payload);
      signIn(token, user);

      // New user with no org → setup wizard; returning user → dashboard
      navigate(user.org?.configured ? "/dashboard" : "/setup", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <span className="login-logo-icon"><GraduationCap size={22} /></span>
          <span className="login-logo-text">OrgFlow</span>
        </div>

        <h1 className="login-heading">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="login-subheading">
          {mode === "login"
            ? "Sign in to your organization workspace."
            : "Set up OrgFlow for your student organization."}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="login-field">
              <label className="login-label">Your name</label>
              <div className="login-input-wrap">
                <User size={15} className="login-input-icon" />
                <input
                  className="login-input"
                  type="text"
                  placeholder="Alex Chen"
                  value={form.name}
                  onChange={update("name")}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="login-field">
            <label className="login-label">Email address</label>
            <div className="login-input-wrap">
              <Mail size={15} className="login-input-icon" />
              <input
                className="login-input"
                type="email"
                placeholder="you@university.edu"
                value={form.email}
                onChange={update("email")}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <div className="login-input-wrap">
              <Lock size={15} className="login-input-icon" />
              <input
                className="login-input"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={form.password}
                onChange={update("password")}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <div className="login-switch">
          {mode === "login" ? (
            <>Don't have an account?{" "}
              <button className="login-switch-btn" onClick={() => { setMode("register"); setError(""); }}>
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button className="login-switch-btn" onClick={() => { setMode("login"); setError(""); }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
