import { spawn } from 'child_process';

/**
 * Executes a tool call against the Open Browser Control MCP bridge
 * @param {string} toolName Name of the tool (e.g. browser_navigate, browser_screenshot)
 * @param {object} args Arguments for the tool
 * @returns {Promise<any>}
 */
export function callBrowserTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('cmd.exe', ['/c', 'npx', '-y', 'open-browser-control'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let buffer = '';
    let resolved = false;

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);

          // 1. Initialized handshake
          if (msg.id === 1) {
            child.stdin.write(JSON.stringify({
              jsonrpc: '2.0',
              method: 'notifications/initialized',
              params: {}
            }) + '\n');

            // Small delay to ensure bridge session registration
            setTimeout(() => {
              child.stdin.write(JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                  name: toolName,
                  arguments: args
                }
              }) + '\n');
            }, 1200);
          } else if (msg.id === 2) {
            resolved = true;
            resolve(msg.result);
            child.kill();
          }
        } catch (e) {
          // Ignore partial or non-json lines
        }
      }
    });

    // Send initialize request
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'browser-agent-runner', version: '1.0.0' }
      }
    }) + '\n');

    setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error(`Timeout waiting for tool ${toolName}`));
      }
    }, 25000);
  });
}
