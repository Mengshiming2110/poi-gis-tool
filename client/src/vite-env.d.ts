/// <reference types="vite/client" />

interface Window {
  AMap: any;
  _AMapSecurityConfig: {
    securityJsCode: string;
  };
  electronAPI?: {
    saveAndOpenInstaller: (bufferBase64: string, filename: string) => Promise<{ success: boolean; path: string }>;
  };
}
