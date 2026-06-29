import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { CipheraMascot } from "./CipheraMascot.tsx";
import { errorHaptic, tapHaptic } from "../haptics.ts";

export type AuthSubmitPayload = {
  mode: "login" | "signup";
  username: string;
  name?: string;
  email?: string;
  password: string;
};

type AuthFlowProps = {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  inviteContext: { inviterName: string; username: string } | null;
  loading?: boolean;
  restoring?: boolean;
  error: string;
  onErrorClear: () => void;
  onSubmit: (payload: AuthSubmitPayload) => Promise<void>;
};

const LOGIN_STEPS = ["username", "password"] as const;
const SIGNUP_STEPS = ["username", "name", "email", "password"] as const;
const AUTH_MASCOT_SIZE = 96;

export function AuthFlow({
  mode,
  onModeChange,
  inviteContext,
  loading = false,
  restoring = false,
  error,
  onErrorClear,
  onSubmit
}: AuthFlowProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const steps = mode === "login" ? LOGIN_STEPS : SIGNUP_STEPS;
  const currentStep = steps[step];
  const totalSteps = steps.length;
  const isLastStep = step === totalSteps - 1;

  useEffect(() => {
    setStep(0);
    setDirection("forward");
    setLocalError("");
  }, [mode]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step, mode]);

  useEffect(() => {
    if (error) errorHaptic();
  }, [error]);

  function goBack() {
    if (step === 0) return;
    tapHaptic();
    setDirection("back");
    setLocalError("");
    onErrorClear();
    setStep((value) => value - 1);
  }

  function goNext() {
    setDirection("forward");
    setStep((value) => value + 1);
  }

  function validateCurrentStep() {
    const trimmedUsername = username.trim().replace(/^@/, "");
    if (currentStep === "username") {
      if (trimmedUsername.length < 3) {
        setLocalError("Username must be at least 3 characters.");
        errorHaptic();
        return false;
      }
      if (!/^[a-z0-9_]+$/i.test(trimmedUsername)) {
        setLocalError("Use letters, numbers, and underscores only.");
        errorHaptic();
        return false;
      }
      setUsername(trimmedUsername);
    }
    if (currentStep === "name" && name.trim().length < 2) {
      setLocalError("Display name must be at least 2 characters.");
      errorHaptic();
      return false;
    }
    if (currentStep === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLocalError("Enter a valid email address.");
      errorHaptic();
      return false;
    }
    if (currentStep === "password" && password.length < 10) {
      setLocalError("Password must be at least 10 characters.");
      errorHaptic();
      return false;
    }
    setLocalError("");
    onErrorClear();
    return true;
  }

  async function handleContinue(event: FormEvent) {
    event.preventDefault();
    if (!validateCurrentStep()) return;

    if (!isLastStep) {
      tapHaptic();
      goNext();
      return;
    }

    tapHaptic(14);
    await onSubmit({
      mode,
      username: username.trim().replace(/^@/, ""),
      name: mode === "signup" ? name.trim() : undefined,
      email: mode === "signup" ? email.trim() : undefined,
      password
    });
  }

  const displayError = localError || error;

  if (restoring) {
    return (
      <main className="auth-screen">
        <div className="auth-screen-inner auth-screen-inner--centered">
          <CipheraMascot size={112} animated />
          <h1 className="auth-brand">Ciphera</h1>
          <p className="auth-subtitle">Restoring your secure session</p>
          <div className="auth-loading">
            <Loader2 size={22} className="spin" />
          </div>
        </div>
      </main>
    );
  }

  function switchToSignup() {
    tapHaptic();
    window.history.pushState({}, "", "/register");
    onModeChange("signup");
  }

  function switchToLogin() {
    tapHaptic();
    window.history.pushState({}, "", "/");
    onModeChange("login");
  }

  return (
    <main className="auth-screen">
      <div className="auth-screen-inner auth-screen-inner--centered">
        {step > 0 && (
          <div className="auth-nav-row">
            <button type="button" className="auth-icon-btn tap-spring" onClick={goBack} aria-label="Go back">
              <ArrowLeft size={22} />
            </button>
          </div>
        )}

        <header className="auth-hero">
          <CipheraMascot size={AUTH_MASCOT_SIZE} animated className="auth-mascot-hero" />
          {step === 0 && (
            <>
              <h1 className="auth-brand auth-brand--hero">Ciphera</h1>
              <p className="auth-hero-tagline">
                {mode === "login" ? "Private messaging with client-side encryption" : "Create your secure account"}
              </p>
            </>
          )}
        </header>

        {inviteContext && step === 0 && (
          <div className="auth-invite-banner">
            <strong>{inviteContext.inviterName}</strong>
            <span>invited you to a private chat</span>
          </div>
        )}

        <form className="auth-form-wrap" onSubmit={handleContinue}>
          <div
            className={`auth-step auth-step--${direction}`}
            key={`${mode}-${currentStep}`}
          >
            <p className="auth-eyebrow">
              {mode === "login" ? "Log in" : "Sign up"}
              <span>
                {step + 1} / {totalSteps}
              </span>
            </p>
            <h2 className="auth-title">{stepTitle(currentStep, mode, username)}</h2>
            <p className="auth-hint">{stepHint(currentStep, mode)}</p>

            {currentStep === "username" && (
              <label className="auth-field">
                <span className="auth-field-prefix">@</span>
                <input
                  ref={inputRef}
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setLocalError("");
                    onErrorClear();
                  }}
                  placeholder="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
            )}

            {currentStep === "name" && (
              <label className="auth-field">
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setLocalError("");
                    onErrorClear();
                  }}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            )}

            {currentStep === "email" && (
              <label className="auth-field">
                <input
                  ref={inputRef}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setLocalError("");
                    onErrorClear();
                  }}
                  placeholder="you@email.com"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                />
              </label>
            )}

            {currentStep === "password" && (
              <label className="auth-field">
                <input
                  ref={inputRef}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setLocalError("");
                    onErrorClear();
                  }}
                  placeholder="Password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </label>
            )}
          </div>

          {displayError && <div className="auth-error auth-error--shake">{displayError}</div>}

          <button className="auth-primary-btn tap-spring" type="submit" disabled={loading}>
            {loading ? (
              <Loader2 size={20} className="spin" />
            ) : isLastStep ? (
              mode === "login" ? "Log in" : "Create account"
            ) : (
              <>
                Continue
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {mode === "signup" && (
          <div className="auth-progress" aria-hidden>
            {SIGNUP_STEPS.map((item, index) => (
              <span className={`auth-progress-dot ${index <= step ? "active" : ""}`} key={item} />
            ))}
          </div>
        )}

      </div>

      <footer className="auth-bottom-bar">
        {mode === "login" ? (
          <p className="auth-bottom-copy">
            Don&apos;t have an account?{" "}
            <a href="/register" className="auth-register-link tap-spring" onClick={(event) => { event.preventDefault(); switchToSignup(); }}>
              Register
            </a>
          </p>
        ) : (
          <p className="auth-bottom-copy">
            Already have an account?{" "}
            <a href="/" className="auth-register-link tap-spring" onClick={(event) => { event.preventDefault(); switchToLogin(); }}>
              Log in
            </a>
          </p>
        )}
      </footer>
    </main>
  );
}

function stepTitle(step: (typeof LOGIN_STEPS)[number] | (typeof SIGNUP_STEPS)[number], mode: "login" | "signup", username: string) {
  if (step === "username") return mode === "login" ? "What's your username?" : "Pick a username";
  if (step === "name") return "What's your name?";
  if (step === "email") return "Add your email";
  if (step === "password") return mode === "login" ? `Hey @${username.replace(/^@/, "")}` : "Create a password";
  return "";
}

function stepHint(step: (typeof LOGIN_STEPS)[number] | (typeof SIGNUP_STEPS)[number], mode: "login" | "signup") {
  if (step === "username") return mode === "login" ? "Enter the username you signed up with." : "This is how friends will find you on Ciphera.";
  if (step === "name") return "Your friends will see this on your profile.";
  if (step === "email") return "Used for login and account notices. Never shared in chats.";
  if (step === "password") return mode === "login" ? "Enter your password to continue." : "At least 10 characters. Keep it private.";
  return "";
}
