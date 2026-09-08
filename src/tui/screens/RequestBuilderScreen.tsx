import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useApp } from '../context/app-context.js';

export const RequestBuilderScreen: React.FC = () => {
  const {
    activeEndpoint,
    setScreen,
    executeRequest,
    builderParams,
    setBuilderParams,
    builderQuery,
    setBuilderQuery,
    builderHeaders,
    setBuilderHeaders,
    builderBody,
    setBuilderBody,
  } = useApp();

  const [activeField, setActiveField] = useState<'params' | 'query' | 'body' | 'execute'>('params');
  const [paramKey, setParamKey] = useState('');
  const [paramVal, setParamVal] = useState('');
  const [bodyText, setBodyText] = useState(
    builderBody ||
      (activeEndpoint?.requestBody?.example
        ? JSON.stringify(activeEndpoint.requestBody.example, null, 2)
        : '')
  );
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!activeEndpoint) {
    return (
      <Box padding={1}>
        <Text color="yellow">No endpoint selected.</Text>
      </Box>
    );
  }

  useInput((input, key) => {
    if (isEditingBody) {
      if (key.escape) {
        setIsEditingBody(false);
        // validate JSON
        if (bodyText.trim()) {
          try {
            JSON.parse(bodyText);
            setJsonError(null);
            setBuilderBody(bodyText);
          } catch (e: any) {
            setJsonError(`Invalid JSON: ${e.message}`);
          }
        }
        return;
      }
      if (key.return) {
        setBodyText((prev) => prev + '\n');
        return;
      }
      if (key.backspace || key.delete) {
        setBodyText((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setBodyText((prev) => prev + input);
      }
      return;
    }

    if (key.escape) {
      setScreen('details');
      return;
    }

    if (key.ctrl && input === 'r') {
      triggerExecute();
      return;
    }

    if (key.upArrow) {
      if (activeField === 'execute') setActiveField('body');
      else if (activeField === 'body') setActiveField('params');
      return;
    }
    if (key.downArrow) {
      if (activeField === 'params') setActiveField('body');
      else if (activeField === 'body') setActiveField('execute');
      return;
    }

    if (key.return) {
      if (activeField === 'body') {
        setIsEditingBody(true);
      } else if (activeField === 'execute') {
        triggerExecute();
      }
    }
  });

  const triggerExecute = () => {
    if (bodyText.trim()) {
      try {
        JSON.parse(bodyText);
        setBuilderBody(bodyText);
      } catch (e: any) {
        setJsonError(`Cannot execute: invalid JSON body (${e.message})`);
        return;
      }
    }
    executeRequest();
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">
            Request Builder: {activeEndpoint.method} {activeEndpoint.path}
          </Text>
        </Box>
        <Box>
          <Text color="green">Press Ctrl+R to Execute</Text>
        </Box>
      </Box>

      {/* Path / Query Parameters */}
      {activeEndpoint.parameters.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            Parameters:
          </Text>
          {activeEndpoint.parameters.map((p, idx) => (
            <Box key={`${p.name}_${idx}`}>
              <Text color="gray">  {p.in}: </Text>
              <Text bold color="white">
                {p.name} ={' '}
              </Text>
              <Text color="cyan">{builderParams[p.name] || p.defaultValue || '(default)'}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Request Body Editor */}
      {['POST', 'PUT', 'PATCH'].includes(activeEndpoint.method) && (
        <Box flexDirection="column" marginBottom={1}>
          <Box justifyContent="space-between">
            <Text bold color={activeField === 'body' ? 'cyan' : 'white'}>
              {activeField === 'body' ? '❯ ' : '  '}Request Body (JSON):
            </Text>
            <Text color="gray">
              {isEditingBody ? (
                <Text color="green">Editing... (Press Esc when done)</Text>
              ) : (
                'Press Enter to edit'
              )}
            </Text>
          </Box>

          <Box
            borderStyle="single"
            borderColor={isEditingBody ? 'green' : activeField === 'body' ? 'cyan' : 'gray'}
            paddingX={1}
            minHeight={5}
          >
            <Text color={jsonError ? 'red' : 'white'}>
              {bodyText || '(empty JSON body)'}
              {isEditingBody && <Text color="green">█</Text>}
            </Text>
          </Box>
          {jsonError && (
            <Box>
              <Text color="red">⚠ {jsonError}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Execute Button */}
      <Box
        borderStyle="double"
        borderColor={activeField === 'execute' ? 'green' : 'gray'}
        paddingX={2}
        marginTop={1}
        justifyContent="center"
      >
        <Text bold color={activeField === 'execute' ? 'green' : 'white'}>
          {activeField === 'execute' ? '❯ [ EXECUTE REQUEST ] ❮' : '[ Execute Request ]'}
        </Text>
      </Box>
    </Box>
  );
};
