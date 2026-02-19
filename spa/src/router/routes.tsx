import type { RouteObject } from 'react-router-dom';
import ChatPage from '../pages/chat/ChatPage.tsx';
import DocumentsPage from '../pages/documents/DocumentsPage.tsx';
import DocumentDetailPage from '../pages/documents/DocumentDetailPage.tsx';
import LogsPage from '../pages/logs/LogsPage.tsx';
import LogDetailPage from '../pages/logs/LogDetailPage.tsx';
import TestsPage from '../pages/tests/TestsPage.tsx';
import ResultsPage from '../pages/results/ResultsPage.tsx';
const disableAuth = import.meta.env.VITE_DISABLE_AUTH === 'true';

// Important: The key is used to animate the outlet when the route changes.
// The key should be stable for children of the route so that the parent does not animate when the child changes.

const documentDetailRoute = {
  path: 'document/:id',
  element: <DocumentDetailPage key="document-detail" />
};

export const routes: RouteObject[] = [
  {
    path: '/',
    element: disableAuth ? <TestsPage key="tests-home" /> : <ChatPage key="chat" />
  },
  {
    path: '/chat/:chatId',
    element: <ChatPage key="chat" />,
    children: [ documentDetailRoute ]
  },
  {
    path: '/documents',
    element: <DocumentsPage key="documents-list" />,
    children: [ documentDetailRoute ]
  },
  {
    path: '/tests',
    element: <TestsPage key="tests" />
  },
  {
    path: '/results',
    element: <ResultsPage key="results" />
  },
  {
    path: '/logs',
    element: <LogsPage key="logs-list" />,
    children: [
      {
        path: ':id',
        element: <LogDetailPage key="log-detail" />
      }
    ]
  }
];
