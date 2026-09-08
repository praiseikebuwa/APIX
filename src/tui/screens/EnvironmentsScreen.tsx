import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';

export const EnvironmentsScreen: React.FC = () => {
  const { environments, activeEnv, switchEnvironment, setScreen } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      setScreen('dashboard');
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : environments.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < environments.length - 1 ? prev + 1 : 0));
      return;
    }
    if (key.return) {
      const selected = environments[selectedIndex];
      if (selected) {
        switchEnvironment(selected.name);
      }
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          Environments ({environments.length})
        </Text>
        <Text color="gray">Press Enter to Activate │ Esc to Back</Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        minHeight={10}
      >
        {environments.map((env, i) => {
          const isSelected = i === selectedIndex;
          const isActive = env.name === activeEnv.name;
          return (
            <Box key={env.name} justifyContent="space-between" marginY={0}>
              <Box>
                <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                  {isSelected ? '❯ ' : '  '}
                </Text>
                <Text bold color={env.isProduction ? 'red' : 'green'}>
                  {env.name.padEnd(15)}
                </Text>
                <Text color="white">{env.baseUrl}</Text>
              </Box>
              <Box>
                {isActive ? (
                  <Text bold color="green">
                    [ACTIVE]
                  </Text>
                ) : (
                  <Text color="gray">[Inactive]</Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
