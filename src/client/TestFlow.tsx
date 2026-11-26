import { useEffect, useRef, useState, type FormEvent } from "react";
import hearingCheckLogo from "./assets/hearingcheck-logo.png";
import { requestJson } from "./api";
import { ANSWER_LABEL, REMINDER, RESULT_VOUCHER, TERMS } from "../shared/copy";
import { QUESTIONNAIRE_VERSION, QUESTIONS } from "../shared/questions";
import type { AnswerValue } from "../shared/types";

type Phase = "landing" | "contact" | "question" | "result" | "thanks";

type ResultCopy = { title: string; body: string; reminder: string };

type PublicSession = {
  id: string;
  phase: "question" | "result" | "thanks";
  questionnaireVersion: string | null;
  answers: { questionId: number; value: AnswerValue }[];
  result?: ResultCopy;
  thanks?: string;
};

const STORAGE_KEY = "hearingcheck-session";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, string>>;
  }
}

function trackingFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    origem: params.get("origem"),
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    gclid: params.get("gclid"),
    fbclid: params.get("fbclid"),
  };
}

export function TestFlow() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Array<AnswerValue | null>>(Array(QUESTIONS.length).fill(null));
  const [purpose, setPurpose] = useState(false);
  const [dataOk, setDataOk] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<ResultCopy | null>(null);
  const [thanks, setThanks] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = "HearingCheck · Ouvix";
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    let cancel = false;
    requestJson<PublicSession>(`/api/sessions/${saved}`)
      .then((session) => {
        if (cancel) return;
        restore(session);
      })
      .catch(() => sessionStorage.removeItem(STORAGE_KEY));
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase, step]);

  function restore(session: PublicSession) {
    if (session.questionnaireVersion !== QUESTIONNAIRE_VERSION) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const next = Array(QUESTIONS.length).fill(null) as Array<AnswerValue | null>;
    for (const answer of session.answers) {
      if (answer.questionId >= 1 && answer.questionId <= next.length) next[answer.questionId - 1] = answer.value;
    }
    setAnswers(next);
    setSessionId(session.id);
    if (session.phase === "thanks" && session.thanks) {
      setResult(session.result ?? null);
      setThanks(session.thanks);
      setPhase("thanks");
      return;
    }
    if (session.phase === "result" && session.result) {
      setResult(session.result);
      setPhase("result");
      return;
    }
    const firstOpen = next.findIndex((value) => value == null);
    setStep(firstOpen === -1 ? QUESTIONS.length - 1 : firstOpen);
    setPhase("question");
  }

  function continueToContact(event: FormEvent) {
    event.preventDefault();
    if (!purpose || !dataOk) {
      setError("Aceite os dois termos para começar.");
      return;
    }
    setError(null);
    setPhase("contact");
  }

  function choose(value: AnswerValue) {
    setAnswers((current) => current.map((answer, index) => (index === step ? value : answer)));
    setError(null);
  }

  async function nextQuestion() {
    const value = answers[step];
    if (!sessionId || !value) {
      setError("Escolha uma resposta para continuar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestJson(`/api/sessions/${sessionId}/answers`, {
        method: "POST",
        body: JSON.stringify({ questionId: step + 1, value }),
      });
      if (step < QUESTIONS.length - 1) {
        setStep(step + 1);
        return;
      }
      const finished = await requestJson<ResultCopy>(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        body: "{}",
      });
      setResult(finished);
      setPhase("result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir agora.");
    } finally {
      setBusy(false);
    }
  }

  async function beginTest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await requestJson<{ id: string; origin: string }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          purposeAccepted: true,
          dataAccepted: true,
          name,
          whatsapp: phone,
          tracking: trackingFromUrl(),
        }),
      });
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({ event: "generate_lead", origin: created.origin });
      sessionStorage.setItem(STORAGE_KEY, created.id);
      setSessionId(created.id);
      setStep(0);
      setPhase("question");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir agora.");
    } finally {
      setBusy(false);
    }
  }

  async function conclude() {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await requestJson<{ message: string }>(`/api/sessions/${sessionId}/close`, {
        method: "POST",
        body: "{}",
      });
      setThanks(response.message);
      setPhase("thanks");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir agora.");
    } finally {
      setBusy(false);
    }
  }

  const question = QUESTIONS[step];
  const progress = Math.round(((step + 1) / QUESTIONS.length) * 100);
  const choices: AnswerValue[] = question?.scored ? ["sim", "as_vezes", "nao"] : ["sim", "nao"];

  return (
    <main className="shell">
      {phase === "landing" && (
        <form className="card" onSubmit={continueToContact}>
          <h1 className="center" ref={headingRef} tabIndex={-1}>
            Como anda a sua audição?
          </h1>
          <p className="lede">
            Teste rápido de percepção auditiva. Receba sua orientação em minutos e agende uma avaliação gratuita.
          </p>
          <div className="notice">
            <strong>Atenção.</strong> Este teste não substitui avaliação profissional.
          </div>
          <section className="term">
            <h2>{TERMS.purpose.title}</h2>
            <p>{TERMS.purpose.body}</p>
            <label>
              <input type="checkbox" checked={purpose} onChange={(event) => setPurpose(event.target.checked)} />
              <span>{TERMS.purpose.accept}</span>
            </label>
          </section>
          <section className="term">
            <h2>{TERMS.data.title}</h2>
            <p>{TERMS.data.body}</p>
            <label>
              <input type="checkbox" checked={dataOk} onChange={(event) => setDataOk(event.target.checked)} />
              <span>{TERMS.data.accept}</span>
            </label>
          </section>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={busy || !purpose || !dataOk}>
            Continuar
          </button>
          {(!purpose || !dataOk) && <p className="hint">Os dois aceites são necessários para começar.</p>}
        </form>
      )}

      {phase === "question" && question && (
        <section className="card">
          <p className="eyebrow">Pergunta {step + 1} de {QUESTIONS.length}</p>
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <h1 className="question" ref={headingRef} tabIndex={-1}>
            {question.text}
          </h1>
          <div className="options" role="radiogroup" aria-label="Resposta">
            {choices.map((value) => (
              <button
                key={value}
                type="button"
                className={answers[step] === value ? "option selected" : "option"}
                aria-pressed={answers[step] === value}
                onClick={() => choose(value)}
              >
                {ANSWER_LABEL[value]}
              </button>
            ))}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="actions">
            {step > 0 && (
              <button className="btn secondary" type="button" onClick={() => setStep(step - 1)} disabled={busy}>
                Voltar
              </button>
            )}
            <button className="btn" type="button" onClick={nextQuestion} disabled={busy || !answers[step]}>
              {busy ? "Salvando…" : step === QUESTIONS.length - 1 ? "Finalizar teste" : "Próxima"}
            </button>
          </div>
        </section>
      )}

      {phase === "result" && result && (
        <section className="card">
          <p className="eyebrow">Resultado</p>
          <h1 className="result-primary" ref={headingRef} tabIndex={-1}>{result.body}</h1>
          <p className="result-secondary">{result.title}</p>
          <div className="notice">{result.reminder || REMINDER}</div>
          <p className="voucher">{RESULT_VOUCHER}</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" type="button" onClick={conclude} disabled={busy}>
            {busy ? "Salvando…" : "Concluir"}
          </button>
        </section>
      )}

      {phase === "contact" && (
        <form className="card" onSubmit={beginTest}>
          <p className="eyebrow phrase">Vamos Começar</p>
          <h1 className="long" ref={headingRef} tabIndex={-1}>Informe seus dados para iniciar</h1>
          <label className="field">
            <span>Nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
          <label className="field">
            <span>WhatsApp</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(11) 90000-0000"
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="actions">
            <button className="btn secondary" type="button" onClick={() => { setError(null); setPhase("landing"); }} disabled={busy}>
              Voltar
            </button>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Abrindo…" : "Começar o teste"}
            </button>
          </div>
        </form>
      )}

      {phase === "thanks" && (
        <section className="card thanks">
          <h1 ref={headingRef} tabIndex={-1}>{thanks}</h1>
        </section>
      )}

      <footer className="foot">
        <div className="foot-copy">
          <p>Ouvix, conectando você aos sons da vida.</p>
          <a href="/painel">Equipe Ouvix</a>
        </div>
        <img className="foot-logo" src={hearingCheckLogo} alt="HearingCheck" />
      </footer>
    </main>
  );
}
