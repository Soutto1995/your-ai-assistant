import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import Index from "./pages/Index";
import InboxPage from "./pages/InboxPage";
import TasksPage from "./pages/TasksPage";
import FinancesPage from "./pages/FinancesPage";
import MeetingsPage from "./pages/MeetingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import MemoryPage from "./pages/MemoryPage";
import PlansPage from "./pages/PlansPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PricingPage from "./pages/PricingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
            <Route path="/tarefas" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
            <Route path="/financas" element={<ProtectedRoute><FinancesPage /></ProtectedRoute>} />
            <Route path="/reunioes" element={<ProtectedRoute><MeetingsPage /></ProtectedRoute>} />
            <Route path="/projetos" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
            <Route path="/memoria" element={<ProtectedRoute><MemoryPage /></ProtectedRoute>} />
            <Route path="/planos" element={<ProtectedRoute><PlansPage /></ProtectedRoute>} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
