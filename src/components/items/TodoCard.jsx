import { useEffect, useRef, useState } from 'react';
import { uid } from '../../utils/id';
import { X, Plus } from '../icons.jsx';

export default function TodoCard({ item, dispatch }) {
  const update = (patch) => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch });
  const tasks = item.tasks || [];
  const inputRefs = useRef({});
  const [focusId, setFocusId] = useState(null);

  // focus follows the row that was just created or the one left behind after a delete
  useEffect(() => {
    if (!focusId) return;
    inputRefs.current[focusId]?.focus();
    setFocusId(null);
  }, [focusId]);

  const setTasks = (next) => update({ tasks: next });

  const editTask = (id, text) => setTasks(tasks.map((t) => (t.id === id ? { ...t, text } : t)));
  const toggleTask = (id) => setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const addTaskAfter = (index) => {
    const task = { id: uid('task'), text: '', done: false };
    const next = [...tasks];
    next.splice(index + 1, 0, task);
    setTasks(next);
    setFocusId(task.id);
  };

  const removeTask = (id, index) => {
    setTasks(tasks.filter((t) => t.id !== id));
    const prev = tasks[index - 1];
    if (prev) setFocusId(prev.id);
  };

  const moveTask = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= tasks.length) return;
    const next = [...tasks];
    [next[index], next[target]] = [next[target], next[index]];
    setTasks(next);
  };

  const onKeyDown = (e, task, index) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveTask(index, e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addTaskAfter(index);
    } else if (e.key === 'Backspace' && !task.text && tasks.length > 1) {
      e.preventDefault();
      removeTask(task.id, index);
    } else if (e.key === 'ArrowUp' && tasks[index - 1]) {
      e.preventDefault();
      inputRefs.current[tasks[index - 1].id]?.focus();
    } else if (e.key === 'ArrowDown' && tasks[index + 1]) {
      e.preventDefault();
      inputRefs.current[tasks[index + 1].id]?.focus();
    }
  };

  return (
    <div className="todo-card">
      <div className="todo-list">
        {tasks.map((task, i) => (
          <div className="todo-row" key={task.id}>
            <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
            <input
              className="todo-text"
              ref={(el) => {
                inputRefs.current[task.id] = el;
              }}
              value={task.text}
              placeholder="Write a task, press Enter for the next one"
              style={{ textDecoration: task.done ? 'line-through' : 'none' }}
              onChange={(e) => editTask(task.id, e.target.value)}
              onKeyDown={(e) => onKeyDown(e, task, i)}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button className="todo-remove" onClick={() => removeTask(task.id, i)} title="Remove">
              <X size={12} weight="bold" />
            </button>
          </div>
        ))}
      </div>
      {!tasks.length && (
        <button className="todo-add" onClick={() => addTaskAfter(-1)}>
          <Plus size={12} weight="bold" /> Add task
        </button>
      )}
    </div>
  );
}
