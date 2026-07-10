const { Worker } = require('bullmq');
const axios = require('axios');
const { runStrategy } = require('./strategies'); // o teu código atual

new Worker('book-scraper', async job => {
  const { ano, ciclo, distrito, concelho, escola } = job.data;
  const resultado = await runStrategy({ ano, ciclo, distrito, concelho, escola }, (pct) => job.updateProgress(pct));

  await axios.post(process.env.LARAVEL_CALLBACK_URL, {
    run_id: job.id,
    escola,
    livros: resultado,
  }, { headers: { 'X-API-KEY': process.env.SHARED_SECRET } });

  return { status: 'done' };
}, { connection: { host: 'localhost', port: 6379 } });