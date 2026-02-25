import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { UserProvider } from './context/UserProvider.tsx'
import { JobsProvider } from './context/JobsProvider.tsx'
import ErrorPage from './pages/error/ErrorPage.tsx'
import { routes } from './router/routes.tsx'
import { PopoverContainer } from './components/popover/PopoverPortal.tsx'
import { ToastContainer } from './components/toast/Toast.tsx'
import App from './App.tsx'
import './styles/index.scss'

const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <ErrorPage />,
    element: (
      <JobsProvider>
        <App />
        <PopoverContainer />
        <ToastContainer />
      </JobsProvider>
    ),
    children: routes,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <RouterProvider router={router} />
    </UserProvider>
  </StrictMode>,
)
