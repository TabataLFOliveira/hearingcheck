import { useEffect } from "react";
import logo from "./assets/ouvix-logo.png";
import { Panel } from "./Panel";
import { TestFlow } from "./TestFlow";

export function Brand() {
  return (
    <a className="brand" href="/">
      <img className="brand-logo" src={logo} alt="Ouvix aparelhos auditivos" />
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
