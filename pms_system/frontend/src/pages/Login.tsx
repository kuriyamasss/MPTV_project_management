import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import api from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', values.username);
      formData.append('password', values.password);

      const tokenRes = await api.post('/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const token = tokenRes.data.access_token;
      const userRes = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      login(token, userRes.data);
      message.success('ç™»å½•æˆåŠŸ');
      navigate('/');
      
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.detail || 'ç™»å½•å¤±è´¥ï¼Œè¯·æ£€æŸ¥ç”¨æˆ·åæˆ–å¯†ç ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 350, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>MPTV é¡¹ç›®ç®¡ç†ç³»ç»Ÿ</Title>
        </div>
        <Form name="login" onFinish={onFinish}>
          <Form.Item name="username" rules={[{ required: true, message: 'è¯·è¾“å…¥ç”¨æˆ·å!' }]}>
            <Input prefix={<UserOutlined />} placeholder="ç”¨æˆ·å" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'è¯·è¾“å…¥å¯†ç !' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="å¯†ç " size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              ç™»å½•
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
             <Button type="link" onClick={() => message.info('æ³¨å†ŒåŠŸèƒ½è¯·è”ç³»ç®¡ç†å‘˜')}>è¿˜æ²¡æœ‰è´¦å·ï¼Ÿ</Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};
export default Login;
