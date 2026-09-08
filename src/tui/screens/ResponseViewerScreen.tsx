import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';

type Tab = 'pretty' | 'raw' | 'headers' | 'timeline';

export const ResponseViewerScreen: React.FC = () => {
  const { lastResponse, lastRequestConfig, setScreen } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('pretty');

  if (!lastResponse) {
    return (
      <Box padding={1}>
        <Text color="yellow">No response available yet. Execute a request first.</Text>
      </Box>
    );
  }

  useInput((input, key) => {
    if (key.escape) {
      setScreen('builder');
      return;
    }

    if (key.leftArrow) {
      if (activeTab === 'timeline') setActiveTab('headers');
      else if (activeTab === 'headers') setActiveTab('raw');
      else if (activeTab === 'raw') setActiveTab('pretty');
      return;
    }
    if (key.rightArrow) {
      if (activeTab === 'pretty') setActiveTab('raw');
      else if (activeTab === 'raw') setActiveTab('headers');
      else if (activeTab === 'headers') setActiveTab('timeline');
      return;
    }

    if (input === '1') setActiveTab('pretty');
    if (input === '2') setActiveTab('raw');
    if (input === '3') setActiveTab('headers');
    if (input === '4') setActiveTab('timeline');
    if (input === 'c') setScreen('code-gen');
  });

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'green';
    if (status >= 300 && status < 400) return 'cyan';
    if (status >= 400 && status < 500) return 'yellow';
    return 'red';
  };

  const renderTimelineBar = (label: string, ms: number, total: number) => {
    const maxChars = 20;
    const count = total > 0 ? Math.max(1, Math.round((ms / total) * maxChars)) : 1;
    const bar = '█'.repeat(count);
    return (
      <Box key={label} justifyContent="space-between" width={40}>
        <Text color="gray">{label.padEnd(10)}</Text>
        <Text color="cyan">{bar}</Text>
        <Text bold color="white">
          {' '}
          {ms}ms
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Response Header */}
      <Box
        borderStyle="single"
        borderColor={getStatusColor(lastResponse.status)}
        paddingX={1}
        justifyContent="space-between"
      >
        <Box>
          <Text bold color={getStatusColor(lastResponse.status)}>
            {lastResponse.status} {lastResponse.statusText || 'OK'}
          </Text>
          <Text color="gray"> │ Time: </Text>
          <Text bold color="white">
            {lastResponse.timing.total}ms
          </Text>
          <Text color="gray"> │ Size: </Text>
          <Text bold color="white">
            {(lastResponse.sizeBytes / 1024).toFixed(2)} KB
          </Text>
        </Box>
        <Box>
          <Text color="gray">URL: {lastResponse.url.slice(0, 35)}</Text>
        </Box>
      </Box>

      {/* Tabs */}
      <Box marginY={1}>
        <Text
          color={activeTab === 'pretty' ? 'cyan' : 'gray'}
          bold={activeTab === 'pretty'}
        >
          [1 Pretty]{' '}
        </Text>
        <Text
          color={activeTab === 'raw' ? 'cyan' : 'gray'}
          bold={activeTab === 'raw'}
        >
          [2 Raw]{' '}
        </Text>
        <Text
          color={activeTab === 'headers' ? 'cyan' : 'gray'}
          bold={activeTab === 'headers'}
        >
          [3 Headers]{' '}
        </Text>
        <Text
          color={activeTab === 'timeline' ? 'cyan' : 'gray'}
          bold={activeTab === 'timeline'}
        >
          [4 Timeline]
        </Text>
      </Box>

      {/* Tab Content */}
      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        minHeight={10}
        flexDirection="column"
      >
        {activeTab === 'pretty' && (
          <Box flexDirection="column">
            {lastResponse.isJson && typeof lastResponse.data === 'object' ? (
              <Text color="white">
                {JSON.stringify(lastResponse.data, null, 2).slice(0, 1500)}
                {JSON.stringify(lastResponse.data).length > 1500 && (
                  <Text color="gray">
                    {'\n'}... [Truncated for display; switch to Raw or export for full body]
                  </Text>
                )}
              </Text>
            ) : (
              <Text color="white">{lastResponse.rawData.slice(0, 1000)}</Text>
            )}
          </Box>
        )}

        {activeTab === 'raw' && (
          <Box flexDirection="column">
            <Text color="gray">{lastResponse.rawData.slice(0, 1500)}</Text>
          </Box>
        )}

        {activeTab === 'headers' && (
          <Box flexDirection="column">
            {Object.entries(lastResponse.headers).map(([k, v]) => (
              <Box key={k}>
                <Text bold color="cyan">
                  {k}:{' '}
                </Text>
                <Text color="white">{Array.isArray(v) ? v.join(', ') : v}</Text>
              </Box>
            ))}
          </Box>
        )}

        {activeTab === 'timeline' && (
          <Box flexDirection="column">
            <Text bold color="cyan" marginBottom={1}>
              Request Latency Breakdown
            </Text>
            {renderTimelineBar('DNS', lastResponse.timing.dns, lastResponse.timing.total)}
            {renderTimelineBar('Connect', lastResponse.timing.tcp, lastResponse.timing.total)}
            {renderTimelineBar('TLS', lastResponse.timing.tls, lastResponse.timing.total)}
            {renderTimelineBar('Server TTFB', lastResponse.timing.ttfb, lastResponse.timing.total)}
            {renderTimelineBar('Download', lastResponse.timing.download, lastResponse.timing.total)}
            <Box borderStyle="single" borderColor="gray" width={40} marginTop={1} paddingX={1}>
              <Text bold color="green">
                Total Latency: {lastResponse.timing.total}ms
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer controls */}
      <Box justifyContent="space-between" marginTop={1}>
        <Text color="gray">Use ← → or 1-4 to switch tabs │ [Esc] Back to Builder</Text>
        <Text color="gray">[c] Code Generator</Text>
      </Box>
    </Box>
  );
};
