const express = require('express');
const { Queue } = require('bullmq');
const app = express();
app.use(express.json());

const scrapeQueue = new Queue('book-scraper', { connection: { host: 'localhost', port: 6379 } });

app.post('/scrape/run', async (req, res) => {
  const { ano, ciclo, distrito, concelho, escola } = req.body;
  const job = await scrapeQueue.add('run', { ano, ciclo, distrito, concelho, escola });
  res.status(202).json({ run_id: job.id, status: 'queued' });
});

app.get('/scrape/run/:id', async (req, res) => {
  const job = await scrapeQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json({ id: job.id, state: await job.getState(), progress: job.progress });
});

app.listen(3000);