const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;
const distPath = path.join(__dirname, "dist/constantine-frontend/browser");

// Redirect www → apex so there's one canonical origin (keeps API/CORS on constantine.tours)
app.use((req, res, next) => {
  const host = req.headers.host || "";
  if (host.startsWith("www.")) {
    return res.redirect(301, `https://${host.slice(4)}${req.originalUrl}`);
  }
  next();
});

// Serve static files
app.use(express.static(distPath));

// All routes fallback to index.html (Angular SPA)
app.use((req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Constantine frontend running on port ${PORT}`);
});
