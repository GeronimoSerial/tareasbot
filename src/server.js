import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import ngrok from "ngrok";
import { TELEGRAM_API } from "./config.js";
import { handleMessage, getMenuMessage } from "./bot.js";
import { createTask, getAllTasks, getTodayTasks } from "./todoist.js";

// Estados de usuario
const USER_STATES = {
  WAITING_FOR_TASK: "waiting_for_task",
};

// Callback data
const CALLBACK_ACTIONS = {
  CREATE_TASK: "crear_tarea",
  VIEW_TASKS: "ver_tareas",
  TODAY_TASKS: "ver_tareas_hoy",
};

const lastBotMessage = {};
/**
 * Clase principal para gestión del servidor y comunicación con Telegram
 */
class TelegramBotServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.userStates = {};

    this.initializeMiddlewares();
    this.initializeRoutes();
  }

  /**
   * Configura los middlewares de Express
   */
  initializeMiddlewares() {
    this.app.use(bodyParser.json());
  }

  /**
   * Configura las rutas de la API
   */

  checkId(chatId) {
    try {
      const validIds = [7657527810]; // Reemplaza con tus IDs válidos

      if (validIds.includes(chatId)) {
        return true;
      }
      return false;
    } catch (error) {}
  }

  initializeRoutes() {
    this.app.post("/webhook", this.handleWebhook.bind(this));
  }

  /**
   * Maneja las solicitudes al webhook
   */
  async handleWebhook(req, res) {
    const { message, callback_query } = req.body;

    try {
      if (callback_query) {
        await this.handleCallbackQuery(callback_query, res);
        return;
      }

      if (message) {
        const chatId = message.chat.id;
        const state = this.userStates[chatId];

        if (!this.checkId(chatId)) {
          console.log("ID no permitido:", chatId);
          message.text = "Este bot es solo para uso privado.";
          // await this.sendMessage(chatId, message.text);
          return res.sendStatus(403); // Forbidden
        }

        if (state === USER_STATES.WAITING_FOR_TASK) {
          await this.handleTaskCreation(chatId, message.text, res);
          return;
        }

        await this.handleRegularMessage(message, res);
        return;
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("Error en webhook:", error);
      res.status(500).send("Error interno del servidor");
    }
  }

  /**
   * Envía un mensaje a un chat de Telegram
   */
  async sendMessage(chatId, textOrPayload) {
    try {
      const payload =
        typeof textOrPayload === "string"
          ? { chat_id: chatId, text: textOrPayload }
          : { chat_id: chatId, ...textOrPayload };

      const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error enviando mensaje: ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.log("Error enviando mensaje:", error);
    }
  }

  async deleteMessage(chatId, message) {
    const messageId =
      typeof message === "object" ? message.message_id : message;
    const response = await fetch(`${TELEGRAM_API}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error eliminando mensaje: ${errorText}`);
    }
    return response.json();
  }
  /**
   * Responde a una consulta de callback
   */
  async answerCallback(callback_query_id) {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id }),
    });
  }

  /**
   * Maneja las consultas de los botones inline
   */
  async handleCallbackQuery(callback_query, res) {
    const chatId = callback_query.message.chat.id;
    const data = callback_query.data;
    console.log(chatId);

    switch (data) {
      case CALLBACK_ACTIONS.CREATE_TASK:
        this.userStates[chatId] = USER_STATES.WAITING_FOR_TASK;
        await this.sendMessage(
          chatId,
          "📝 Por favor, proporciona el contenido de la tarea."
        );
        break;

      case CALLBACK_ACTIONS.VIEW_TASKS:
        await this.displayTasks(chatId);
        break;

      case CALLBACK_ACTIONS.TODAY_TASKS:
        await this.handleTodayTasks(chatId);
        break;

      default:
        await this.sendMessage(chatId, "❌ Opción no válida.");
    }

    await this.answerCallback(callback_query.id);
    res.sendStatus(200);
  }

  /**
   * Muestra las tareas al usuario
   */
  async displayTasks(chatId) {
    try {
      const tasks = await getAllTasks();
      console.log("Tareas obtenidas:", tasks);

      if (!tasks || tasks.length === 0) {
        await this.sendMessage(chatId, "🎉 No tienes tareas pendientes.");
        return;
      }

      const taskList = tasks
        .map((t, i) => `🔹 ${i + 1}. ${t.content}`)
        .join("\n");

      await this.sendMessage(chatId, `📋 Tus tareas:\n\n${taskList}`);
    } catch (error) {
      console.error("Error al obtener tareas:", error);
      await this.sendMessage(
        chatId,
        "❌ No se pudieron obtener las tareas: " +
          (error.message || "Error desconocido")
      );
    }
  }

  //CCDIGO A REUTILIZAR ->>>>>>>>>

  async handleTodayTasks(chatId) {
    try {
      const tasks = await getTodayTasks();

      if (!tasks || tasks.length === 0) {
        await this.sendMessage(chatId, "🎉 No tienes tareas para hoy.");
        return;
      }

      const taskList = tasks
        .map((t, i) => `🔹 ${i + 1}. ${t.content}`)
        .join("\n");

      await this.sendMessage(chatId, `📋 Tus tareas para hoy:\n\n${taskList}`);
    } catch (error) {
      console.error("Error al obtener tareas:", error);
      await this.sendMessage(
        chatId,
        "❌ No se pudieron obtener las tareas: " +
          (error.message || "Error desconocido")
      );
    }
  }

  /**
   * Maneja la creación de tareas
   */
  async handleTaskCreation(chatId, taskContent, res) {
    try {
      await createTask(taskContent);
      await this.sendMessage(
        chatId,
        `✅ Tarea "${taskContent}" añadida correctamente.`
      );
    } catch (error) {
      console.error("Error creando tarea:", error);
      await this.sendMessage(
        chatId,
        `❌ Error al añadir la tarea: ${error.message || "Error desconocido"}`
      );
    }

    this.userStates[chatId] = null;
    await this.sendMessage(chatId, getMenuMessage());
    res.sendStatus(200);
  }

  /**
   * Maneja mensajes regulares
   */
  async handleRegularMessage(message, res) {
    try {
      const chatId = message.chat.id;
      const lastMessageId = lastBotMessage[chatId];
      if (lastMessageId) {
        try {
          await this.deleteMessage(chatId, { message_id: lastMessageId });
        } catch (error) {
          console.error("Error eliminando mensaje:", error);
        }
      }
      const reply = await handleMessage(message);

      const sent = await this.sendMessage(chatId, reply);
      console.log("Mensaje enviado:", sent);
      res.sendStatus(200);
    } catch (error) {
      console.error("Error manejando mensaje:", error);
      res.status(500).send("Error procesando mensaje");
    }
  }

  /**
   * Inicia el servidor
   */
  async start() {
    this.server = this.app.listen(this.port, async () => {
      console.log(`🚀 Servidor escuchando en http://localhost:${this.port}`);

      try {
        const url = await ngrok.connect(this.port);
        console.log(`🔗 Ngrok tunnel abierto en: ${url}`);

        const webhookUrl = `${url}/webhook`;
        await this.setupWebhook(webhookUrl);
      } catch (error) {
        console.error("Error configurando ngrok o webhook:", error);
      }
    });
  }

  /**
   * Configura el webhook de Telegram
   */
  async setupWebhook(webhookUrl) {
    const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`📬 Webhook configurado correctamente: ${data.description}`);
    } else {
      console.error(`❌ Error configurando webhook: ${data.description}`);
    }
  }
}

// Iniciar el servidor
const server = new TelegramBotServer();
server
  .start()
  .catch((err) => console.error("Error al iniciar el servidor:", err));
