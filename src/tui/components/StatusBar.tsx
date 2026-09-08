import React from 'react';
import { Box, Text } from 'ink';
import { useApp } from '../context/app-context.js';

export const StatusBar: React.FC = () => {
  const { statusMessage, screen } = useApp();

  return (
    <Box flexDirection="column" marginTop={1}>
      {statusMessage && (
        <Box paddingX={1}>
          <Text color="yellow">ℹ {statusMessage}</Text>
        </Box>
      )}

      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        justifyContent="space-between"
      >
        <Box>
          <Text color="cyan">↑↓</Text>
          <Text color="gray"> Nav </Text>
          <Text color="cyan">Enter</Text>
          <Text color="gray"> Select </Text>
          <Text color="cyan">Esc</Text>
          <Text color="gray"> Back </Text>
          <Text color="cyan">/</Text>
          <Text color="gray"> Search </Text>
          <Text color="cyan">^P</Text>
          <Text color="gray"> Palette </Text>
          {screen === 'builder' && (
            <>
              <Text color="green">^R</Text>
              <Text color="gray"> Run </Text>
            </>
          )}
          <Text color="cyan">q</Text>
          <Text color="gray"> Quit</Text>
        </Box>

        <Box>
          <Text color="gray">Screen: </Text>
          <Text bold color="white">
            {screen.toUpperCase()}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
