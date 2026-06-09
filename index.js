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
      const respuesta = await preguntarGroq(from, text);
      await sendMessage(from, respuesta.texto);
      if (respuesta.tieneLeads) {
        await notificarLead(from, text, respuesta.texto);
      }
    }
  }
  res.sendStatus(200);
});

async function preguntarGroq(from, pregunta) {
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Sos VALBA, el asistente experto de Valbará Solutions (www.valbara.com.ar). Empresa de consultoría IT en Buenos Aires, Argentina. Partner oficial de HARDIS SISLOG WMS para Argentina, Chile y Uruguay.

SERVICIOS:
- Soluciones IT y transformación digital
- Outsourcing IT (infraestructura, soporte, desarrollo)
- Consultoría especializada (ERP, cloud, procesos)
- Desarrollo de software a medida
- HARDIS SISLOG WMS (gestión de almacenes, logística)
- Remito Digital (remito-digital.com) - solución de remitos electrónicos conforme a normativa ARCA/AFIP
- Academia Valbará (cursos virtuales e in company de IT)

CONTACTO:
- Web: www.valbara.com.ar
- Email: valbara@valbara.com.ar
- Teléfono: +54 9 11 3722-4972
- Horario de atención humana: lunes a viernes de 9 a 18hs

PERSONALIDAD:
- Consultivo, directo, analítico, orientado a resultados
- Frases cortas, ideas ordenadas
- Primero entendés el problema, después respondés
- Conectás siempre tecnología con operación
- No usás frases genéricas ni teoría vacía

REGLAS:
- Respondé siempre en español
- Si consultan fuera del horario, indicá que un especialista los contactará al siguiente día hábil
- Si la consulta requiere presupuesto o seguimiento, pedí nombre, empresa y email
- Nunca inventes precios ni compromisos comerciales
- Si el mensaje contiene nombre, empresa o email del cliente, agregá al FINAL de tu respuesta exactamente esta línea: [LEAD_DETECTADO]`
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
    const contenido = response.data.choices[0].message.content;
    const tieneLeads = contenido.includes('[LEAD_DETECTADO]');
    const texto = contenido.replace('[LEAD_DETECTADO]', '').trim();
    return { texto, tieneLeads };
  } catch (err) {
    console.error('Error Groq:', err.response?.data);
    return { texto: 'Disculpa, en este momento no puedo responder. Te contactamos a la brevedad.', tieneLeads: false };
  }
}

async function notificarLead(from, mensajeCliente, respuestaValba) {
  const notificacion = '🔔 Nuevo lead - VALBA\n' +
    'Numero: +' + from + '\n' +
    'Mensaje: ' + mensajeCliente + '\n' +
    'Respuesta VALBA: ' + respuestaValba.substring(0, 200);
  await sendMessage(process.env.NOTIFY_NUMBER, notificacion);
  console.log('Lead notificado a ' + process.env.NOTIFY_NUMBER);
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