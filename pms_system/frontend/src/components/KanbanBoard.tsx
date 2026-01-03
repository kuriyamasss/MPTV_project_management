import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Project } from "../types";
import api from "../lib/api";
import { Clock, MoreHorizontal, User, Plus } from "lucide-react";

interface KanbanBoardProps { project: Project; setProject: any; }

const PriorityTag = ({ p }: { p: string }) => {
  const styles: any = { high: "bg-red-50 text-red-700 border-red-100", medium: "bg-orange-50 text-orange-700 border-orange-100", low: "bg-green-50 text-green-700 border-green-100" };
  return <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${styles[p] || styles.medium}`}>{p}</span>;
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ project, setProject }) => {
  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newProject = { ...project };
    const sColIdx = newProject.columns.findIndex(c => c.id.toString() === source.droppableId);
    const dColIdx = newProject.columns.findIndex(c => c.id.toString() === destination.droppableId);
    const sCol = newProject.columns[sColIdx];
    const dCol = newProject.columns[dColIdx];
    const sTasks = [...sCol.tasks];
    const dTasks = source.droppableId === destination.droppableId ? sTasks : [...dCol.tasks];

    const [moved] = sTasks.splice(source.index, 1);
    dTasks.splice(destination.index, 0, moved);

    newProject.columns[sColIdx] = { ...sCol, tasks: sTasks };
    if (source.droppableId !== destination.droppableId) {
       newProject.columns[dColIdx] = { ...dCol, tasks: dTasks };
       moved.column_id = parseInt(destination.droppableId);
    }
    setProject(newProject);
    try { await api.put(`/projects/tasks/${draggableId}`, { column_id: parseInt(destination.droppableId) }); } catch {}
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-6 h-full overflow-x-auto pb-4 items-start">
        {project.columns.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-80 flex flex-col bg-gray-100/50 rounded-xl border border-gray-200 max-h-full">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
              <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">{column.name}<span className="bg-white text-gray-500 border border-gray-200 text-xs px-2 py-0.5 rounded-full shadow-sm">{column.tasks.length}</span></h3>
              <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={16}/></button>
            </div>
            <Droppable droppableId={column.id.toString()}>
              {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className={`p-2 flex-1 overflow-y-auto min-h-[150px] space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-blue-50/50" : ""}`}>
                  {column.tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={provided.draggableProps.style}
                             className={`bg-white p-3 rounded-lg border shadow-sm group hover:shadow-md transition-all ${snapshot.isDragging ? "shadow-lg ring-2 ring-blue-500/20 rotate-1" : "border-gray-200"}`}>
                          <div className="flex justify-between items-start mb-2"><PriorityTag p={task.priority} /></div>
                          <h4 className="font-medium text-gray-800 text-sm mb-3 leading-snug">{task.title}</h4>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400"><Clock size={12} />{task.end_date ? new Date(task.end_date).toLocaleDateString() : "--"}</div>
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold"><User size={12}/></div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            <button className="m-2 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 rounded-lg transition-colors border border-dashed border-gray-300"><Plus size={14} /> Add Task</button>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
};
export default KanbanBoard;