import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';

interface PaletteCommand {
  id: string;
  title: string;
  category: string;
  action: () => void;
}

export const CommandPalette: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    setScreen,
    switchEnvironment,
    environments,
    spec,
    activeEndpoint,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: PaletteCommand[] = [
    {
      id: 'connect',
      title: 'Connect to API (URL)',
      category: 'Navigation',
      action: () => {
        setScreen('dashboard');
        onClose();
      },
    },
    {
      id: 'explore',
      title: 'Explore Endpoints & Schemas',
      category: 'Navigation',
      action: () => {
        setScreen('explorer');
        onClose();
      },
    },
    {
      id: 'history',
      title: 'View Request History',
      category: 'Navigation',
      action: () => {
        setScreen('history');
        onClose();
      },
    },
    {
      id: 'collections',
      title: 'View Collections & Saved Requests',
      category: 'Navigation',
      action: () => {
        setScreen('collections');
        onClose();
      },
    },
    {
      id: 'environments',
      title: 'Manage Environments',
      category: 'Navigation',
      action: () => {
        setScreen('environments');
        onClose();
      },
    },
    {
      id: 'gen-curl',
      title: 'Generate cURL Command',
      category: 'Code Generation',
      action: () => {
        setScreen('code-gen');
        onClose();
      },
    },
    {
      id: 'gen-js',
      title: 'Generate JavaScript (Fetch)',
      category: 'Code Generation',
      action: () => {
        setScreen('code-gen');
        onClose();
      },
    },
    {
      id: 'gen-py',
      title: 'Generate Python (Requests)',
      category: 'Code Generation',
      action: () => {
        setScreen('code-gen');
        onClose();
      },
    },
    {
      id: 'quit',
      title: 'Quit APiX',
      category: 'System',
      action: () => {
        process.exit(0);
      },
    },
  ];

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      return;
    }
    if (key.return) {
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="magenta"
      padding={1}
      width={70}
    >
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="magenta">
          ⚡ Command Palette
        </Text>
        <Text color="gray">Esc to close</Text>
      </Box>

      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text color="cyan">&gt; </Text>
        <Text bold>{query}</Text>
        <Text color="gray">_</Text>
      </Box>

      <Box flexDirection="column">
        {filtered.length === 0 ? (
          <Text color="gray">No matching commands found.</Text>
        ) : (
          filtered.slice(0, 8).map((cmd, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={cmd.id} justifyContent="space-between">
                <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                  {isSelected ? '❯ ' : '  '}
                  {cmd.title}
                </Text>
                <Text color="gray">[{cmd.category}]</Text>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};
