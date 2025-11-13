import React from 'react';
import { Switch, Route } from "wouter";
import DocumentArchive from './DocumentArchive';
import BoxDetail from './BoxDetail';

function ArchiveApp() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        <Route path="/logistique/history" component={DocumentArchive} />
        <Route path="/logistique/history/box/:boxId">
          {params => <BoxDetail boxId={params.boxId} />}
        </Route>
      </Switch>
    </div>
  );
}

export default ArchiveApp;