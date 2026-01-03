import React from 'react';
import { Card, Tag, Typography, Avatar, Tooltip } from 'antd';
import { Draggable } from '@hello-pangea/dnd';
import { Task } from '../types';
import { UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface TaskCardProps {
  task: Task;
  index: number;
}

const getPriorityColor = (p: string) => {
  switch (p) {
    case 'high': return 'red';
    case 'medium': return 'orange';
    case 'low': return 'green';
    default: return 'blue';
  }
};

const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            marginBottom: 8,
            ...provided.draggableProps.style,
          }}
        >
          <Card 
            size="small" 
            hoverable
            style={{ 
              boxShadow: snapshot.isDragging ? '0 5px 10px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.1)',
              background: snapshot.isDragging ? '#e6f7ff' : '#fff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Tag color={getPriorityColor(task.priority)} style={{ marginRight: 0 }}>
                {task.priority}
              </Tag>
              {task.end_date && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined /> {dayjs(task.end_date).format('MM-DD')}
                </Text>
              )}
            </div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {task.title}
            </Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>ID: #{task.id}</Text>
              <Avatar.Group size="small" maxCount={2}>
                 <Tooltip title="Assigned User"><Avatar icon={<UserOutlined />} /></Tooltip>
              </Avatar.Group>
            </div>
          </Card>
        </div>
      )}
    </Draggable>
  );
};
export default TaskCard;
