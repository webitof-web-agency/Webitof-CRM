import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { useEffect } from 'react';
import { ProtectedRoute } from './components/guards/ProtectedRoute';
import { PermissionRoute } from './components/guards/PermissionRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { RolesPage } from './pages/RolesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { FilesPage } from './pages/FilesPage';
import { FinancePage } from './pages/finance/FinancePage';
import { ExpenseDetailsPage } from './pages/expenses/ExpenseDetailsPage';
import { AmcDetailPage } from './pages/amc/AmcDetailPage';
import { BankingPage } from './pages/BankingPage';
import { MastersPage } from './pages/MastersPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResourcePage } from './pages/ResourcePage';
import { ProfilePage } from './pages/ProfilePage';
import { LeadsPage } from './pages/LeadsPage';
import { LeadDetailsPage, LeadQuotationPage } from './pages/leads/LeadDetailsPage';
import { schemaRegistry } from './config/resourceSchemas';

const resourceSchemas = [
  schemaRegistry.expenses,
  schemaRegistry.outsourcing,
  schemaRegistry['lead-commissions'],
  schemaRegistry.amc,
  schemaRegistry.renewals
].filter(Boolean);

import { ShowcasePage } from './components/Showcase';
import { ClientsListPage } from './pages/clients/ClientsListPage';
import { ClientDetailsPage } from './pages/clients/ClientDetailsPage';
import { ClientFormPage } from './pages/clients/ClientFormPage';
import { ProjectsListPage } from './pages/projects/ProjectsListPage';
import { ProjectDetailsPage } from './pages/projects/ProjectDetailsPage';
import { InvoicesListPage } from './pages/invoices/InvoicesListPage';
import { InvoiceBuilderPage } from './pages/invoices/InvoiceBuilderPage';
import { InvoiceExportPage } from './pages/invoices/InvoiceExportPage';
import { InvoiceDetailsPage } from './pages/invoices/InvoiceDetailsPage';
import { InvoicePublicPage } from './pages/invoices/InvoicePublicPage';
import { PaymentsListPage } from './pages/payments/PaymentsListPage';
import { PaymentBuilderPage } from './pages/payments/PaymentBuilderPage';
import { PaymentDetailPage } from './pages/payments/PaymentDetailPage';
import { AutomationPage } from './pages/AutomationPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { FollowUpsPage } from './pages/followups/FollowUpsPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <PermissionRoute permission="dashboard.view">
              <DashboardPage />
            </PermissionRoute>
          }
        />
        <Route
          path="leads"
          element={
            <PermissionRoute permission="leads.read">
              <LeadsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="leads/:id/quotations/new"
          element={
            <PermissionRoute permission="leads.read">
              <LeadQuotationPage />
            </PermissionRoute>
          }
        />
        <Route
          path="leads/:id/quotations/:quotationId"
          element={
            <PermissionRoute permission="leads.read">
              <LeadQuotationPage />
            </PermissionRoute>
          }
        />
        <Route
          path="leads/:id"
          element={
            <PermissionRoute permission="leads.read">
              <LeadDetailsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="clients"
          element={
            <PermissionRoute permission="clients.read">
              <ClientsListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="clients/new"
          element={
            <PermissionRoute permission="clients.write">
              <ClientFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="clients/:id/edit"
          element={
            <PermissionRoute permission="clients.write">
              <ClientFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="clients/:id"
          element={
            <PermissionRoute permission="clients.read">
              <ClientDetailsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="projects"
          element={
            <PermissionRoute permission="projects.read">
              <ProjectsListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="projects/:id"
          element={
            <PermissionRoute permission="projects.read">
              <ProjectDetailsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="invoices"
          element={
            <PermissionRoute permission="invoices.read">
              <InvoicesListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="invoices/new"
          element={
            <PermissionRoute permission="invoices.write">
              <InvoiceBuilderPage />
            </PermissionRoute>
          }
        />
        <Route
          path="invoices/export"
          element={
            <PermissionRoute permission="invoices.read">
              <InvoiceExportPage />
            </PermissionRoute>
          }
        />
        <Route
          path="invoices/:id/edit"
          element={
            <PermissionRoute permission="invoices.write">
              <InvoiceBuilderPage />
            </PermissionRoute>
          }
        />
        <Route
          path="invoices/:id"
          element={
            <PermissionRoute permission="invoices.read">
              <InvoiceDetailsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="payments"
          element={
            <PermissionRoute permission="payments.read">
              <PaymentsListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="payments/:id"
          element={
            <PermissionRoute permission="payments.read">
              <PaymentDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="payments/new"
          element={
            <PermissionRoute permission="payments.write">
              <PaymentBuilderPage />
            </PermissionRoute>
          }
        />
        <Route
          path="payments/:id/edit"
          element={
            <PermissionRoute permission="payments.write">
              <PaymentBuilderPage />
            </PermissionRoute>
          }
        />
        <Route
          path="notifications"
          element={<NotificationsPage />}
        />
        <Route
          path="follow-ups"
          element={
            <PermissionRoute permissions={['followups.view_own', 'followups.view_team', 'followups.view_all']}>
              <FollowUpsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="automation"
          element={
            <PermissionRoute permission="reports.view">
              <AutomationPage />
            </PermissionRoute>
          }
        />
        <Route
          path="finance"
          element={
            <PermissionRoute permission="reports.view">
              <FinancePage />
            </PermissionRoute>
          }
        />
        <Route
          path="expenses/:id"
          element={
            <PermissionRoute permission="expenses.read">
              <ExpenseDetailsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="amc/:id"
          element={
            <PermissionRoute permission="amc.read">
              <AmcDetailPage />
            </PermissionRoute>
          }
        />
        {resourceSchemas.map((schema) => (
          <Route
            key={schema.key}
            path={schema.path.replace('/app/', '')}
            element={
              <PermissionRoute permission={schema.permission}>
                <ResourcePage schema={schema} />
              </PermissionRoute>
            }
          />
        ))}
        <Route
          path="banking"
          element={
            <PermissionRoute permission="banking.read">
              <BankingPage />
            </PermissionRoute>
          }
        />
        <Route
          path="masters"
          element={
            <PermissionRoute permission="masters.read">
              <MastersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="users"
          element={
            <PermissionRoute permission="users.manage">
              <UsersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="users/:id"
          element={
            <PermissionRoute permission="users.manage">
              <UserDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="roles"
          element={
            <PermissionRoute permission="roles.manage">
              <RolesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="reports"
          element={
            <PermissionRoute permission="reports.view">
              <ReportsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings"
          element={
            <PermissionRoute permission="settings.read">
              <SettingsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProfilePage />
          }
        />
        <Route
          path="files"
          element={
            <PermissionRoute permission="files.read">
              <FilesPage />
            </PermissionRoute>
          }
        />
        <Route path="showcase" element={<ShowcasePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      <Route path="/invoice/public/:id" element={<InvoicePublicPage />} />
    </Routes>
  );
}

import { useLocation } from 'react-router-dom';

function TitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const updateTitle = () => {
      let appTitle = 'CRM';
      try {
        const rawUi = window.localStorage.getItem('webitof-ui-settings');
        if (rawUi) {
          const ui = JSON.parse(rawUi);
          if (ui.titleText) appTitle = ui.titleText;
        }
      } catch (e) {}

      const path = location.pathname;
      let pageName = '';
      
      if (path.includes('/settings')) pageName = 'Settings';
      else if (path.includes('/dashboard')) pageName = 'Dashboard';
      else if (path.includes('/notifications')) pageName = 'Notifications';
      else if (path.includes('/follow-ups')) pageName = 'Follow-ups';
      else if (path.includes('/automation')) pageName = 'Automation';
      else if (path.includes('/clients')) pageName = 'Clients';
      else if (path.includes('/projects')) pageName = 'Projects';
      else if (path.includes('/invoices')) pageName = 'Invoices';
      else if (path.includes('/payments')) pageName = 'Payments';
      else if (path.includes('/finance')) pageName = 'Finance';
      else if (path.includes('/expenses')) pageName = 'Expenses';
      else if (path.includes('/outsourcing')) pageName = 'Outsourcing';
      else if (path.includes('/lead-commissions')) pageName = 'Lead Commissions';
      else if (path.includes('/banking')) pageName = 'Banking';
      else if (path.includes('/amc')) pageName = 'AMC';
      else if (path.includes('/renewals')) pageName = 'Renewals';
      else if (path.includes('/masters')) pageName = 'Masters';
      else if (path.includes('/reports')) pageName = 'Reports';
      else if (path.includes('/users')) pageName = 'Users';
      else if (path.includes('/roles')) pageName = 'Roles';
      else if (path.includes('/files')) pageName = 'Files';
      else if (path.includes('/login')) pageName = 'Login';
      else if (path.includes('/profile')) pageName = 'Profile';
      else if (path.includes('/forgot-password')) pageName = 'Forgot Password';
      else {
        const segments = path.split('/').filter(Boolean);
        if (segments.length > 0) {
          const last = segments[segments.length - 1];
          pageName = last.charAt(0).toUpperCase() + last.slice(1);
        }
      }

      document.title = pageName ? `${pageName} - ${appTitle}` : appTitle;
    };

    updateTitle();
    window.addEventListener('theme-updated', updateTitle);
    return () => window.removeEventListener('theme-updated', updateTitle);
  }, [location.pathname]);

  return null;
}

export default function App() {
  useEffect(() => {
    const updateFavicon = () => {
      try {
        const raw = window.localStorage.getItem('webitof-logos');
        if (raw) {
          const logos = JSON.parse(raw);
          if (logos.favicon) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = logos.favicon;
          }
        }
      } catch (e) {}
    };

    updateFavicon();
    window.addEventListener('logos-updated', updateFavicon);
    return () => window.removeEventListener('logos-updated', updateFavicon);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <NotificationProvider>
            <TitleUpdater />
            <AppRoutes />
            <Toaster richColors position="top-right" closeButton />
          </NotificationProvider>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
