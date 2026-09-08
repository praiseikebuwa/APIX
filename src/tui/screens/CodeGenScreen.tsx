import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';
import { CodeGenerator, type SupportedLanguage } from '../../core/generators/index.js';

export const CodeGenScreen: React.FC = () => {
  const { activeEndpoint, spec, setScreen } = useApp();
  const languages: SupportedLanguage[] = [
    'curl',
    'javascript',
    'typescript',
    'python',
    'go',
    'java',
    'php',
    'dart',
    'csharp',
    'rust',
  ];
  const [selectedLangIndex, setSelectedLangIndex] = useState(0);

  if (!activeEndpoint) {
    return (
      <Box padding={1}>
        <Text color="yellow">No endpoint selected to generate code for.</Text>
      </Box>
    );
  }

  const currentLang = languages[selectedLangIndex];
  const fullUrl = `${spec?.baseUrl || 'http://localhost'}${activeEndpoint.path}`;
  const code = CodeGenerator.generate(currentLang, {
    url: fullUrl,
    method: activeEndpoint.method,
    body: activeEndpoint.requestBody?.example,
  });

  useInput((input, key) => {
    if (key.escape) {
      setScreen('details');
      return;
    }
    if (key.leftArrow || key.upArrow) {
      setSelectedLangIndex((prev) => (prev > 0 ? prev - 1 : languages.length - 1));
      return;
    }
    if (key.rightArrow || key.downArrow) {
      setSelectedLangIndex((prev) => (prev < languages.length - 1 ? prev + 1 : 0));
      return;
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          Code Generator: {activeEndpoint.method} {activeEndpoint.path}
        </Text>
        <Text color="gray">← → to change language │ Esc to Back</Text>
      </Box>

      {/* Language Pills */}
      <Box marginBottom={1} flexWrap="wrap">
        {languages.map((lang, i) => {
          const isSelected = i === selectedLangIndex;
          return (
            <Box key={lang} marginRight={1}>
              <Text
                color={isSelected ? 'black' : 'cyan'}
                backgroundColor={isSelected ? 'cyan' : undefined}
                bold={isSelected}
              >
                {' '}[{lang.toUpperCase()}]{' '}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Code Box */}
      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        minHeight={12}
        flexDirection="column"
      >
        <Text color="white">{code}</Text>
      </Box>
    </Box>
  );
};
