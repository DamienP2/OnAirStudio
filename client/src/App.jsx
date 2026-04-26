import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Display from './pages/Display';
import { DialogProvider } from './components/Dialog';

export default function App() {
  return (
    <DialogProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/control" replace />} />
          <Route path="/display" element={<Display />} />
          <Route path="/control"   element={<Dashboard activeTab="control" />} />
          <Route path="/design"    element={<Dashboard activeTab="design" />} />
          <Route path="/calendars" element={<Dashboard activeTab="calendars" />} />
          <Route path="/settings"  element={<Dashboard activeTab="settings" />} />
          <Route path="/help"      element={<Dashboard activeTab="help" />} />
        </Routes>
      </BrowserRouter>
    </DialogProvider>
  );
}
