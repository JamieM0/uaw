import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.esm.min.mjs";

const diagrams = [...document.querySelectorAll("[data-mermaid-diagram]")];
let renderVersion = 0;

async function renderDiagrams() {
    const version = ++renderVersion;
    const dark = document.documentElement.dataset.theme === "dark";
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: dark ? "dark" : "default",
        flowchart: { htmlLabels: false, curve: "basis" }
    });
    for (const [index, diagram] of diagrams.entries()) {
        const source = diagram.querySelector(".mermaid-source code")?.textContent || "";
        const output = diagram.querySelector(".mermaid-output");
        if (!output || !source) continue;
        try {
            const id = `workspec-diagram-${version}-${index}`;
            const result = await mermaid.render(id, source);
            if (version !== renderVersion) return;
            output.innerHTML = result.svg;
            output.removeAttribute("aria-live");
            result.bindFunctions?.(output);
        } catch (error) {
            output.textContent = "The diagram could not be rendered. Open Diagram source to read it as text.";
            output.classList.add("mermaid-error");
        }
    }
}

renderDiagrams();
window.addEventListener("workspec:themechange", renderDiagrams);
