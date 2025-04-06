import { createTask } from "./todoist.js";

/**
 * Constantes para comandos
 */
const COMMANDS = {
  ADD: "/add",
  MENU: "/menu",
  TODAY: "/today",
  START: "/start",
};

/**
 * Maneja los mensajes entrantes del usuario
 * @param {Object} message - Mensaje recibido
 * @returns {string|Object} - Respuesta al mensaje
 */
export async function handleMessage(message) {
  const text = message.text;

  if (!text) return "No se proporcionó texto";

  if (text.startsWith(COMMANDS.ADD)) {
    return handleAddCommand(text);
  }
  
  if(text === COMMANDS.MENU) {
    return getMenuMessage();
  }

  if (text === COMMANDS.START) {
    return getMenuMessage();
  }
  
  
  return "Usa /add <tarea> para agregar una tarea o /menu para ver opciones.";
}

/**
 * Maneja el comando para agregar tareas
 * @param {string} text - Texto del comando
 * @returns {Promise<string>} - Resultado de la operación
 */
async function handleAddCommand(text) {
  const taskContent = text.replace(COMMANDS.ADD, "").trim();
  
  if (!taskContent) {
    return "Por favor, proporciona una tarea para agregar.";
  }

  try {
    await createTask(taskContent);
    return `¡Tarea "${taskContent}" agregada con éxito!`;
  } catch (error) {
    console.error("Error al agregar la tarea:", error);
    return error.message || "Error al agregar la tarea. Por favor, inténtalo de nuevo.";
  }
}

/**
 * Genera el mensaje del menú con botones interactivos
 * @returns {Object} - Objeto con texto y markup para botones
 */
export function getMenuMessage() {
  return {
    text: "¿Qué deseas hacer?",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📝 Crear tarea", callback_data: "crear_tarea" }],
        [{ text: "📋 Ver tareas", callback_data: "ver_tareas" }],
        [{ text: "📋 Ver tareas de hoy", callback_data: "ver_tareas_hoy" }],
      ],
    },
  };
}