const express = require('express');
const scrapeQueue = require('./queue/ScrapeQueue');

const app = express();
app.use(express.json());

app.post('/scrape/run', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Por favor, fornece um URL.' });
    }

    // 1. Adiciona o trabalho à fila do Redis
    const job = await scrapeQueue.add({ url });
    console.log(`[API] Job ${job.id} adicionado à fila para o URL: ${url}`);

    // 2. Aguarda que o Worker processe o Job e devolva o resultado
    const result = await job.finished(); 
    console.log(`[API] Job ${job.id} concluído! A enviar dados para o cliente...`);

    // 3. Envia o resultado real do scraping na mensagem de sucesso
    return res.status(200).json({
      success: true,
      message: 'Scraping realizado com sucesso!',
      jobId: job.id,
      data: result // <-- Aqui vão os dados que o teu worker recolheu!
    });

  } catch (error) {
    console.error('Erro no endpoint de scraping:', error);
    return res.status(500).json({
      success: false,
      error: 'Ocorreu um erro ao processar o scraping.'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API a correr na porta ${PORT}`);
});