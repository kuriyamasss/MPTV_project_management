import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout, Button, Spin, Breadcrumb, message, Modal, Form, Input, Select, DatePicker, Segmented } from "antd";
import { ArrowLeftOutlined, PlusOutlined, AppstoreOutlined, BarsOutlined, TableOutlined } from "@ant-design/icons";
import api from "../lib/api";
import { Project } from "../types";
import KanbanBoard from "../components/KanbanBoard";
import GanttView from "../components/GanttView";
import TableView from "../components/TableView";

const { Content, Header } = Layout;
const { Option } = Select;

const ProjectBoard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "gantt" | "table">("kanban");
  const [form] = Form.useForm();

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (error) {
      message.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProject(); }, [id]);

  const handleCreateTask = async (values: any) => {
    if (!project) return;
    try {
      const firstColumnId = project.columns[0].id;
      await api.post(`/projects/${project.id}/tasks/`, {
        ...values,
        column_id: firstColumnId,
        start_date: values.start_date ? values.start_date.toISOString() : null,
        end_date: values.end_date ? values.end_date.toISOString() : null,
      });
      message.success("Task created");
      setIsModalOpen(false);
      form.resetFields();
      fetchProject();
    } catch (error) {
      message.error("Failed to create task");
    }
  };

  if (loading) return <div style={{textAlign: "center", marginTop: 50}}><Spin size="large" /></div>;
  if (!project) return <div>Project not found</div>;

  return (
    <Layout style={{ height: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/")} />
          <Breadcrumb items={[{ title: "Dashboard" }, { title: project.name }]} />
        </div>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          <Segmented
            options={[
              { label: "Kanban", value: "kanban", icon: <AppstoreOutlined /> },
              { label: "Gantt", value: "gantt", icon: <BarsOutlined /> },
              { label: "Table", value: "table", icon: <TableOutlined /> },
            ]}
            value={viewMode}
            onChange={(value) => setViewMode(value as any)}
          />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          New Task
        </Button>
      </Header>
      <Content style={{ padding: "24px", overflow: "hidden" }}>
        {viewMode === "kanban" && <KanbanBoard project={project} setProject={setProject} />}
        {viewMode === "gantt" && <GanttView project={project} setProject={setProject} />}
        {viewMode === "table" && <TableView project={project} setProject={setProject} />}
      </Content>
      <Modal title="New Task" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={form.submit}>
        <Form form={form} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue="medium">
            <Select>
              <Option value="high">High</Option>
              <Option value="medium">Medium</Option>
              <Option value="low">Low</Option>
            </Select>
          </Form.Item>
          <Form.Item name="start_date" label="Plan Start">
             <DatePicker showTime style={{width: "100%"}} />
          </Form.Item>
          <Form.Item name="end_date" label="Plan End">
             <DatePicker showTime style={{width: "100%"}} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};
export default ProjectBoard;