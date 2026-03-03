import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import InboxPage from "./pages/InboxPage";
import TasksPage from "./pages/TasksPage";
import FinancesPage from "./pages/FinancesPage";
import MeetingsPage from "./pages/MeetingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import MemoryPage from "./pages/MemoryPage";
import PlansPage from "./pages/PlansPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/tarefas" element={<TasksPage />} />
          <Route path="/financas" element={<FinancesPage />} />
          <Route path="/reunioes" element={<MeetingsPage />} />
          <Route path="/projetos" element={<ProjectsPage />} />
          <Route path="/memoria" element={<MemoryPage />} />
          <Route path="/planos" element={<PlansPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
