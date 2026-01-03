import React, { useState } from "react";
import { Form, Input, Button, Card, message, Typography, Tabs } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import api from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (isRegister) {
        await api.post("/users/", {
          username: values.username,
          email: values.email,
          password: values.password
        });
        message.success("Registration successful! Please login.");
        setIsRegister(false);
        form.resetFields();
      } else {
        const formData = new URLSearchParams();
        formData.append("username", values.username);
        formData.append("password", values.password);

        const tokenRes = await api.post("/token", formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const token = tokenRes.data.access_token;
        const userRes = await api.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` }
        });

        login(token, userRes.data);
        message.success("Welcome back " + userRes.data.username);
        navigate("/");
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || "Action failed";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f0f2f5" }}>
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", borderRadius: 8 }} bodyStyle={{ padding: "40px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={3} style={{ color: "#1890ff", margin: 0 }}>MPTV System</Title>
          <div style={{ color: "#8c8c8c", marginTop: 8 }}>Project Management</div>
        </div>
        <Tabs activeKey={isRegister ? "register" : "login"} onChange={(key) => { setIsRegister(key === "register"); form.resetFields(); }} centered
          items={[ { label: "Login", key: "login" }, { label: "Register", key: "register" } ]} style={{ marginBottom: 24 }} />
        <Form form={form} name="auth" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: "Required" }]}>
            <Input prefix={<UserOutlined />} placeholder="Username" />
          </Form.Item>
          {isRegister && (
            <Form.Item name="email" rules={[{ required: true, message: "Required", type: "email" }]}>
              <Input prefix={<MailOutlined />} placeholder="Email" />
            </Form.Item>
          )}
          <Form.Item name="password" rules={[{ required: true, message: "Required" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {isRegister ? "Register" : "Login"}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
export default Login;