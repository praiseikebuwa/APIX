import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';

export const HistoryScreen: React.FC = () => {
  const { historyItems, setScreen, executeRequest } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (historyItems.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">No request history recorded yet.</Text>
        <Text color="gray">Execute requests from the Explorer to build history.</Text>
      </Box>
    );
  }

  useInput((input, key) => {
    if (key.escape) {
      setScreen('dashboard');
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : historyItems.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < historyItems.length - 1 ? prev + 1 : 0));
      return;
    }
    if (key.return || input === 'r') {
      // Replay selected request
      const item = historyItems[selectedIndex];
      if (item) {
        executeRequest({
          url: item.url,
          method: item.method,
          headers: item.request.headers,
          query: item.request.query,
          body: item.request.body,
        });
      }
    }
  });

  const getStatusColor = (s: number) => {
    if (s >= 200 && s < 300) return 'green';
    if (s >= 400 && s < 500) return 'yellow';
    return 'red';
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          Request History ({historyItems.length} items)
        </Text>
        <Text color="gray">Press Enter to Replay │ Esc to Back</Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        minHeight={12}
      >
        {historyItems.slice(0, 15).map((item, i) => {
          const isSelected = i === selectedIndex;
          const timeStr = new Date(item.timestamp).toLocaleTimeString();
          return (
            <Box key={item.id} justifyContent="space-between">
              <Box>
                <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                  {isSelected ? '❯ ' : '  '}
                </Text>
                <Text color="gray">{timeStr} </Text>
                <Text bold color="cyan">
                  {item.method.padEnd(7)}
                </Text>
                <Text color="white">{item.path.slice(0, 35)}</Text>
              </Box>
              <Box>
                <Text bold color={getStatusColor(item.status)}>
                  {item.status}{' '}
                </Text>
                <Text color="gray">({item.durationMs}ms)</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
