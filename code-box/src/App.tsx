import Layout from '@/components/Layout';
import FileTree from '@/components/FileTree';
import Tabs from '@/components/Tabs';
import Editor from '@/components/Editor';
import Console from '@/components/Console';
import TopBar from '@/components/TopBar';

function App() {
  return (
    <Layout
      topBar={<TopBar />}
      fileTree={<FileTree />}
      tabs={<Tabs />}
      editor={<Editor />}
      console={<Console />}
    />
  );
}

export default App;