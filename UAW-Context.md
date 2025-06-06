**Context for the Universal Automation Wiki (UAW) project:**

You are assisting with development for the **Universal Automation Wiki**, a site that documents how to fully automate real-world processes across many domains (e.g. breadmaking, computing, assembly lines). The goal is to make each process explorable step-by-step, backed by structured data, simulations, and automatic quality checks. The project combines static site generation, structured task trees, local LLMs (via [Ollama](https://ollama.com/)), and multiple Python automation routines.

### 🔧 Key Project Components

#### 1. **Static Site Generation**

* The UAW site is statically generated using Python and \[Jinja2] templates.
* Each article (e.g. *Breadmaking*) is rendered from a set of structured `.json` files into an HTML page using `page-template.html`.
* The site supports interactive front-end features (tree views, timeline simulations, and persona filtering) via JavaScript and CSS.

#### 2. **Template System**

* The Jinja2 template (`page-template.html`) is used to render each article.
* Sections are populated based on a `metrics.json` file that includes:

  * **Which persona(s)** each section is relevant to.
  * A list of **Boolean usefulness metrics** each section satisfies (e.g., “Includes equipment sources”).
* Persona filtering is controlled by JavaScript which hides irrelevant sections dynamically.

#### 3. **Personas & Metrics**

* There are five core user types: `hobbyist`, `researcher`, `investor`, `educator`, `field_expert`.
* Each persona has a JSON file (`metrics/hobbyist.json`, etc.) that defines a list of Boolean metric checks.
* Metric definitions (descriptions and internal IDs) are stored in `metrics/definitions.json`.
* When content is generated, a local LLM (via `evaluator.py`) applies the relevant metric checks.

---

### 🧠 LLM-Driven Content Generation

#### 4. **hallucinate-tree.py**

* This script generates a *hierarchical tree* of steps to perform a task (e.g. breadmaking).
* Each node contains:

  * A `"step"` string.
  * A `"uuid"`, and optionally a `"parent_uuid"` and `children[]`.
* Trees are written to the file system as folders with `node.json` files inside each.
* A flat JSON version of the tree is also saved for use in rendering.
* The LLM generating each subtree is **unaware of siblings**, which may lead to duplicate or redundant nodes—this is mitigated by deduplication logic and careful prompt design.

#### 5. **flow maker routines**

* Each “flow” refers to a full run of content generation from topic → tree → article → simulation.
* All content generated in a flow is stored under a directory like `flow/{uuid}/`.
* Each phase stores both inputs and outputs for traceability.

---

### 🧪 Automatic Evaluation

#### 6. **evaluator.py**

* A core routine that evaluates generated content for quality and relevance.
* Performs two main tasks:

  1. **Metric testing** – For each section, does it satisfy a list of Boolean metrics?
  2. **Relevance testing** – Is the section useful for a given persona? If so, why?
* Uses a local LLM and a prompt template that includes:

  * Persona biography.
  * Metric descriptions.
  * The content to evaluate.
* Outputs structured JSON showing:

  * `{ metric_id: true/false }` per section.
  * Overall relevance: `{ "relevant": true, "reason": "..." }`.

---

### 🕓 Simulation Feature

#### 7. **simulation.py**

* Generates a time-based **process simulation** (e.g. a workday at a bakery) using a JSON format.
* Key parts of `simulation.json`:

  * `actors[]`: Humans and tools (e.g. `Baker_1`, `Oven_1`) with availability and cost per hour.
  * `resources[]`: Inputs/outputs (e.g. `Flour_1`, `proofed_dough`) with units and starting stock.
  * `tasks[]`: Time-based actions that:

    * `consume` and `produce` resources.
    * Are assigned to actors and locations.
    * Have durations and dependencies.

* **Post-processing constraints** (optional) will include:

  * No actor/task overlaps.
  * No negative resource stocks.
  * Insert cleaning/maintenance tasks for tools.
  * Enforce profitability checks (for business use cases).

---

### 🧩 System Philosophy

* Each section or feature should be **modular** and **automatically verifiable**.
* LLMs are used to hallucinate first drafts, but these are passed through **validation routines and metrics**.
* The system prioritizes **traceability** (you can always link a section to why it was included), and **user relevance** via persona selection.
* Simulations should eventually support zoom levels (minute → day → month → year), restocking events, seasonal tasks, and real business constraints.

---

### ✅ Your Task

You will receive instructions to modify or extend code in this project. Always:

* Ensure compatibility with the Jinja2 template rendering process.
* Avoid hardcoding domain-specific logic—keep outputs general.
* Preserve traceability (i.e., link every output to a cause or metric).
* Keep JSON schemas valid, extensible, and human-readable.

You may be asked to update:

* `hallucinate-tree.py`
* `evaluator.py`
* `simulation.py`
* Jinja2 `page-template.html`
* Supporting files like `metrics/*.json`, `defaults.json`, or `simulation_schema.json`

---

**End of project context.**