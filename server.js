const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4200;
const distPath = path.join(__dirname, 'dist/constantine-frontend/browser');

// Serve static files
app.use(express.static(distPath));

// All routes fallback to index.html (Angular SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Constantine frontend running on port ${PORT}`);
});
