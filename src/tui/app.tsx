import React, { useState } from 'react';
import { Box, useInput, useApp as useInkApp } from 'ink';
import { AppProvider, useApp } from './context/app-context.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { CommandPalette } from './components/CommandPalette.js';
import { ProductionWarning } from './components/ProductionWarning.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { ExplorerScreen } from './screens/ExplorerScreen.js';
import { EndpointDetailScreen } from './screens/EndpointDetailScreen.js';
import { RequestBuilderScreen } from './screens/RequestBuilderScreen.js';
import { ResponseViewerScreen } from './screens/ResponseViewerScreen.js';
import { HistoryScreen } from './screens/HistoryScreen.js';
import { EnvironmentsScreen } from './screens/EnvironmentsScreen.js';
import { CollectionsScreen } from './screens/CollectionsScreen.js';
import { CodeGenScreen } from './screens/CodeGenScreen.js';

const TuiMain: React.FC = () => {
  const { screen, warningModal } = useApp();
  const { exit } = useInkApp();
  const [showPalette, setShowPalette] = useState(false);

  useInput((input, key) => {
    // Ctrl+P toggle command palette
    if (key.ctrl && input === 'p') {
      setShowPalette((prev) => !prev);
      return;
    }

    if (!showPalette && !warningModal && input === 'q') {
      exit();
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column" minHeight={20} padding={1}>
      <Header />

      {/* Screen Views */}
      <Box flexDirection="column" flexGrow={1}>
        {screen === 'dashboard' && <DashboardScreen />}
        {screen === 'explorer' && <ExplorerScreen />}
        {screen === 'details' && <EndpointDetailScreen />}
        {screen === 'builder' && <RequestBuilderScreen />}
        {screen === 'response' && <ResponseViewerScreen />}
        {screen === 'history' && <HistoryScreen />}
        {screen === 'environments' && <EnvironmentsScreen />}
        {screen === 'collections' && <CollectionsScreen />}
        {screen === 'code-gen' && <CodeGenScreen />}
      </Box>

      {/* Modals */}
      {showPalette && (
        <Box position="absolute" marginTop={3} marginLeft={4}>
          <CommandPalette onClose={() => setShowPalette(false)} />
        </Box>
      )}

      {warningModal && (
        <Box position="absolute" marginTop={4} marginLeft={6}>
          <ProductionWarning
            message={warningModal.message}
            onConfirm={warningModal.onConfirm}
            onCancel={warningModal.onCancel}
          />
        </Box>
      )}

      <StatusBar />
    </Box>
  );
};

export const App: React.FC<{ initialUrl?: string }> = ({ initialUrl }) => {
  return (
    <AppProvider initialUrl={initialUrl}>
      <TuiMain />
    </AppProvider>
  );
};
