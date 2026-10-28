import { useEffect } from "react";
import { Panel } from "./Panel";
import { TestFlow } from "./TestFlow";

export function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="28" height="28">
          <rect width="32" height="32" rx="8" fill="currentColor" />
          <path
            d="M8.5 16.5c1.6-4.8 4.4-7 7.5-7s5.9 2.2 7.5 7c-1.6 4.8-4.4 7-7.5 7s-5.9-2.2-7.5-7z"
            fill="none"
            stroke="#fffdf8"
            strokeWidth="1.7"
          />
          <circle cx="16" cy="16.5" r="2.1" fill="#fffdf8" />
        </svg>
      </span>
      <span className="brand-text">
        <strong>Ouvix</strong>
        <small>HearingCheck</small>
      </span>
    </a>
  );
}

export function App() {
  useEffect(() => {
    const origem = new URLSearchParams(window.location.search).get("origem");
    document.body.classList.toggle("totem", origem === "totem");
    return () => document.body.classList.remove("totem");
  }, []);

  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="topbar-note">Pré-triagem auditiva</span>
      </header>
      {window.location.pathname.startsWith("/painel") ? <Panel /> : <TestFlow />}
    </>
  );
}
