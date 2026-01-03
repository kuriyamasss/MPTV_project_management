import React from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Project } from '../types';
import TaskCard from './TaskCard';
import api from '../lib/api';
import { message } from 'antd';

interface KanbanBoardProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  onTaskMove?: (taskId: string, targetColId: string) => void; // Optional for generic use
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ project, setProject }) => {
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newProject = { ...project };
    const sourceColIndex = newProject.columns.findIndex(c => c.id.toString() === source.droppableId);
    const destColIndex = newProject.columns.findIndex(c => c.id.toString() === destination.droppableId);
    
    const sourceCol = newProject.columns[sourceColIndex];
    const destCol = newProject.columns[destColIndex];
    const sourceTasks = [...sourceCol.tasks];
    const destTasks = source.droppableId === destination.droppableId ? sourceTasks : [...destCol.tasks];

    const [movedTask] = sourceTasks.splice(source.index, 1);
    destTasks.splice(destination.index, 0, movedTask);

    newProject.columns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
    if (source.droppableId !== destination.droppableId) {
       newProject.columns[destColIndex] = { ...destCol, tasks: destTasks };
       movedTask.column_id = parseInt(destination.droppableId);
    }
    setProject(newProject);

    try {
      await api.put(`/projects/tasks/${draggableId}`, {
        column_id: parseInt(destination.droppableId),
      });
    } catch (error) {
      message.error('ç§»åŠ¨ä»»åŠ¡å¤±è´¥');
      console.error(error);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, height: '100%' }}>
        {project.columns.map((column) => (
          <div key={column.id} style={{ minWidth: 280, width: 280, display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#f4f5f7', padding: '10px 12px', borderRadius: '8px 8px 0 0', fontWeight: 600, borderBottom: '2px solid #e0e0e0' }}>
              {column.name} <span style={{color: '#888', fontWeight: 400}}>({column.tasks.length})</span>
            </div>
            <Droppable droppableId={column.id.toString()}>
              {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef} style={{ background: snapshot.isDraggingOver ? '#e6f7ff' : '#f4f5f7', padding: 8, flexGrow: 1, minHeight: 100, borderRadius: '0 0 8px 8px' }}>
                  {column.tasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} index={index} />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
};
export default KanbanBoard;
