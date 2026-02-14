import type {JSX} from 'react';
import {useRouteError, useNavigate} from 'react-router-dom';

export function ErrorBoundary(): JSX.Element {
  const error = useRouteError() as Error;
  const navigate = useNavigate();

  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error?.message ?? 'An unexpected error occurred'}</p>
      <button
        type="button"
        onClick={() => {
          void navigate(-1);
        }}
      >
        Go back
      </button>
    </div>
  );
}
