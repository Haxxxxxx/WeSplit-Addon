/**
 * WeSplit Browser Addon - Main App Component
 *
 * Entry point for the authenticated app interface.
 * Handles routing between views and authentication state.
 */

import { useStore } from './store';
import { ConnectWallet } from './components/ConnectWallet';
import { AppHeader } from './components/AppHeader';
import { AppNav } from './components/AppNav';
import { Dashboard } from './components/Dashboard';
import { Send } from './components/Send';
import { Request } from './components/Request';
import { SharedWalletsView } from './components/SharedWalletsView';
import { History } from './components/History';
import { Settings } from './components/Settings';

function App() {
  const { currentView, wallet, user, authMethod } = useStore();

  // Check if user is authenticated (wallet connected or account logged in)
  const isAuthenticated = wallet.isConnected || (
    user && (
      authMethod === 'email' ||
      authMethod === 'google' ||
      authMethod === 'passkey' ||
      authMethod === 'qr' ||
      authMethod === 'phantom'
    )
  );

  // Show connect screen if not authenticated
  if (!isAuthenticated) {
    return <ConnectWallet />;
  }

  // Render current view based on navigation state
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'send':
        return <Send />;
      case 'request':
        return <Request />;
      case 'sharedWallets':
        return <SharedWalletsView />;
      case 'history':
        return <History />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-bg">
      <AppHeader />
      <AppNav />
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
