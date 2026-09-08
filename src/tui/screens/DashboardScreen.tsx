import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';

export const DashboardScreen: React.FC = () => {
  const { setScreen, connectToUrl, spec, loading } = useApp();
  const [urlInput, setUrlInput] = useState('http://localhost:3000');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuItems = [
    { label: 'Connect to URL', action: () => setIsEditingUrl(true) },
    { label: 'Explore API Endpoints', action: () => setScreen('explorer'), disabled: !spec },
    { label: 'Request History', action: () => setScreen('history') },
    { label: 'Collections', action: () => setScreen('collections') },
    { label: 'Environments', action: () => setScreen('environments') },
    { label: 'Generate Code', action: () => setScreen('code-gen'), disabled: !spec },
  ];

  useInput((input, key) => {
    if (isEditingUrl) {
      if (key.return) {
        setIsEditingUrl(false);
        if (urlInput.trim()) {
          connectToUrl(urlInput.trim());
        }
        return;
      }
      if (key.escape) {
        setIsEditingUrl(false);
        return;
      }
      if (key.backspace || key.delete) {
        setUrlInput((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setUrlInput((prev) => prev + input);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
      return;
    }
    if (key.return) {
      const item = menuItems[selectedIndex];
      if (item && (!item.disabled || item.label === 'Connect to URL')) {
        item.action();
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="white">
          Universal API Explorer &amp; Development Platform
        </Text>
        <Text color="gray">
          Connect to any REST or OpenAPI endpoint to inspect, execute, and test APIs.
        </Text>
      </Box>

      {/* Target URL input box */}
      <Box
        borderStyle="single"
        borderColor={isEditingUrl ? 'green' : 'cyan'}
        paddingX={1}
        marginBottom={1}
        flexDirection="column"
      >
        <Text color="gray">API Target URL (Press Enter to edit/connect):</Text>
        <Box>
          <Text color="cyan">&gt; </Text>
          <Text bold color="white">
            {urlInput}
          </Text>
          {isEditingUrl && <Text color="green"> █ (Typing... Press Enter to connect)</Text>}
        </Box>
      </Box>

      {/* Main Menu */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
        <Text bold color="cyan" marginBottom={1}>
          Actions
        </Text>
        {menuItems.map((item, index) => {
          const isSelected = index === selectedIndex && !isEditingUrl;
          return (
            <Box key={item.label}>
              <Text
                color={
                  item.disabled
                    ? 'gray'
                    : isSelected
                    ? 'cyan'
                    : 'white'
                }
                bold={isSelected}
              >
                {isSelected ? '❯ ' : '  '}
                {item.label}
              </Text>
              {item.disabled && <Text color="gray"> (requires connected API)</Text>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
