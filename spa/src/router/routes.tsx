import type { RouteObject } from 'react-router-dom';
import LogsPage from '../pages/logs/LogsPage.tsx';
import LogDetailPage from '../pages/logs/LogDetailPage.tsx';
import DashboardPage from '../pages/dashboard/DashboardPage.tsx';

// Important: The key is used to animate the outlet when the route changes.
// The key should be stable for children of the route so that the parent does not animate when the child changes.

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <DashboardPage key="dashboard" />,
  },
  {
    path: '/tests',
    element: <DashboardPage key="dashboard-tests" />,
  },
  {
    path: '/results',
    element: <DashboardPage key="dashboard-results" />,
  },
  {
    path: '/logs',
    element: <LogsPage key="logs-list" />,
    children: [
      {
        path: ':id',
        element: <LogDetailPage key="log-detail" />,
      },
    ],
  },
];
