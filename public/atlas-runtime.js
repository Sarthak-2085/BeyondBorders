// A Vercel deployment serves the bundled FastAPI function on the same origin.
// Standalone static hosts use the versioned database snapshot.
window.__BB_API__ = location.hostname.endsWith(".vercel.app") ? location.origin : "";
