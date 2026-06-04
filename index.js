require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// ✅ Verificación del webhook (Meta llama esto 1 vez al registrar)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('Webhook verificado ✅');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 📩 Recibir mensajes entrantes
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;        // número del cliente
      const text = message.text?.body;  // texto del mensaje

      console.log(`Mensaje de ${from}: ${text}`);

      // 🤖 Por ahora responde eco — después conectamos el LLM
      await sendMessage(from, `Recibimos tu mensaje: "${text}". Te respondemos enseguida.`);
    }
  }

  res.sendStatus(200);
});

// 📤 Función para enviar mensajes
async function sendMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v25.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Error enviando mensaje:', err.response?.data);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
