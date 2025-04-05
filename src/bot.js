import { createTask } from "./todoist.js";

export async function handleMessage(message) {
  const text = message.text;

  if (!text) return "No se proporcionó texto";

  if (text.startsWith("/add")) {
    const taskContent = text.replace("/add", "").trim();
    if (!taskContent) return "Por favor, proporciona una tarea para agregar.";

    try {
      await createTask(taskContent);
      return `¡Tarea "${taskContent}" agregada con éxito!`;
    } catch (error) {
      console.error("Error al agregar la tarea:", error);
      return error.message || "Error al agregar la tarea. Por favor, inténtalo de nuevo.";
    }
  }
  
  
  if(message.text === "/menu") {
    return getMenuMessage();
  }
  
  // return "Usa /add <tarea> para agregar una tarea a tu Todoist.";
}

export function getMenuMessage() {
  return {
    text: "¿Qué deseas hacer?",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📝 Crear tarea", callback_data: "crear_tarea" }],
        [{ text: "📋 Ver tareas", callback_data: "ver_tareas" }],
      ],
    },
  };
}