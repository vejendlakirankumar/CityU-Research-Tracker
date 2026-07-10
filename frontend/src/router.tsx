import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/guards/ProtectedRoute'
import RoleRoute from './components/guards/RoleRoute'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PublicPage from './pages/PublicPage'
import SubmissionsPage from './pages/SubmissionsPage'
import ReviewsPage from './pages/ReviewsPage'
import ReviewerAnalyticsPage from './pages/ReviewerAnalyticsPage'
import WorkflowsPage from './pages/WorkflowsPage'
import UsersPage from './pages/UsersPage'
import ReportsPage from './pages/ReportsPage'
import NotificationsPage from './pages/NotificationsPage'
import SettingsPage from './pages/SettingsPage'
import NewSubmissionPage from './pages/NewSubmissionPage'
import SubmissionDetailPage from './pages/SubmissionDetailPage'
import SubmissionCategoriesPage from './pages/SubmissionCategoriesPage'
import ReviewerAssignmentsPage from './pages/ReviewerAssignmentsPage'
import ResearcherAccessPage from './pages/ResearcherAccessPage'
import AuditLogPage from './pages/AuditLogPage'
import WebhooksPage from './pages/WebhooksPage'
import GatedReviewsPage from './pages/GatedReviewsPage'
import AppealsPage from './pages/AppealsPage'
import CalendarPage from './pages/CalendarPage'
import ProgramsPage from './pages/ProgramsPage'
import ReviewManagementPage from './pages/ReviewManagementPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import CustomRolesPage from './pages/CustomRolesPage'
import ReferencesPage from './pages/ReferencesPage'

export const router = createBrowserRouter(
  [
    // Public landing page — default view (About/Submissions/Login tabs)
    { path: '/', element: <PublicPage /> },

    // Standalone login URL (deep-linkable)
    { path: '/login', element: <LoginPage /> },

    // Authenticated routes — pathless wrapper applies ProtectedRoute + AppShell
    {
      element: (
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      ),
      children: [
        { path: '/dashboard',              element: <DashboardPage /> },
        { path: '/submissions',            element: <SubmissionsPage /> },
        { path: '/submissions/new',        element: <NewSubmissionPage /> },
        { path: '/submissions/:id',        element: <SubmissionDetailPage /> },
        {
          path: '/reviews',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator', 'reviewer']}>
              <ReviewsPage />
            </RoleRoute>
          ),
        },
        {
          path: '/reviewer-analytics',
          element: (
            <RoleRoute allowedRoles={['reviewer']}>
              <ReviewerAnalyticsPage />
            </RoleRoute>
          ),
        },
        {
          path: '/submission-categories',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <SubmissionCategoriesPage />
            </RoleRoute>
          ),
        },
        {
          path: '/reviewer-assignments',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <ReviewerAssignmentsPage />
            </RoleRoute>
          ),
        },
        {
          path: '/researcher-access',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <ResearcherAccessPage />
            </RoleRoute>
          ),
        },
        {
          path: '/workflows',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <WorkflowsPage />
            </RoleRoute>
          ),
        },
        {
          path: '/users',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <UsersPage />
            </RoleRoute>
          ),
        },
        {
          path: '/reports',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <ReportsPage />
            </RoleRoute>
          ),
        },
        { path: '/notifications',          element: <NotificationsPage /> },
        {
          path: '/settings',
          element: (
            <RoleRoute allowedRoles={['admin']}>
              <SettingsPage />
            </RoleRoute>
          ),
        },
        {
          path: '/audit-log',
          element: (
            <RoleRoute allowedRoles={['admin']}>
              <AuditLogPage />
            </RoleRoute>
          ),
        },
        {
          path: '/webhooks',
          element: (
            <RoleRoute allowedRoles={['admin']}>
              <WebhooksPage />
            </RoleRoute>
          ),
        },
        {
          path: '/gated-reviews',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <GatedReviewsPage />
            </RoleRoute>
          ),
        },
        {
          path: '/appeals',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <AppealsPage />
            </RoleRoute>
          ),
        },
        { path: '/calendar',               element: <CalendarPage /> },
        {
          path: '/programs',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <ProgramsPage />
            </RoleRoute>
          ),
        },
        {
          path: '/review-management',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <ReviewManagementPage />
            </RoleRoute>
          ),
        },
        {
          path: '/announcements',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <AnnouncementsPage />
            </RoleRoute>
          ),
        },
        {
          path: '/custom-roles',
          element: (
            <RoleRoute allowedRoles={['admin', 'coordinator']}>
              <CustomRolesPage />
            </RoleRoute>
          ),
        },
        { path: '/references',             element: <ReferencesPage /> },
      ],
    },

    // Catch-all → home
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename: '/' },
)

