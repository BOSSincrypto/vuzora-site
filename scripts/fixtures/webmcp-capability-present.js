(() => {
  const registrations = [];
  window.__vuzoraWebMcpTrace = registrations;
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool(tool, options) {
        registrations.push({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          execute: tool.execute,
          signalAborted: options?.signal?.aborted ?? false,
        });
        return Promise.resolve();
      },
    },
  });
})();
