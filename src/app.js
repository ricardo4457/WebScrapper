require("dotenv").config(); // Load environment variables
const express = require("express");
const scrapeRouter = require("./routes/scrape"); // Import queue-based routes

const app = express();

// Global middleware for parsing JSON payloads
app.use(express.json());

// Register API routes
app.use("/api", scrapeRouter);

// Simple healthcheck endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", service: "Book Scraper Gateway" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[API] Scraper gateway active on port ${PORT}`);
});