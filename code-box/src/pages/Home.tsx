import { Layout } from 'antd';

const { Header, Content, Footer } = Layout;

function Home() {
  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#1890ff', color: '#fff', padding: '0 24px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'normal' }}>CodeBox - 轻量化网页IDE</h1>
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '4px', minHeight: '400px' }}>
          <h2>项目骨架已搭建完成</h2>
          <p>欢迎使用 CodeBox！这是一个轻量化的仿 VSCode 网页 IDE。</p>
          <h3>项目目录结构：</h3>
          <ul>
            <li><strong>src/api</strong> - API 接口管理</li>
            <li><strong>src/components</strong> - 组件目录（FileTree, Tabs, Editor, Console, Layout）</li>
            <li><strong>src/hooks</strong> - 自定义 Hooks</li>
            <li><strong>src/store</strong> - Redux Toolkit 状态管理</li>
            <li><strong>src/utils</strong> - 工具函数</li>
            <li><strong>src/pages</strong> - 页面组件</li>
            <li><strong>src/router</strong> - 路由配置</li>
            <li><strong>src/styles</strong> - 全局样式</li>
          </ul>
          <p style={{ marginTop: '24px', color: '#888' }}>现在可以开始编写业务代码了！</p>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center', color: '#888' }}>
        CodeBox ©2026 - 轻量化网页 IDE
      </Footer>
    </Layout>
  );
}

export default Home;