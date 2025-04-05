import { TodoistApi } from '@doist/todoist-api-typescript';
import { TODOIST_API } from './config.js';

const api = new TodoistApi(TODOIST_API);
export async function createTask(content, dueString = null) {
    try {
        const task = await api.addTask({
            content: content,
            due_string: dueString || 'today',
            priority: 4
        });
        console.log('Task created:', task);
        return task;
    }
    catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
    
}

export async function getTasks() {
    try {
        const response = await api.getTasks();

        // Si el resultado tiene una propiedad "results", devuelve esa propiedad
        const tasks = response.results || [];
        console.log('Tasks retrieved:', tasks); // Verifica que sea un arreglo
        return tasks;
    } catch (error) {
        console.error('Error retrieving tasks:', error);
        return []; // Devuelve un arreglo vacío en caso de error
    }
}






















// import fetch from 'node-fetch';
// import { TODOIST_API } from './config.js';

// export async function createTask(content){
//     try {
//     const response = await fetch('https://api.todoist.com/rest/v2/tasks', {
//         method: 'POST',
//         headers: {
//             'Authorization': `Bearer ${TODOIST_API}`,
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//             content: content,
//             due_string: 'today',
//             priority: 4
//         })
//     });
//     if (!response.ok) {
//         const errorText = await response.text();
//         console.error('Error creating task:', errorText);
//         throw new Error(errorText);

//     }

//     const data = await response.json();
//     console.log('Task created:', data);
//     return data;
//     }
//     catch (error) {
//         console.error('Error creating task:', error);
//         throw error;
//     }

// }