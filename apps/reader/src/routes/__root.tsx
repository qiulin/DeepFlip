import { createRootRoute, Outlet } from '@tanstack/react-router';
import React from 'react';
import { EnvProvider } from '@/context/EnvContext';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <EnvProvider>
      <Outlet />
    </EnvProvider>
  );
}
