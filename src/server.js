import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import ngrok from "ngrok";
import { TELEGRAM_API } from "./config.js";
import { handleMessage, getMenuMessage } from "./bot.js";
import { createTask, getTasks } from "./todoist.js";

// Configuración de la aplicación
const app = express();
const PORT = process.env.PORT || 3000;
const userStates = {};

// Middlewares
app.use(bodyParser.json());

// Funciones auxiliares para Telegram
async function sendMessage(chatId, textOrPayload) {
  const payload = typeof textOrPayload === "string"
    ? { chat_id: chatId, text: textOrPayload }
    : { chat_id: chatId, ...textOrPayload };

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function answerCallback(callback_query_id) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id }),
  });
}

// Manejadores de eventos
async function handleCallbackQuery(callback_query, res) {
  const chatId = callback_query.message.chat.id;
  const data = callback_query.data;

  switch (data) {
    case "crear_tarea":
      userStates[chatId] = "waiting_for_task";
      await sendMessage(chatId, "📝 Por favor, proporciona el contenido de la tarea.");
      break;
    case "ver_tareas":
      try {
        const tasks = await getTasks(); // Obtén las tareas

        if (!Array.isArray(tasks)) {
          console.error("Error: tasks no es un arreglo", tasks);
          await sendMessage(chatId, "❌ Error inesperado al obtener las tareas.");
          return;
        }

        if (tasks.length === 0) {
          await sendMessage(chatId, "🎉 No tienes tareas pendientes.");
        } else {
          const taskList = tasks.map((t, i) => `🔹 ${i + 1}. ${t.content}`).join("\n");
          await sendMessage(chatId, `📋 Tus tareas:\n\n${taskList}`);
        }
      } catch (error) {
        console.error("Error al manejar las tareas:", error);
        await sendMessage(chatId, "❌ No se pudieron obtener las tareas. " + error.message);
      }
      break;
    default:
      await sendMessage(chatId, "❌ Opción no válida.");
  }

  await answerCallback(callback_query.id);
  return res.sendStatus(200);
}

async function handleTaskCreation(chatId, taskContent, res) {
  try {
    await createTask(taskContent);
    await sendMessage(chatId, `✅ Tarea "${taskContent}" añadida correctamente.`);
  } catch (error) {
    await sendMessage(chatId, `❌ Error al añadir la tarea.`);
  }

  userStates[chatId] = null; // Limpiar estado
  await sendMessage(chatId, getMenuMessage());
  return res.sendStatus(200);
}

async function handleRegularMessage(message, res) {
  const chatId = message.chat.id;
  const reply = await handleMessage(message);
  const payload = {
    chat_id: chatId,
    ...(typeof reply === "string" ? { text: reply } : reply),
  };

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.sendStatus(200);
}

// Endpoint principal para webhook
app.post("/webhook", async (req, res) => {
  const { message, callback_query } = req.body;

  // Verificar si hay un mensaje o un callback_query de notion
  if (req.headers["notion-verification-token"]){
    const token = req.headers["notion-verification-token"];
    console.log("Webhook de Notion recibido:", req.body);
    console.log("Token de verificación de Notion:", token);
    return res.sendStatus(200).send(token); // Responder a Notion
  }


  // Manejar callbacks de botones
  if (callback_query) {
    return handleCallbackQuery(callback_query, res);
  }

  // Manejar mensajes de texto
  if (message) {
    const chatId = message.chat.id;
    const state = userStates[chatId];

    // Si está esperando una tarea
    if (state === "waiting_for_task") {
      return handleTaskCreation(chatId, message.text, res);
    }

    // Manejar otros mensajes
    return handleRegularMessage(message, res);
  }

  res.sendStatus(200);
});

// Inicialización del servidor
async function initServer() {
  app.listen(PORT, async () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);

    const url = await ngrok.connect(PORT);
    console.log(`🔗 Ngrok tunnel abierto en: ${url}`);

    const webhookUrl = `${url}/webhook`;
    const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const data = await response.json();
    console.log(`📬 Respuesta del webhook: ${data.description}`);
  });
}

// Iniciar el servidor
initServer().catch(err => console.error("Error al iniciar el servidor:", err));