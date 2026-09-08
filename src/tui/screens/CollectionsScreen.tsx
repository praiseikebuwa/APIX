import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';

export const CollectionsScreen: React.FC = () => {
  const { collectionManager, setScreen, executeRequest } = useApp();
  const [collections] = useState(() => collectionManager.getCollections());
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (collections.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">No collections found.</Text>
        <Text color="gray">
          Create collections with: apix collection create &quot;My API&quot;
        </Text>
      </Box>
    );
  }

  useInput((input, key) => {
    if (key.escape) {
      setScreen('dashboard');
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : collections.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < collections.length - 1 ? prev + 1 : 0));
      return;
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          Collections ({collections.length})
        </Text>
        <Text color="gray">Esc to Back</Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        minHeight={10}
      >
        {collections.map((col, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Box key={col.id} justifyContent="space-between">
              <Box>
                <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                  {isSelected ? '❯ ' : '  '}
                </Text>
                <Text bold color="white">
                  {col.name}
                </Text>
                <Text color="gray"> ({col.requests.length} requests)</Text>
              </Box>
              <Box>
                <Text color="gray">{col.description || ''}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
