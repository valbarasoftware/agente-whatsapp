require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Memoria de conversaciones por número
const conversaciones = {};

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

      // Inicializar historial si no existe
      if (!conversaciones[from]) {
        conversaciones[from] = [];
      }

      // Agregar mensaje del cliente al historial
      conversaciones[from].push({ role: 'user', content: text });

      // Limitar historial a últimos 10 mensajes
      if (conversaciones[from].length > 10) {
        conversaciones[from] = conversaciones[from].slice(-10);
      }

      const respuesta = await preguntarGroq(from, conversaciones[from]);

      // Agregar respuesta al historial
      conversaciones[from].push({ role: 'assistant', content: respuesta.texto });

      await sendMessage(from, respuesta.texto);

      if (respuesta.tieneLeads) {
        await notificarLead(from, conversaciones[from]);
      }
    }
  }
  res.sendStatus(200);
});

async function preguntarGroq(from, historial) {
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
- Remito Digital (remito-digital.com) - remitos electrónicos conforme a ARCA/AFIP
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
- Conectás tecnología con operación
- Sin frases genéricas ni teoría vacía

REGLAS IMPORTANTES:
- Respondé siempre en español
- Si la consulta requiere presupuesto o seguimiento comercial, pedí SOLO UNA VEZ: nombre, empresa y email. No vuelvas a pedirlos si ya los dio.
- Si el cliente ya dio sus datos de contacto en mensajes anteriores, NO los vuelvas a pedir. En cambio agregá al final: [LEAD_DETECTADO]
- Si detectás un email en cualquier mensaje del historial, agregá al final: [LEAD_DETECTADO]
- Nunca inventes precios ni compromisos comerciales
- Si la consulta es muy técnica o compleja, decí que un especialista se va a contactar`
          },
          ...historial
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

async function notificarLead(from, historial) {
  const resumen = historial
    .map(m => (m.role === 'user' ? 'Cliente: ' : 'VALBA: ') + m.content)
    .join('\n');

  const notificacion = '🔔 Nuevo lead - VALBA\n' +
    'Numero: +' + from + '\n\n' +
    resumen.substring(0, 800);

  await sendMessage(process.env.NOTIFY_NUMBER, notificacion);
  console.log('Lead notificado');
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