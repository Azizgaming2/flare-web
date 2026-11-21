import { useState } from "react";
import { loginWithEmail, registerWithEmail, resetPassword } from "../firebase";
import "../auth.css";

const TEXT = {
  en: {
    login: "Log in", register: "Create account", email: "Email", password: "Password",
    toRegister: "No account? Create one", toLogin: "Have an account? Log in",
    forgot: "Forgot password?", sent: "Reset link sent to your email.", close: "Close",
    errors: {
      "auth/invalid-credential": "Wrong email or password.",
      "auth/invalid-email": "Invalid email.",
      "auth/email-already-in-use": "This email is already registered.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Try later.",
      "auth/network-request-failed": "No connection.",
    },
    fallback: "Login failed.",
  },
  az: {
    login: "Daxil ol", register: "Hesab yarat", email: "E-poçt", password: "Parol",
    toRegister: "Hesabın yoxdur? Yarat", toLogin: "Hesabın var? Daxil ol",
    forgot: "Parolu unutdun?", sent: "Bərpa linki e-poçta göndərildi.", close: "Bağla",
    errors: {
      "auth/invalid-credential": "E-poçt və ya parol yanlışdır.",
      "auth/invalid-email": "E-poçt düzgün deyil.",
      "auth/email-already-in-use": "Bu e-poçt artıq qeydiyyatdadır.",
      "auth/weak-password": "Parol ən azı 6 simvol olmalıdır.",
      "auth/too-many-requests": "Çox cəhd. Sonra yenidən yoxla.",
      "auth/network-request-failed": "Bağlantı yoxdur.",
    },
    fallback: "Giriş alınmadı.",
  },
  ru: {
    login: "Войти", register: "Создать аккаунт", email: "Эл. почта", password: "Пароль",
    toRegister: "Нет аккаунта? Создать", toLogin: "Есть аккаунт? Войти",
    forgot: "Забыли пароль?", sent: "Ссылка для сброса отправлена на почту.", close: "Закрыть",
    errors: {
      "auth/invalid-credential": "Неверная почта или пароль.",
      "auth/invalid-email": "Неверная почта.",
      "auth/email-already-in-use": "Эта почта уже зарегистрирована.",
      "auth/weak-password": "Пароль должен быть не короче 6 символов.",
      "auth/too-many-requests": "Слишком много попыток. Попробуйте позже.",
      "auth/network-request-failed": "Нет соединения.",
    },
    fallback: "Не удалось войти.",
  },
};

export default function AuthModal({ lang, onClose, onDone }) {
  const tx = TEXT[lang] || TEXT.en;
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "login") await loginWithEmail(email.trim(), password);
      else await registerWithEmail(email.trim(), password);
      onDone();
    } catch (err) {
      setMessage(tx.errors[err?.code] || tx.fallback);
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) return;
    try {
      await resetPassword(email.trim());
      setMessage(tx.sent);
    } catch (err) {
      setMessage(tx.errors[err?.code] || tx.fallback);
    }
  }

  return (
    <div className="modal-overlay auth-overlay" onClick={onClose}>
      <div className="modal-box auth-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="auth-title">{mode === "login" ? tx.login : tx.register}</h2>
        <input
          className="auth-input"
          type="email"
          autoComplete="email"
          placeholder={tx.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="auth-input"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={tx.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {message && <div className="auth-message">{message}</div>}
        <button className="auth-submit" onClick={submit} disabled={busy || !email || !password}>
          {mode === "login" ? tx.login : tx.register}
        </button>
        {mode === "login" && (
          <button className="auth-link" onClick={forgot}>{tx.forgot}</button>
        )}
        <button className="auth-link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>
          {mode === "login" ? tx.toRegister : tx.toLogin}
        </button>
        <button className="auth-link" onClick={onClose}>{tx.close}</button>
      </div>
    </div>
  );
}
