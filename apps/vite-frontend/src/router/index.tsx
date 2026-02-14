import {createBrowserRouter, Navigate} from 'react-router-dom';
import {App} from '../App.tsx';
import {Home} from '../pages/Home.tsx';
import {ErrorBoundary} from '../pages/ErrorBoundary.tsx';
import {NotFound} from '../pages/NotFound.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate replace to="/en" />,
  },
  {
    path: '/:locale',
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Home />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
