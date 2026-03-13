import { Suspense, lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import Feedback from '../components/feedback/Feedback';

const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage.tsx'));
const LogsPage = lazy(() => import('../pages/logs/LogsPage.tsx'));
const LogDetailPage = lazy(() => import('../pages/logs/LogDetailPage.tsx'));
const PersonalitiesPage = lazy(() => import('../pages/personalities/PersonalitiesPage.tsx'));
const ResultDetailPage = lazy(() => import('../pages/results/ResultDetailPage.tsx'));

// Important: The key is used to animate the outlet when the route changes.
// The key should be stable for children of the route so that the parent does not animate when the child changes.

export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<Feedback type="loading" />} key="dashboard">
        <DashboardPage />
      </Suspense>
    ),
  },
  {
    path: '/results/:resultSetId',
    element: (
      <Suspense fallback={<Feedback type="loading" />} key="result-detail">
        <ResultDetailPage />
      </Suspense>
    ),
  },
  {
    path: '/logs',
    element: (
      <Suspense fallback={<Feedback type="loading" />} key="logs-list">
        <LogsPage />
      </Suspense>
    ),
    children: [
      {
        path: ':id',
        element: (
          <Suspense fallback={<Feedback type="loading" />} key="log-detail">
            <LogDetailPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/personalities',
    element: (
      <Suspense fallback={<Feedback type="loading" />} key="personalities">
        <PersonalitiesPage />
      </Suspense>
    ),
  },
];
