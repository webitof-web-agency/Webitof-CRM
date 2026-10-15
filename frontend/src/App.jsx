import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute } from './components/guards/ProtectedRoute';
import { PermissionRoute } from './components/guards/PermissionRoute';
import { AppLayout } from './components/layout/AppLayout';
import { schemaRegistry } from './config/resourceSchemas';

const resourceSchemas = [
  schemaRegistry.expenses,
  schemaRegistry.outsourcing,
  schemaRegistry['lead-commissions'],
  schemaRegistry.amc,
  schemaRegistry.renewals
].filter(Boolean);

const lazyNamed = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));
const LoginPage = lazyNamed(() => import('./pages/auth/LoginPage'), 'LoginPage');
const ForgotPasswordPage = lazyNamed(() => import('./pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('./pages/auth/ResetPasswordPage'), 'ResetPasswordPage');
const DashboardPage = lazyNamed(() => import('./pages/DashboardPage'), 'DashboardPage');
const UsersPage = lazyNamed(() => import('./pages/UsersPage'), 'UsersPage');
const UserDetailPage = lazyNamed(() => import('./pages/UserDetailPage'), 'UserDetailPage');
const RolesPage = lazyNamed(() => import('./pages/RolesPage'), 'RolesPage');
const ReportsPage = lazyNamed(() => import('./pages/ReportsPage'), 'ReportsPage');
const SettingsPage = lazyNamed(() => import('./pages/SettingsPage'), 'SettingsPage');
const FilesPage = lazyNamed(() => import('./pages/FilesPage'), 'FilesPage');
const FinancePage = lazyNamed(() => import('./pages/finance/FinancePage'), 'FinancePage');
const ExpenseDetailsPage = lazyNamed(() => import('./pages/expenses/ExpenseDetailsPage'), 'ExpenseDetailsPage');
const AmcDetailPage = lazyNamed(() => import('./pages/amc/AmcDetailPage'), 'AmcDetailPage');
const BankingPage = lazyNamed(() => import('./pages/BankingPage'), 'BankingPage');
const MastersPage = lazyNamed(() => import('./pages/MastersPage'), 'MastersPage');
const ServiceMasterFormPage = lazyNamed(() => import('./pages/MastersPage'), 'ServiceMasterFormPage');
const TechnologyStacksPage = lazyNamed(() => import('./pages/TechnologyStacksPage'), 'TechnologyStacksPage');
const QuotationMasterPage = lazyNamed(() => import('./pages/QuotationMasterPage'), 'QuotationMasterPage');
const LegalMasterPage = lazyNamed(() => import('./pages/LegalMasterPage'), 'LegalMasterPage');
const NotFoundPage = lazyNamed(() => import('./pages/NotFoundPage'), 'NotFoundPage');
const ResourcePage = lazyNamed(() => import('./pages/ResourcePage'), 'ResourcePage');
const ProfilePage = lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage');
const LeadsPage = lazyNamed(() => import('./pages/LeadsPage'), 'LeadsPage');
const LeadDetailsPage = lazyNamed(() => import('./pages/leads/LeadDetailsPage'), 'LeadDetailsPage');
const LeadQuotationPage = lazyNamed(() => import('./pages/leads/LeadDetailsPage'), 'LeadQuotationPage');
const ShowcasePage = lazyNamed(() => import('./components/Showcase'), 'ShowcasePage');
const ClientsListPage = lazyNamed(() => import('./pages/clients/ClientsListPage'), 'ClientsListPage');
const ClientDetailsPage = lazyNamed(() => import('./pages/clients/ClientDetailsPage'), 'ClientDetailsPage');
const ClientFormPage = lazyNamed(() => import('./pages/clients/ClientFormPage'), 'ClientFormPage');
const ProjectsListPage = lazyNamed(() => import('./pages/projects/ProjectsListPage'), 'ProjectsListPage');
const ProjectDetailsPage = lazyNamed(() => import('./pages/projects/ProjectDetailsPage'), 'ProjectDetailsPage');
const QuotationsListPage = lazyNamed(() => import('./pages/quotations/QuotationsListPage'), 'QuotationsListPage');
const QuotationPreviewPage = lazyNamed(() => import('./pages/quotations/QuotationPreviewPage'), 'QuotationPreviewPage');
const InvoicesListPage = lazyNamed(() => import('./pages/invoices/InvoicesListPage'), 'InvoicesListPage');
const InvoiceBuilderPage = lazyNamed(() => import('./pages/invoices/InvoiceBuilderPage'), 'InvoiceBuilderPage');
const InvoiceExportPage = lazyNamed(() => import('./pages/invoices/InvoiceExportPage'), 'InvoiceExportPage');
const InvoiceDetailsPage = lazyNamed(() => import('./pages/invoices/InvoiceDetailsPage'), 'InvoiceDetailsPage');
const InvoicePublicPage = lazyNamed(() => import('./pages/invoices/InvoicePublicPage'), 'InvoicePublicPage');
const PaymentsListPage = lazyNamed(() => import('./pages/payments/PaymentsListPage'), 'PaymentsListPage');
const PaymentBuilderPage = lazyNamed(() => import('./pages/payments/PaymentBuilderPage'), 'PaymentBuilderPage');
const PaymentDetailPage = lazyNamed(() => import('./pages/payments/PaymentDetailPage'), 'PaymentDetailPage');
const AutomationPage = lazyNamed(() => import('./pages/AutomationPage'), 'AutomationPage');
const NotificationsPage = lazyNamed(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const FollowUpsPage = lazyNamed(() => import('./pages/followups/FollowUpsPage'), 'FollowUpsPage');
const CallHistoryPage = lazyNamed(() => import('./pages/calls/CallHistoryPage'), 'CallHistoryPage');
const HrmPage = lazyNamed(() => import('./pages/hrm/HrmPage'), 'HrmPage');

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
        <Route path="hrm/*" element={<PermissionRoute permissions={['hrm.view_own','hrm.view_team','hrm.view_projects','hrm.view_all']}><Suspense fallback={<div className="p-6" role="status">Loading HRM…</div>}><HrmPage /></Suspense></PermissionRoute>} />
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
              <LeadQuotationPage mode="create" />
            </PermissionRoute>
          }
        />
        <Route
          path="leads/:id/quotations/:quotationId"
          element={
            <PermissionRoute permission="leads.read">
              <LeadQuotationPage mode="edit" />
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
          path="quotations"
          element={
            <PermissionRoute permission="leads.read">
              <QuotationsListPage />
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
          path="call-history"
          element={
            <PermissionRoute permissions={['calls.read', 'leads.read', 'dashboard.view']}>
              <CallHistoryPage />
            </PermissionRoute>
          }
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
        <Route path="service-master" element={<Navigate to="/app/service-master/services" replace />} />
        <Route
          path="service-master/services"
          element={
            <PermissionRoute permission="masters.read">
              <MastersPage initialType="service" serviceMasterOnly />
            </PermissionRoute>
          }
        />
        <Route
          path="service-master/services/new"
          element={
            <PermissionRoute permission="masters.write">
              <ServiceMasterFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="service-master/services/:serviceId/edit"
          element={
            <PermissionRoute permission="masters.write">
              <ServiceMasterFormPage />
            </PermissionRoute>
          }
        />
        <Route
          path="service-master/categories"
          element={
            <PermissionRoute permission="masters.read">
              <MastersPage initialType="service_category" serviceMasterOnly />
            </PermissionRoute>
          }
        />
        <Route
          path="service-master/tech-stacks"
          element={
            <PermissionRoute permission="masters.read">
              <TechnologyStacksPage />
            </PermissionRoute>
          }
        />
        <Route path="service-master/quotation-master" element={<Navigate to="/app/quotation-master" replace />} />
        <Route
          path="quotation-master"
          element={
            <PermissionRoute permission="masters.read">
              <QuotationMasterPage />
            </PermissionRoute>
          }
        />
        <Route
          path="legal-master"
          element={
            <PermissionRoute permission="masters.read">
              <LegalMasterPage />
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

      <Route path="/quotations/preview" element={<QuotationPreviewPage />} />
      <Route path="/quotation/preview" element={<QuotationPreviewPage />} />
      <Route path="/invoice/public/:id" element={<InvoicePublicPage />} />
      <Route path="*" element={<NotFoundPage />} />
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
      
      if (path.includes('/hrm')) {
        const segments = path.split('/').filter(Boolean);
        const sub = segments[2];
        if (sub && sub !== 'overview') {
          const formattedSub = sub
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          pageName = `HRM · ${formattedSub}`;
        } else {
          pageName = 'HRM';
        }
      } else if (path.includes('/settings')) pageName = 'Settings';
      else if (path.includes('/dashboard')) pageName = 'Dashboard';
      else if (path.includes('/notifications')) pageName = 'Notifications';
      else if (path.includes('/follow-ups')) pageName = 'Follow-ups';
      else if (path.includes('/automation')) pageName = 'Automation';
      else if (path.includes('/clients')) pageName = 'Clients';
      else if (path.includes('/projects')) pageName = 'Projects';
      else if (path.includes('/leads') && path.includes('/quotations')) pageName = 'Leads · Quotation Builder';
      else if (path.includes('/quotations')) pageName = 'Quotations';
      else if (path.includes('/invoices')) pageName = 'Invoices';
      else if (path.includes('/payments')) pageName = 'Payments';
      else if (path.includes('/finance')) pageName = 'Finance';
      else if (path.includes('/expenses')) pageName = 'Expenses';
      else if (path.includes('/outsourcing')) pageName = 'Outsourcing';
      else if (path.includes('/lead-commissions')) pageName = 'Lead Commissions';
      else if (path.includes('/banking')) pageName = 'Banking';
      else if (path.includes('/amc')) pageName = 'AMC';
      else if (path.includes('/renewals')) pageName = 'Renewals';
      else if (path.includes('/quotation-master')) pageName = 'Quotation Master';
      else if (path.includes('/service-master')) pageName = path.includes('/tech-stacks')
          ? 'Service Master · Tech Stacks'
          : path.includes('/categories')
            ? 'Service Master · Categories'
            : 'Service Master · All Services';
      else if (path.includes('/legal-master')) pageName = 'Legal Master';
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
            <Suspense fallback={<div className="p-6" role="status">Loading…</div>}>
              <AppRoutes />
            </Suspense>
            <Toaster richColors position="top-right" closeButton />
          </NotificationProvider>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
