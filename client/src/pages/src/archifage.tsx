import React from 'react';
import { Switch, Route, Redirect } from 'wouter';
import { Dashboard } from './pages/Dashboard';
import { BoxDetail } from './pages/BoxDetail';

function Archifage() {
  // No AuthProvider here, but if Dashboard or BoxDetail use useAuth, they must be wrapped in the global AuthProvider in App.tsx
  return (
    <Switch>
      <Route path="/archifage" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/box/:boxId" component={BoxDetail} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
    </Switch>
  );
}

export default Archifage;