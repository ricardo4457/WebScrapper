const express = require("express");

const router = express.Router();

const scrapeQueue = require("../queues/ScrapeQueue");


router.post("/scrape/run", async (req, res) => {

   const {
      strategy,
      year,
      teaching_cycle,
      district,
      city,
      school,
      callback_url,
      run_token,
   } = req.body;


   const job = await scrapeQueue.add({

      strategy,

      year,

      teaching_cycle,

      district,

      city,

      school,

      callback_url,

      run_token,

   });


   return res.status(202).json({

      job_token: job.id.toString(),

      status: "queued",

   });

});


router.get("/scrape/run/:id", async (req, res) => {


   const job = await scrapeQueue.find(
      req.params.id
   );


   if (!job) {

      return res.status(404).json({
         error: "Job not found",
      });

   }


   return res.json({

      id: job.id,

      state: await job.getState(),

      progress: job.progress,

   });

});


module.exports = router;