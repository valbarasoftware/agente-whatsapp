require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    if (message && message.type === 'text') {
      const from = message.from;
      const text = message.text.body;
      console.log('Mensaje de ' + from + ': ' + text);
      const respuesta = await preguntarGroq(text);
      await sendMessage(from, respuesta);
    }
  }
  res.sendStatus(200);
});

async function preguntarGroq(pregunta) {
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'Sos un asistente de atencion al cliente de Valbara Solutions, una empresa de consultoria IT en Argentina. Respondé de forma amable, breve y en español. Si no sabes algo, decí que vas a consultar con el equipo.'
          },
          {
            role: 'user',
            content: pregunta
          }
        ]
      },
      {
        headers: {
          Authorization: 'Bearer ' + process.env.GROQ_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (err) {
    console.error('Error Groq:', err.response?.data);
    return 'Disculpa, en este momento no puedo responder. Te contactamos a la brevedad.';
  }
}

async function sendMessage(to, text) {
  try {
    await axios.post(
      'https://graph.facebook.com/v25.0/' + process.env.PHONE_NUMBER_ID + '/messages',
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          Authorization: 'Bearer ' + process.env.WHATSAPP_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Error enviando mensaje:', err.response?.data);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor corriendo en puerto ' + PORT));