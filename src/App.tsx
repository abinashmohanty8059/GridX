import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GridProvider } from "./context/GridContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppModeProvider, useAppMode } from "./context/AppModeContext";
import Sidebar from "./components/Sidebar";
import ModeSelect from "./pages/ModeSelect";
import DataEngineeringApp from "./de/DataEngineeringApp";

// Pages
import Dashboard from "./pages/Dashboard";
import AlertsConsole from "./pages/AlertsConsole";
import ValidationCenter from "./pages/ValidationCenter";
import IEC104Analysis from "./pages/IEC104Analysis";
import ExportCenter from "./pages/ExportCenter";
import ExcelViewer from "./pages/ExcelViewer";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import About from "./pages/About";
import ComparisonCenter from "./pages/ComparisonCenter";

import "./index.css";

function ScadaApp() {
  return (
    <GridProvider>
      <BrowserRouter>
        <div className="flex h-screen w-full bg-surface overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden relative">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/alerts" element={<AlertsConsole />} />
              <Route path="/validation" element={<ValidationCenter />} />
              <Route path="/comparison" element={<ComparisonCenter />} />
              <Route path="/iec104" element={<IEC104Analysis />} />
              <Route path="/excel" element={<ExcelViewer />} />
              <Route path="/export" element={<ExportCenter />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </GridProvider>
  );
}

function Workspace() {
  const { mode } = useAppMode();
  if (mode === 'scada') return <ScadaApp />;
  if (mode === 'de') return <DataEngineeringApp />;
  return <ModeSelect />;
}

function App() {
  return (
    <ThemeProvider>
      <AppModeProvider>
        <Workspace />
      </AppModeProvider>
    </ThemeProvider>
  );
}

export default App;