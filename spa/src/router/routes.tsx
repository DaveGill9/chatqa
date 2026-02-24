import type { RouteObject } from 'react-router-dom';
import LogsPage from '../pages/logs/LogsPage.tsx';
import LogDetailPage from '../pages/logs/LogDetailPage.tsx';
import TestsPage from '../pages/tests/TestsPage.tsx';
import ResultsPage from '../pages/results/ResultsPage.tsx';

// Important: The key is used to animate the outlet when the route changes.
// The key should be stable for children of the route so that the parent does not animate when the child changes.

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <TestsPage key="tests-home" />,
  },
  {
    path: '/tests',
    element: <TestsPage key="tests" />,
  },
  {
    path: '/results',
    element: <ResultsPage key="results" />,
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
