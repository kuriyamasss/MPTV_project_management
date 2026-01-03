import React, { useEffect, useState } from "react";
import { Layout, Card, Button, Row, Col, Typography, Modal, Form, Input, message, Empty, Segmented } from "antd";
import { PlusOutlined, ProjectOutlined, LogoutOutlined, AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { Project } from "../types";

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [form] = Form.useForm();

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects/");
      setProjects(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreateProject = async (values: any) => {
    try {
      await api.post("/projects/", values);
      message.success("Project created");
      setIsModalOpen(false);
      form.resetFields();
      fetchProjects();
    } catch (error) {
      message.error("Failed to create project");
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px #f0f1f2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ProjectOutlined style={{ fontSize: 24, color: "#1890ff" }} />
          <Title level={4} style={{ margin: 0 }}>PMS Console</Title>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>Welcome, {user?.username}</span>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} danger type="text">Exit</Button>
        </div>
      </Header>
      <Content style={{ padding: "24px 50px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 24 }}>
          <div>
            <Title level={3}>My Projects</Title>
            <Segmented options={[{ label: "Grid", value: "grid", icon: <AppstoreOutlined /> }, { label: "List", value: "list", icon: <BarsOutlined /> }]} value={viewMode} onChange={(v) => setViewMode(v as any)} />
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>New Project</Button>
        </div>
        {projects.length === 0 ? <Empty description="No projects found" /> : (
          viewMode === "grid" ? (
            <Row gutter={[16, 16]}>
              {projects.map(project => (
                <Col xs={24} sm={12} md={8} lg={6} key={project.id}>
                  <Card hoverable title={project.name} extra={<Button type="link" size="small" onClick={() => navigate(`/project/${project.id}`)}>Enter</Button>} onClick={() => navigate(`/project/${project.id}`)}>
                    <Paragraph ellipsis={{ rows: 2 }}>{project.description || "No description"}</Paragraph>
                    <div style={{ marginTop: 12, color: "#888", fontSize: 12 }}>Created: {new Date(project.created_at).toLocaleDateString()}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #f0f0f0" }}>
               {projects.map(project => (
                 <div key={project.id} onClick={() => navigate(`/project/${project.id}`)} style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} className="hover:bg-gray-50">
                    <div><div style={{ fontWeight: "bold", fontSize: 16 }}>{project.name}</div><div style={{ color: "#666", fontSize: 14 }}>{project.description || "No description"}</div></div>
                    <div style={{ color: "#999", fontSize: 12 }}>Created: {new Date(project.created_at).toLocaleDateString()}</div>
                 </div>
               ))}
            </div>
          )
        )}
      </Content>
      <Modal title="Create Project" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={form.submit}>
        <Form form={form} layout="vertical" onFinish={handleCreateProject}>
          <Form.Item name="name" label="Project Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};
export default Dashboard;