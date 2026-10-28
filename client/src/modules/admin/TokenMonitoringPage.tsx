import React from 'react';
import { Navigate } from 'react-router-dom';

/** Baitly keeps historical bookmarks on the shared monitoring workspace. */
export default function TokenMonitoringPage() {
  return <Navigate to="/admin/monitoring?tab=tokens" replace />;
}
