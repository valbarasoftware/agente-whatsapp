# Agente WhatsApp Business

Webhook en Node.js + Express para recibir y responder mensajes de WhatsApp via Meta Cloud API.

## Setup local

1. Instalar dependencias:
```
npm install
```

2. Crear archivo `.env` basándote en `.env.example`:
```
cp .env.example .env
```

3. Completar `.env` con tus datos reales de Meta Developers.

4. Correr el servidor:
```
npm start
```

## Deploy en Render.com

1. Subir este proyecto a GitHub
2. Crear nuevo Web Service en Render
3. Conectar el repo de GitHub
4. Agregar las variables de entorno (.env) en el panel de Render
5. Deploy automático

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VERIFY_TOKEN` | Token secreto que vos inventás para verificar el webhook |
| `WHATSAPP_TOKEN` | Token de acceso de Meta Developers |
| `PHONE_NUMBER_ID` | ID del número de teléfono en Meta |

## Endpoints

- `GET /webhook` — Verificación del webhook (Meta)
- `POST /webhook` — Recibe mensajes entrantes
