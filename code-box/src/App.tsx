import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { initializeEmptyState } from '@/store/fileSlice';
import Layout from '@/components/Layout';
import FileTree from '@/components/FileTree';
import Tabs from '@/components/Tabs';
import Editor from '@/components/Editor';
import Console from '@/components/Console';
import TopBar from '@/components/TopBar';

function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(initializeEmptyState());
  }, [dispatch]);

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