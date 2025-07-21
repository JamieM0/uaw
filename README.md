<p align="center">
  <img src="https://raw.githubusercontent.com/jamiem0/uaw/main/web/assets/images/logo-primary-stacked.png" alt="UAW Logo"/>
</p>

The **Universal Automation Wiki (UAW)** is an open-source platform for mapping, simulating, and optimizing real-world processes. We aim to create a unified, data-driven knowledge base that tracks global automation progress, identifies technological gaps, and helps users explore opportunities for improvement in any domain.

Unlike traditional top-down planning, UAW uses a unique **"bottom-up" methodology** and **Iterative AI**. We start with existing, real-world components and build practical, grounded process models that can be simulated and validated against hundreds of metrics.

**[Explore the Live Wiki](https://universalautomation.wiki)   or   [Try the Simulation Playground](https://universalautomation.wiki/playground)**

---

## The Problem: Siloed and Abstract Knowledge

Today, understanding and planning automation is difficult. Knowledge is fragmented across different industries, progress relies on biased expert opinions, and most process maps are static diagrams that can't be tested or validated. This makes it incredibly hard to identify real technology gaps and create realistic automation roadmaps.


## The Solution: A Dynamic, Data-Driven Wiki

UAW aims to tackle this by creating a **connected, transparent, and executable** knowledge base.

*   **Unified Platform:** Maps processes across all domains, from baking bread to manufacturing microchips.
*   **Data-Driven:** Replaces subjective opinion with objective, community-validated metrics.
*   **Dynamic Simulation:** Every process is a live simulation that can be tested, optimized, and improved.
*   **Transparent:** Our "bottom-up" approach clearly shows where innovation is needed to achieve full automation.

## Core Features

*   📚 **Hierarchical Process Mapping:** Articles break down complex tasks (e.g., *breadmaking*) into hierarchical JSON trees, creating a structured process map.
*   ⚙️ **Interactive Process Simulation:** Every article includes a dynamic simulation view, showing actors, equipment, and tasks playing out over time.
*   📊 **Extensible Validation Engine:** Simulations are checked against a growing catalog of metrics and constraints (`metrics-catalog.json`) to score their realism, efficiency, and business readiness.
*   🔬 **Live Simulation Playground:** A powerful web-based tool to edit, render, and validate simulation JSON in real-time, with interactive drag-and-drop and resizing of tasks.
*   🤖 **AI-Powered Generation:** Local Language Models (via Ollama) are used to generate the initial process trees and simulation data, providing a strong foundation for community improvement.
*   🤝 **Community-Driven:** The platform is built to evolve through community contributions, with a formal process for proposing and implementing new validation metrics.

## How It Works: Technical Overview

UAW is a static website powered by a backend generation pipeline.

1.  **Content Generation:** A local LLM generates a process as a hierarchical `tree.json` file.
2.  **Simulation Generation:** A Python script (`routines/simulation.py`) uses the LLM to convert the tree into a structured `simulation.json`, defining actors, equipment, resources, and tasks.
3.  **Validation & Metrics:** The `simulation.json` is validated against a central `metrics_catalog.json` using local LLMs via ollama. 
    The client-side **Simulation Playground** uses a JavaScript validator (`simulation-validator.js`) to provide real-time feedback.
5.  **Static Site Rendering:** A Python script (`routines/assemble.py`) uses Jinja2 templates to render the final HTML pages, embedding the simulation data directly into the page for the JavaScript viewer to use.
6.  **Deployment:** The entire `/web` directory is deployed as a static site via GitHub Pages.

## Contributing

We welcome contributions of all kinds—from developers and domain experts to anyone passionate about automation. The best way to start is by improving simulations and our validation system.

#### 🌟 **Proposing a New Metric**

This is the most impactful way to contribute! Our goal is to build a massive catalog of validation checks.

1.  **Have an idea?** Think of a new check (e.g., "Does the simulation account for equipment maintenance?" or "Is the cost of labor calculated correctly?").
2.  **Propose it:** Open a **[New Metric Proposal](https://github.com/JamieM0/uaw/issues)** using our issue template.
3.  **Discuss:** We'll discuss and refine the metric's definition with the community.
4.  **Implement:** Once approved, you or another contributor can submit a Pull Request to add the metric to `metrics-catalog.json` and, if needed, implement the logic in `simulation-validator.js`.

#### 💻 **Code Contributions**

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-awesome-feature`).
3.  Make your changes.
4.  Submit a Pull Request with a clear description of your changes.

Check out our **[Issues tab](https://github.com/jamiem0/uaw/issues)** for tasks that need help!

## Project Roadmap

We have an exciting future planned for UAW. Here are some of the key features on our roadmap:

-   [ ] **Batch Process Simulation:** Support for simulating multiple runs of a process (e.g., baking 100 loaves instead of 1).
-   [ ] **Advanced Economic Metrics:** Implement investor-focused checks for profitability, equipment ROI, and cost-per-unit analysis.
-   [ ] **LLM-Powered Validation:** Integrate local LLMs into the validation pipeline for nuanced "realism" checks.
-   [ ] **Real-World Pilot Program:** Partner with a business (like a local bakery) to validate and refine a simulation against real-world operational data.
-   [ ] **Community Contribution Workflow:** Streamline the process for users to submit improved simulations from the playground back to the main wiki.

## Licensing

The Universal Automation Wiki is an open-core project and uses a hybrid licensing model to protect the core engine while encouraging broad adoption and a commercial ecosystem.

The project is generally licensed under the **GNU Affero General Public License v3.0**, the full text of which can be found in the [LICENSE](LICENSE) file.

However, specific parts of the project intended for broader integration are licensed under the more permissive **Apache License 2.0**, the full text of which can be found in the [LICENSE-APACHE](LICENSE-APACHE) file. 

This hybrid model is designed to create a clear legal and technical boundary. Proprietary modules or integrations that you build are not considered "derivative works" of the core engine, provided they interact with it solely through the components we have licensed under Apache 2.0. This ensures the AGPL's strong copyleft provisions do not extend to your custom code. As a result, you can confidently build commercial or private software on UAW, knowing your intellectual property remains your own.

### Component Breakdown

*   **AGPL-3.0 Licensed (The Core Engine):**
    *   `/routines/simulation.py`
    *   `/routines/constraint_processor.py`
    *   All core simulation generation and validation logic.
    *   This is the "heart" of UAW. Any modifications to this core code, when used over a network, must be shared back with the community.

*   **Apache 2.0 Licensed (Modules & APIs):**
    *   This includes all future client libraries, provider integrations, and pluggable modules designed to interact with the core engine. You can build proprietary, closed-source modules using these components without the AGPL obligations applying to your module code.

If you are unsure of the relevant license, please get in touch.

## Contact

For more information, please reach out via email at [contact@universalautomation.wiki](mailto:contact@universalautomation.wiki), or [jamie@jmatthews.uk](mailto:jamie@jmatthews.uk).

Thank you for your interest in the Universal Automation Wiki!