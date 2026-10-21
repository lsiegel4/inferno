import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, type Me } from "../net/api.js";
import { useServices } from "../services.js";
import { AdSlot } from "./AdSlot.js";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: {
            client_id: string;
            callback: (r: { credential: string }) => void;
          }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google sign-in failed to load"));
    document.head.append(s);
  });
}

export interface AccountProps {
  me: Me | null;
  googleClientId: string;
  onChange: (me: Me | null) => void;
}

/** Google sign-in button, or the signed-in handle with rename and sign-out. */
export function Account({ me, googleClientId, onChange }: AccountProps) {
  const { api } = useServices();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState("");

  useEffect(() => {
    if (me || !googleClientId || !buttonRef.current) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) => {
            api
              .signIn(credential)
              .then(({ user }) => onChange({ id: user.id, handle: user.handle }))
              .catch(() => setError("Sign-in failed. Please try again."));
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "filled_black",
          text: "signin_with",
          shape: "rectangular",
        });
      })
      .catch(() => setError("Google sign-in could not load."));
    return () => {
      cancelled = true;
    };
  }, [api, me, googleClientId, onChange]);

  if (!me) {
    return (
      <section className="account">
        <p>Sign in with Google to vote and chat. Anyone can watch.</p>
        {googleClientId ? (
          <div ref={buttonRef} className="google-button" />
        ) : (
          <p className="muted">Sign-in is not configured on this server.</p>
        )}
        {error && <p className="error">{error}</p>}
        <AdSlot placement="sign-in" />
      </section>
    );
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.setHandle(handle);
      onChange({ ...me, handle: res.handle });
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "HANDLE_TAKEN"
          ? "That name is taken."
          : "Names are 3–20 letters, numbers or underscores.",
      );
    }
  };

  return (
    <section className="account signed-in">
      {editing ? (
        <form onSubmit={(e) => void save(e)} className="handle-form">
          <label htmlFor="handle-input">Your name</label>
          <input
            id="handle-input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            pattern="[A-Za-z0-9_]{3,20}"
            required
          />
          <button type="submit" className="key">
            Save
          </button>
          <button type="button" className="link" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <p>
          Playing as <b>{me.handle}</b> ·{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setHandle(me.handle);
              setEditing(true);
            }}
          >
            Rename
          </button>{" "}
          ·{" "}
          <button
            type="button"
            className="link"
            onClick={() => void api.logout().finally(() => onChange(null))}
          >
            Sign out
          </button>
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
