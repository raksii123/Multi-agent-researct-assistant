# AI Research Pipeline 🔎📝

A multi-agent research assistant built with **LangChain**, **Mistral AI**, and **Tavily Search**. The pipeline automates the full research workflow — searching the web, scraping the most relevant source, drafting a structured report, and critiquing the final output — all in a single run.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Tools](#tools)
- [Known Issues](#known-issues)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Given a research topic, the pipeline runs four sequential stages:

1. **Search Agent** — Queries the web via Tavily and returns titles, URLs, and snippets.
2. **Reader Agent** — Picks the most relevant result and scrapes its full text content.
3. **Writer Chain** — Synthesizes the search results and scraped content into a structured report (Introduction, Key Findings, Conclusion, Sources).
4. **Critic Chain** — Reviews the report and returns a score, strengths, areas to improve, and a one-line verdict.

The final `state` dictionary contains the search results, scraped content, report, and feedback.

---

## Architecture

```
                ┌─────────────────┐
   topic ────▶  │  Search Agent    │  (Tavily web search)
                └────────┬─────────┘
                         │ search_results
                         ▼
                ┌─────────────────┐
                │  Reader Agent    │  (scrapes top URL)
                └────────┬─────────┘
                         │ scraped_content
                         ▼
                ┌─────────────────┐
                │  Writer Chain    │  (drafts the report)
                └────────┬─────────┘
                         │ report
                         ▼
                ┌─────────────────┐
                │  Critic Chain    │  (scores + feedback)
                └────────┬─────────┘
                         │
                         ▼
                  final state dict
```

---

## Project Structure

```
.
├── tools.py            # wed_search (Tavily) and scrape_url (BeautifulSoup) tools
├── agents.py            # Search/Reader agents, Writer chain, Critic chain, LLM setup
├── main.py               # run_research_pipeline() orchestration + CLI entry point
├── requirements.txt      # Python dependencies
└── .env                  # API keys (not committed)
```

> **Note:** The three Python blocks shown in the source (tools, pipeline runner, agents/chains) should live in separate files — `tools.py`, `main.py`, and `agents.py` respectively — since `main.py` imports from `agents`, and `agents.py` imports from `tools`.

---

## Prerequisites

- Python 3.10+
- A [Tavily API key](https://tavily.com/)
- A [Mistral AI API key](https://mistral.ai/)

---

## Installation

1. Clone the repository and move into the project directory:

   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate    # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

---

## Environment Variables

Create a `.env` file in the project root:

```env
TAVILY_API_KEY=your_tavily_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
```

Both `tools.py` and `agents.py` call `load_dotenv()` to load these values automatically.

---

## Usage

Run the pipeline from the command line:

```bash
python main.py
```

You'll be prompted to enter a topic:

```
Enter a research topic : Advances in solid-state batteries
```

The script will print progress for each stage (search → scrape → write → critique) and return a `state` dictionary containing:

| Key               | Description                                      |
|-------------------|---------------------------------------------------|
| `search_results`  | Raw titles/URLs/snippets from Tavily              |
| `scraped_content` | Full text scraped from the most relevant URL      |
| `report`          | The generated research report                     |
| `feedback`        | Critic's score, strengths, and improvement notes  |

---

## How It Works

### 1. Search Agent
Built with `create_agent(model=llm, tools=[wed_search])`. It receives the topic and calls the `wed_search` tool, which queries Tavily and returns up to 5 results (title, URL, snippet).

### 2. Reader Agent
Built with `create_agent(model=llm, tools=[scrape_url])`. It receives the search results, chooses the most relevant URL, and calls `scrape_url` to fetch and clean the page text (scripts, styles, nav, and footer are stripped; output capped at 3000 characters).

### 3. Writer Chain
A `ChatPromptTemplate | llm | StrOutputParser()` chain that combines the search results and scraped content into a structured report with Introduction, Key Findings, Conclusion, and Sources sections.

### 4. Critic Chain
A second `ChatPromptTemplate | llm | StrOutputParser()` chain that grades the report out of 10 and returns strengths, areas to improve, and a one-line verdict.

---

## Tools

### `wed_search(query: str) -> str`
Searches the web using the Tavily API and returns up to 5 formatted results (title, URL, snippet).

### `scrape_url(url: str) -> str`
Fetches a URL with a browser-like User-Agent, parses it with BeautifulSoup, strips `script`/`style`/`nav`/`footer` tags, and returns up to 3000 characters of clean text. Returns an error message string instead of raising if the request fails.

---

## Known Issues

A few things worth fixing before relying on this pipeline in production:

- **`build_reader_aggent()` is missing a `return` statement.** It currently calls `create_agent(...)` but doesn't return it, so it will return `None`. Fix:
  ```python
  def build_reader_aggent():
      return create_agent(
          model=llm,
          tools=[scrape_url]
      )
  ```
- **`writer_prompt.invoke(...)` returns a prompt value, not generated text.** `main.py` should use `writer_chain.invoke(...)` (the full `prompt | llm | StrOutputParser()` chain) instead of `writer_prompt.invoke(...)`, otherwise `state["report"]` will just be the formatted prompt rather than the LLM's output.
- **Typo in function name:** `build_reader_aggent` (extra "g") — consider renaming to `build_reader_agent` for consistency, and update the import in `main.py` accordingly.
- **Tool name typo:** `wed_search` — likely meant to be `web_search`. Renaming is optional but improves readability/discoverability.
- **No retry/backoff on `scrape_url`** despite `tenacity` being listed as a dependency — consider wrapping the request in a retry decorator for flaky sites.
- **`.env` file** must never be committed; add it to `.gitignore`.

---

## Roadmap

- [ ] Fix the bugs listed above
- [ ] Add unit tests for `tools.py`
- [ ] Support multi-URL scraping in the Reader Agent (not just the top result)
- [ ] Export the final report to Markdown/PDF automatically
- [ ] Add a simple CLI flag or web UI instead of `input()`

---

## License

MIT License — feel free to adapt this pipeline for your own research automation needs.
