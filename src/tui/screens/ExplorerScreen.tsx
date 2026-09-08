import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';
import type { ApiEndpoint, HttpMethod } from '../../types/index.js';

export const ExplorerScreen: React.FC = () => {
  const { spec, setActiveEndpoint, setScreen } = useApp();
  const [filter, setFilter] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!spec || spec.endpoints.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">No endpoints available. Connect to an API first.</Text>
      </Box>
    );
  }

  const filteredEndpoints = spec.endpoints.filter((ep) => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    return (
      ep.path.toLowerCase().includes(term) ||
      ep.method.toLowerCase().includes(term) ||
      (ep.summary && ep.summary.toLowerCase().includes(term)) ||
      ep.tags.some((t) => t.toLowerCase().includes(term))
    );
  });

  useInput((input, key) => {
    if (isFiltering) {
      if (key.return) {
        setIsFiltering(false);
        return;
      }
      if (key.escape) {
        setIsFiltering(false);
        setFilter('');
        return;
      }
      if (key.backspace || key.delete) {
        setFilter((prev) => prev.slice(0, -1));
        setSelectedIndex(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setFilter((prev) => prev + input);
        setSelectedIndex(0);
      }
      return;
    }

    if (input === '/') {
      setIsFiltering(true);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredEndpoints.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < filteredEndpoints.length - 1 ? prev + 1 : 0));
      return;
    }
    if (key.return) {
      const selected = filteredEndpoints[selectedIndex];
      if (selected) {
        setActiveEndpoint(selected);
        setScreen('details');
      }
      return;
    }
    if (key.escape) {
      setScreen('dashboard');
    }
  });

  const getMethodColor = (method: HttpMethod) => {
    switch (method) {
      case 'GET':
        return 'green';
      case 'POST':
        return 'blue';
      case 'PUT':
        return 'yellow';
      case 'DELETE':
        return 'red';
      case 'PATCH':
        return 'magenta';
      default:
        return 'cyan';
    }
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          API Explorer ({filteredEndpoints.length} of {spec.endpoints.length} endpoints)
        </Text>
        <Text color="gray">
          {isFiltering ? (
            <Text color="green">Filter: {filter}█ (Enter to finish)</Text>
          ) : (
            <Text>Press <Text color="cyan">/</Text> to search</Text>
          )}
        </Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        minHeight={12}
      >
        {filteredEndpoints.length === 0 ? (
          <Text color="gray">No endpoints match filter &quot;{filter}&quot;.</Text>
        ) : (
          filteredEndpoints.slice(0, 15).map((ep, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={`${ep.method}_${ep.path}_${i}`} justifyContent="space-between">
                <Box>
                  <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                    {isSelected ? '❯ ' : '  '}
                  </Text>
                  <Text bold color={getMethodColor(ep.method)}>
                    {ep.method.padEnd(7)}
                  </Text>
                  <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                    {ep.path}
                  </Text>
                </Box>
                <Box>
                  <Text color="gray">{ep.summary ? ep.summary.slice(0, 30) : ''}</Text>
                  <Text color="gray"> [{ep.tags[0] || 'General'}]</Text>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};
