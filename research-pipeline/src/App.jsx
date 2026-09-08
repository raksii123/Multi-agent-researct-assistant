import React, { useState } from "react";
import { Search, BookOpenText, PenLine, ClipboardCheck, AlertTriangle, RotateCcw } from "lucide-react";

const INK = "#1C2321";
const PAPER = "#EDE9DD";
const PAPER_RAISED = "#F7F4EC";
const RUST = "#8F3A22";
const RUST_TEXT = "#7A311D";
const MOSS = "#4E5B3E";
const LINE = "#C9C2AE";
const MUTED = "#6B6558";

const SERIF = '"Source Serif 4", Georgia, serif';
const SANS = '"Space Grotesk", "Segoe UI", sans-serif';

const STATIONS = [
  { key: "search", label: "Search", verb: "Searching the web", Icon: Search },
  { key: "read", label: "Read", verb: "Reading the top source", Icon: BookOpenText },
  { key: "draft", label: "Draft", verb: "Drafting the report", Icon: PenLine },
  { key: "review", label: "Review", verb: "Reviewing the draft", Icon: ClipboardCheck },
];

function extractText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

function extractSources(content) {
  if (!Array.isArray(content)) return [];
  const seen = new Set();
  const sources = [];
  content.forEach((b) => {
    if (b && b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      b.content.forEach((r) => {
        if (r && r.url && !seen.has(r.url)) {
          seen.add(r.url);
          sources.push({ title: r.title || r.url, url: r.url });
        }
      });
    }
  });
  return sources;
}

async function runResearch(topic) {
  const response = await fetch("http://127.0.0.1:8000/research", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: topic,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Backend request failed (${response.status})`);
  }

  return await response.json();
}

function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyPrefix}-b-${i}`} style={{ fontWeight: 600 }}>
        {p.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-t-${i}`}>{p}</React.Fragment>
    )
  );
}

function renderMarkdownish(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul
          key={`ul-${listKey++}`}
          style={{ paddingLeft: "1.25rem", marginBottom: "1rem", listStyleType: "disc" }}
        >
          {listItems.map((li, i) => (
            <li key={i} style={{ marginBottom: "0.35rem", lineHeight: 1.7 }}>
              {renderInline(li, `li-${listKey}-${i}`)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3
          key={i}
          style={{
            fontFamily: SERIF,
            fontSize: "1.15rem",
            fontWeight: 600,
            marginTop: "1.75rem",
            marginBottom: "0.5rem",
            color: INK,
          }}
        >
          {line.replace(/^##\s+/, "")}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h2
          key={i}
          style={{
            fontFamily: SERIF,
            fontSize: "1.4rem",
            fontWeight: 600,
            marginTop: "1.75rem",
            marginBottom: "0.6rem",
            color: INK,
          }}
        >
          {line.replace(/^#\s+/, "")}
        </h2>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push(line.slice(2));
    } else {
      flushList();
      elements.push(
        <p key={i} style={{ marginBottom: "1rem", lineHeight: 1.75 }}>
          {renderInline(line, `p-${i}`)}
        </p>
      );
    }
  });
  flushList();
  return elements;
}

function StatusDot({ status }) {
  const color = status === "done" ? MOSS : status === "error" ? "#8A2E22" : status === "running" ? RUST : LINE;
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        marginRight: 6,
      }}
    />
  );
}

export default function ResearchPipeline() {
  const [topic, setTopic] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [formError, setFormError] = useState("");
  const [stages, setStages] = useState({ search: "idle", read: "idle", draft: "idle", review: "idle" });
  const [results, setResults] = useState({});
  const [activeTab, setActiveTab] = useState("report");

  const doneCount = STATIONS.filter((s) => stages[s.key] === "done").length;
  const progressFraction = Math.max(0, Math.min(1, doneCount / (STATIONS.length - 1)));
  const hasReport = Boolean(results.reportText);

  const runPipeline = async (e) => {
    e.preventDefault();

    if (!topic.trim()) {
      setFormError("Enter a topic first.");
      return;
    }

    setFormError("");
    setIsRunning(true);
    setResults({});
    setActiveTab("report");

    setStages({
      search: "running",
      read: "idle",
      draft: "idle",
      review: "idle",
    });

    try {
      const data = await runResearch(topic);

      setResults({
        searchText: data.search_results,
        readText: data.scraped_content,
        reportText: data.report,
        critiqueText: data.feedback,
        sources: [],
      });

      setStages({
        search: "done",
        read: "done",
        draft: "done",
        review: "done",
      });

    } catch (err) {
      console.error(err);

      setFormError(
        err.message || "Something went wrong. Please try again."
      );

      setStages((s) => {
        const next = { ...s };

        Object.keys(next).forEach((key) => {
          if (next[key] === "running") {
            next[key] = "error";
          }
        });

        return next;
      });

    } finally {
      setIsRunning(false);
    }
  };

  const reset = () => {
    setTopic("");
    setResults({});
    setStages({ search: "idle", read: "idle", draft: "idle", review: "idle" });
    setFormError("");
    setActiveTab("report");
  };

  return (
    <div
      style={{
        background: PAPER,
        color: INK,
        fontFamily: SANS,
        minHeight: "100vh",
        padding: "3rem 1.5rem",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Space+Grotesk:wght@400;500&display=swap');
        .rp-input::placeholder { color: #948D7C; }
        .rp-tab { transition: color .15s ease, border-color .15s ease; }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: "2.25rem",
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            Research pipeline
          </h1>
          <p style={{ color: MUTED, fontSize: "0.95rem", marginTop: "0.6rem", maxWidth: 480, lineHeight: 1.6 }}>
            Give it a topic. It searches, reads the top source, drafts a report, then reviews its own work.
          </p>
        </header>

        {/* Form */}
        <form onSubmit={runPipeline} style={{ marginBottom: "3rem" }}>
          <label
            htmlFor="topic"
            style={{ display: "block", fontSize: "0.8rem", color: MUTED, marginBottom: "0.5rem" }}
          >
            Topic
          </label>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "1rem" }}>
            <input
              id="topic"
              className="rp-input"
              value={topic}
              disabled={isRunning}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Advances in solid-state batteries"
              style={{
                flex: 1,
                fontFamily: SERIF,
                fontSize: "1.25rem",
                background: "transparent",
                border: "none",
                borderBottom: `1.5px solid ${INK}`,
                padding: "0.4rem 0.1rem",
                outline: "none",
                color: INK,
              }}
            />
            <button
              type="submit"
              disabled={isRunning}
              style={{
                fontFamily: SANS,
                fontSize: "0.85rem",
                background: RUST,
                color: PAPER_RAISED,
                border: "none",
                padding: "0.75rem 1.4rem",
                cursor: isRunning ? "default" : "pointer",
                opacity: isRunning ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {isRunning ? "Working…" : "Begin research"}
            </button>
          </div>
          {formError && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "0.75rem", color: "#8A2E22", fontSize: "0.85rem" }}>
              <AlertTriangle size={14} />
              {formError}
            </div>
          )}
        </form>

        {/* Pipeline schematic */}
        <div style={{ position: "relative", marginBottom: "2.5rem" }}>
          <div
            style={{
              position: "absolute",
              top: 21,
              left: 22,
              right: 22,
              height: 1,
              background: LINE,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 21,
              left: 22,
              height: 1,
              background: MOSS,
              width: `calc(${progressFraction * 100}% - ${progressFraction * 44}px)`,
              transition: "width 400ms ease",
            }}
          />
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
            {STATIONS.map((st) => {
              const status = stages[st.key];
              const Icon = st.Icon;
              const circleStyle = {
                width: 44,
                height: 44,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: status === "done" ? MOSS : status === "running" ? RUST : PAPER_RAISED,
                border: `1.5px solid ${status === "error" ? "#8A2E22" : status === "idle" ? LINE : "transparent"}`,
                color: status === "idle" ? MUTED : PAPER_RAISED,
                transition: "background 300ms ease",
              };
              const statusLabel =
                status === "done" ? "Done" : status === "running" ? st.verb : status === "error" ? "Failed" : "Waiting";
              return (
                <div key={st.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                  <div style={circleStyle}>
                    <Icon size={18} />
                  </div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{st.label}</span>
                  <span style={{ fontSize: "0.7rem", color: status === "error" ? "#8A2E22" : MUTED, textAlign: "center" }}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {(hasReport || results.critiqueText) && (
          <div style={{ background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${LINE}` }}>
              {[
                { key: "report", label: "Report" },
                { key: "sources", label: `Sources${results.sources?.length ? ` (${results.sources.length})` : ""}` },
                { key: "critique", label: "Critique" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className="rp-tab"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    padding: "0.85rem 0",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab.key ? `2px solid ${RUST}` : "2px solid transparent",
                    color: activeTab === tab.key ? INK : MUTED,
                    fontFamily: SANS,
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "1.75rem", fontFamily: SERIF, fontSize: "1rem" }}>
              {activeTab === "report" &&
                (results.reportText ? (
                  renderMarkdownish(results.reportText)
                ) : (
                  <p style={{ color: MUTED, fontFamily: SANS, fontSize: "0.9rem" }}>
                    <StatusDot status={stages.draft} />
                    Report will appear here once drafted.
                  </p>
                ))}

              {activeTab === "sources" &&
                (results.sources && results.sources.length ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {results.sources.map((s, i) => (
                      <li
                        key={i}
                        style={{
                          padding: "0.75rem 0",
                          borderBottom: i < results.sources.length - 1 ? `1px solid ${LINE}` : "none",
                        }}
                      >
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: RUST_TEXT, textDecoration: "none", fontWeight: 600 }}
                        >
                          {s.title}
                        </a>
                        <div style={{ fontFamily: SANS, fontSize: "0.75rem", color: MUTED, marginTop: "0.2rem" }}>
                          {s.url}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: MUTED, fontFamily: SANS, fontSize: "0.9rem" }}>No sources captured yet.</p>
                ))}

              {activeTab === "critique" &&
                (results.critiqueText ? (
                  renderMarkdownish(results.critiqueText)
                ) : (
                  <p style={{ color: MUTED, fontFamily: SANS, fontSize: "0.9rem" }}>
                    <StatusDot status={stages.review} />
                    Critique will appear here once the review step finishes.
                  </p>
                ))}
            </div>
          </div>
        )}

        {(hasReport || formError) && (
          <button
            onClick={reset}
            disabled={isRunning}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: "1.5rem",
              background: "transparent",
              border: "none",
              color: MUTED,
              fontFamily: SANS,
              fontSize: "0.8rem",
              cursor: isRunning ? "default" : "pointer",
              padding: 0,
            }}
          >
            <RotateCcw size={13} />
            Start a new topic
          </button>
        )}
      </div>
    </div>
  );
}