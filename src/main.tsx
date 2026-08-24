import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import {ProtegeAuthProvider} from './auth/AuthProvider';
import './styles.css';
import './auth.css';
import './vault.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><ProtegeAuthProvider><App/></ProtegeAuthProvider></ErrorBoundary></React.StrictMode>);
