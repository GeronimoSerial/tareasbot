import { TodoistApi } from "@doist/todoist-api-typescript";
import { TODOIST_API } from "./config.js";

// Instancia de la API de Todoist
const api = new TodoistApi(TODOIST_API);


const PRIORITIES = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

function parseTaskInput(text) {
  const lower = text.toLowerCase().trim();

  const dateMatch = lower.match(/\bmañana\b/);

  if (dateMatch) {
    const index = dateMatch.index;
    const content = text.slice(0, index).trim();

    return {
      content: content || text,
      dueString: "tomorrow",
    };
  }

  return {
    content: text,
    dueString: "today",
  };
}


function validateTaskParams(content, priority) {
  if (!content || content.trim() === "") {
    throw new Error("El contenido de la tarea no puede estar vacío");
  }

  if (priority < 1 || priority > 4) {
    throw new Error("La prioridad debe estar entre 1 y 4");
  }
}


export async function createTask(rawText, priority = PRIORITIES.URGENT) {
  try {
    const { content, dueString } = parseTaskInput(rawText);
    
    validateTaskParams(content, priority);
    
    const task = await api.addTask({
      content: content,
      due_string: dueString,
      priority: priority,
    });
    
    console.log("✅ Tarea creada:", task.content);
    return task;
  } catch (error) {
    console.error("❌ Error creando tarea:", error.message);
    throw new TaskError(`Error al crear la tarea: ${error.message}`);
  }
}

export async function getAllTasks() {
  try {
    const response = await api.getTasks();
    // Forma segura de manejar la respuesta
    const tasks = Array.isArray(response)
      ? response
      : response && response.results && Array.isArray(response.results)
      ? response.results
      : [];

    console.log(`📋 ${tasks.length} tareas recuperadas en total`);
    return tasks;
  } catch (error) {
    console.error("❌ Error recuperando tareas:", error.message);
    throw new TaskError(`Error al recuperar tareas: ${error.message}`);
  }
}

export async function getTodayTasks() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const allTasks = await getAllTasks();

    
    const todayTasks = allTasks.filter((allTasks) => {
      return (
        allTasks.due?.date === today
      );
    });
    console.log(`📋 ${todayTasks.length} tareas recuperadas para hoy`);
    // console.log(todayTasks)
    return todayTasks;
  } catch (error) {
    console.error("❌ Error recuperando tareas para hoy:", error.message);
    throw new TaskError(`Error al recuperar tareas para hoy: ${error.message}`);
  }
}

/**
 * Clase personalizada para errores de Todoist
 */
class TaskError extends Error {
  constructor(message) {
    super(message);
    this.name = "TaskError";
  }
}
