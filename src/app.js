// app.js
require("dotenv").config();
const express = require("express");
const scrapeRouter = require("./routes/scrape");
const app = express();

app.use(express.json());
app.use("/scrape", scrapeRouter);



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[API] Scraper gateway active on port ${PORT}`);
});