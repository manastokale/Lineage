import { createRoot } from "react-dom/client"

import App from "./App"
import ErrorBoundary from "./components/ErrorBoundary"
import "./index.css"

window.addEventListener("error", (event) => {
  console.error("[Lineage][window.error]", event.error || event.message, event)
})

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Lineage][unhandledrejection]", event.reason)
})

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
