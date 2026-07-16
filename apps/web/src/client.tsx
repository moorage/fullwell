import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./app.js";
import { parseWebRenderContext } from "./context.js";
import "./styles.css";

const url = `${window.location.pathname}${window.location.search}`;
const contextElement = document.getElementById("web-context");
if (contextElement?.textContent === null || contextElement?.textContent === undefined) {
  throw new Error("Web render context element is missing");
}
const context = parseWebRenderContext(JSON.parse(contextElement.textContent));
const app = <StrictMode><App url={url} context={context} /></StrictMode>;
const root = document.getElementById("root");

if (!root) throw new Error("Web root element is missing");

if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
