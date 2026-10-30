import { useEffect, useState, type FormEvent } from "react";
import { requestJson } from "./api";
import { DEMO_PASSWORD, DEMO_USERS, ROLE_LABEL } from "../shared/copy";
import type { LeadStatus, Level, Origin, Role } from "../shared/types";
import { LEAD_STATUSES, ORIGINS } from "../shared/types";
import { LEVEL_LABEL, ORIGIN_LABEL, STATUS_LABEL } from "../shared/copy";

type Staff = { email: string; name: string; role: Role };

type Lead = {
  id: string;
  name: string;
  whatsappDisplay: string;
  level: Level;
  levelLabel: string;
  origin: Origin;
  originLabel: string;
  campaign: string | null;
  status: LeadStatus;
  statusLabel: string;
  createdAt: string;
  score?: number;
  message?: string;
  waUrl?: string;
  answers?: { questionId: number; text: string; label: string }[];
};

type Summary = {
  days: number;
  leads: number;
  byLevel: { level: Level; label: string; count: number }[];
  byStatus: { status: LeadStatus; label: string; count: number }[];
  sessionsStarted: number;
  sessionsFinished: number;
};

type Filters = { status: string; origin: string; level: string };

function when(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function Panel() {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState(DEMO_USERS[0].email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filters, setFilters] = useState<Filters>({ status: "", origin: "", level: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Fila de leads · Ouvix";
    requestJson<Staff>("/api/admin/me")
      .then(setStaff)
      .catch(() => setStaff(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!staff) return;
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.origin) params.set("origin", filters.origin);
    if (filters.level) params.set("level", filters.level);
    const query = params.toString();
    requestJson<{ leads: Lead[] }>(`/api/admin/leads${query ? `?${query}` : ""}`)
      .then((data) => setLeads(data.leads))
      .catch((caught: Error) => setError(caught.message));
    requestJson<Summary>("/api/admin/summary?days=30")
      .then(setSummary)
      .catch((caught: Error) => setError(caught.message));
  }, [staff, filters]);

  useEffect(() => {
    if (!selectedId || !staff) {
      setDetail(null);
      return;
    }
    requestJson<Lead>(`/api/admin/leads/${selectedId}`)
      .then(setDetail)
      .catch((caught: Error) => setError(caught.message));
  }, [selectedId, staff]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await requestJson<Staff>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setStaff(user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await requestJson("/api/admin/logout", { method: "POST", body: "{}" });
    setStaff(null);
    setSelectedId(null);
    setDetail(null);
  }

  async function changeStatus(status: LeadStatus) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await requestJson<Lead>(`/api/admin/leads/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setDetail(updated);
      setLeads((current) => current.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead)));
      const nextSummary = await requestJson<Summary>("/api/admin/summary?days=30");
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <main className="shell wide"><p className="hint">Carregando a fila…</p></main>;
  }

  if (!staff) {
    return (
      <main className="shell">
        <form className="card" onSubmit={login}>
          <p className="eyebrow">Equipe Ouvix</p>
          <h1>Entrar na fila de leads</h1>
          <p className="lede">O paciente não usa senha. Este acesso é da recepção e da avaliação.</p>
          <label className="field">
            <span>E-mail</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
          </label>
          <label className="field">
            <span>Senha</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
          <aside className="demo-note">
            <p>Acesso de demonstração</p>
            {DEMO_USERS.map((user) => (
              <p key={user.email}>{ROLE_LABEL[user.role]}: {user.email}</p>
            ))}
            <p>Senha: {DEMO_PASSWORD}</p>
          </aside>
        </form>
      </main>
    );
  }

  const novos = summary?.byStatus.find((item) => item.status === "novo")?.count ?? 0;
  const importantes = summary?.byLevel.find((item) => item.level === 3)?.count ?? 0;

  return (
    <main className="shell wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{ROLE_LABEL[staff.role]}</p>
          <h1>Fila de quem pediu contato</h1>
        </div>
        <button className="btn secondary slim" type="button" onClick={logout}>Sair</button>
      </div>
      {summary && (
        <section className="stats" aria-label="Resumo dos últimos 30 dias">
          <p><strong>{summary.leads}</strong> pedidos de contato</p>
          <p><strong>{novos}</strong> novos</p>
          <p><strong>{importantes}</strong> alerta importante</p>
          <p><strong>{summary.sessionsFinished}</strong> de <strong>{summary.sessionsStarted}</strong> testes concluídos</p>
        </section>
      )}
      <div className="filters">
        <label>
          Status
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Todos</option>
            {LEAD_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
          </select>
        </label>
        <label>
          Origem
          <select value={filters.origin} onChange={(event) => setFilters({ ...filters, origin: event.target.value })}>
            <option value="">Todas</option>
            {ORIGINS.map((origin) => <option key={origin} value={origin}>{ORIGIN_LABEL[origin]}</option>)}
          </select>
        </label>
        <label>
          Nível
          <select value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value })}>
            <option value="">Todos</option>
            {([1, 2, 3] as Level[]).map((level) => <option key={level} value={level}>{LEVEL_LABEL[level]}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="workspace">
        <div className="lead-list">
          {leads.length === 0 && <p className="hint">Nenhum lead com esse filtro.</p>}
          {leads.map((lead) => (
            <button
              key={lead.id}
              type="button"
              className={lead.id === selectedId ? "lead selected" : "lead"}
              onClick={() => setSelectedId(lead.id)}
            >
              <span>
                <strong>{lead.name}</strong>
                <small>{lead.whatsappDisplay} · {when(lead.createdAt)}</small>
              </span>
              <span className={`chip level-${lead.level}`}>{lead.levelLabel}</span>
              <span className="chip">{lead.originLabel}{lead.campaign ? ` · ${lead.campaign}` : ""}</span>
              <span className="chip">{lead.statusLabel}</span>
            </button>
          ))}
        </div>
        <aside className="detail">
          {!detail && <p className="hint">Escolha um lead para ver o contato e mudar o status.</p>}
          {detail && (
            <>
              <p className="eyebrow">{detail.originLabel}{detail.campaign ? ` · ${detail.campaign}` : ""}</p>
              <h2>{detail.name}</h2>
              <p>{detail.whatsappDisplay}</p>
              <p className={`chip level-${detail.level}`}>{detail.levelLabel}</p>
              {typeof detail.score === "number" && <p className="score">Pontuação interna: {detail.score} de 40</p>}
              {staff.role === "recepcao" && (
                <p className="hint">A pontuação e as respostas ficam com a equipe de avaliação.</p>
              )}
              {detail.waUrl && (
                <a className="btn slim" href={detail.waUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
              )}
              {detail.message && <p className="message">{detail.message}</p>}
              <div className="status-row">
                {LEAD_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={detail.status === status ? "chip button active" : "chip button"}
                    onClick={() => changeStatus(status)}
                    disabled={busy || detail.status === status}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
              {detail.answers && (
                <ol className="answers">
                  {detail.answers.map((answer) => (
                    <li key={answer.questionId}>
                      <span>{answer.text}</span>
                      <strong>{answer.label}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
