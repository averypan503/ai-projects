interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  isSameEntry(other: FileSystemHandle): boolean;
  queryPermission(options?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(options?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
  writeFile(data: Blob): Promise<void>;
  rename(name: string): Promise<void>;
  getParent(): Promise<FileSystemDirectoryHandle | null>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  rename(name: string): Promise<void>;
  getParent(): Promise<FileSystemDirectoryHandle | null>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemHandlePermissionDescriptor {
  mode: 'read' | 'readwrite';
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemGetFileOptions {
  create?: boolean;
}

interface FileSystemGetDirectoryOptions {
  create?: boolean;
}

interface FileSystemRemoveOptions {
  recursive?: boolean;
}

interface Window {
  showDirectoryPicker(options?: FileSystemDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker(options?: FileSystemOpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: FileSystemSaveFilePickerOptions): Promise<FileSystemFileHandle>;
}

interface FileSystemDirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | string;
  id?: string;
}

interface FileSystemOpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  startIn?: FileSystemHandle | string;
  id?: string;
}

interface FileSystemSaveFilePickerOptions {
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  startIn?: FileSystemHandle | string;
  suggestedName?: string;
  id?: string;
}

interface FilePickerAcceptType {
  description: string;
  accept: Record<string, string[]>;
}

declare global {
  type FileSystemHandleKind = 'file' | 'directory';
}