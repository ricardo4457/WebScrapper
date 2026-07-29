require("dotenv").config();
const express = require("express");
const scrapeRouter = require("./routes/scrape");
const app = express();

app.use(express.json());
app.use("/scrape", scrapeRouter);

// Start the server only when this file is executed directly.
// When imported by tests, listen() is skipped so Supertest can run
// without opening a real network port.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[API] Scraper gateway active on port ${PORT}`);
  });
}

module.exports = app;
