const express = require("express");

const scrapeRoutes = require("./routes/scrape");


const app = express();


app.use(express.json());


app.use(scrapeRoutes);


app.listen(
   3000,
   () => {
      console.log("Scraper API running on port 3000");
   }
);