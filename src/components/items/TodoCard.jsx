import { uid } from '../../utils/id';
import { CaretUp, CaretDown, X, Plus } from '../icons.jsx';

export default function TodoCard({ item, dispatch }) {
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });
  const tasks = item.tasks || [];

  const setTasks = (next) => update({ tasks: next });

  const addTask = () => setTasks([...tasks, { id: uid('task'), text: '', done: false }]);
  const editTask = (id, text) => setTasks(tasks.map((t) => (t.id === id ? { ...t, text } : t)));
  const toggleTask = (id) => setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const removeTask = (id) => setTasks(tasks.filter((t) => t.id !== id));

  const moveTask = (index, dir) => {
    const next = [...tasks];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setTasks(next);
  };

  return (
    <div className="todo-card">
      <div className="todo-list">
        {tasks.map((task, i) => (
          <div className="todo-row" key={task.id}>
            <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
            <input
              className="todo-text"
              value={task.text}
              placeholder="To-do item"
              style={{ textDecoration: task.done ? 'line-through' : 'none' }}
              onChange={(e) => editTask(task.id, e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button onClick={() => moveTask(i, -1)} title="Move up"><CaretUp size={12} weight="bold" /></button>
            <button onClick={() => moveTask(i, 1)} title="Move down"><CaretDown size={12} weight="bold" /></button>
            <button onClick={() => removeTask(task.id)} title="Remove"><X size={12} weight="bold" /></button>
          </div>
        ))}
      </div>
      <button className="todo-add" onClick={addTask}><Plus size={12} weight="bold" /> Add task</button>
    </div>
  );
}
