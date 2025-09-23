// Smart Actions Client - Provider-specific chat API interface
// Universal Automation Wiki - Smart Actions Suite

(function () {
  "use strict";

  const DEFAULT_ENDPOINTS = {
    openai: "https://api.openai.com/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    claude: "https://api.anthropic.com/v1/messages",
    gemini: "https://generativelanguage.googleapis.com/v1beta/models",
    ollama: "http://localhost:11434/api/chat",
  };

  const DEFAULT_MODEL_HINT = {
    openai: "gpt-4.1-mini",
    openrouter: "openrouter/auto",
    claude: "claude-3-opus-20240229",
    gemini: "gemini-1.5-pro-latest",
    ollama: "llama3.1",
  };

  function clampTemperature(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0.2;
    }
    if (value < 0) {
      return 0;
    }
    if (value > 2) {
      return 2;
    }
    return value;
  }

  function openAIModelRequiresFixedTemperature(model) {
    if (!model) {
      return false;
    }
    return /^gpt-5/i.test(String(model).trim());
  }

  function normalizeTemperatureValue(provider, model, temperature) {
    const clamped = clampTemperature(temperature);
    if (String(provider || "").toLowerCase() === "openai" && openAIModelRequiresFixedTemperature(model)) {
      return 1;
    }
    return clamped;
  }

  function normalizeConfig(config) {
    if (!config || !config.provider) {
      throw new Error("SmartActions: Missing provider configuration.");
    }
    const provider = config.provider;
    const model =
      config.model || DEFAULT_MODEL_HINT[config.provider] || "gpt-4.1-mini";
    return {
      provider,
      model,
      baseUrl: config.baseUrl || "",
      apiKey: config.apiKey || "",
      temperature: normalizeTemperatureValue(provider, model, config.temperature),
      maxTokens: config.maxTokens || 20000,
      organization: config.organization || "",
      label: config.label || "",
    };
  }

  function splitMessages(messages) {
    const systemMessages = messages.filter(
      (message) => message.role === "system",
    );
    const conversation = messages.filter(
      (message) => message.role !== "system",
    );
    const systemText = systemMessages
      .map((message) => message.content)
      .join("\n\n")
      .trim();
    return { systemText, conversation };
  }

  async function sendOpenAI(config, messages, options = {}) {
    const endpoint = config.baseUrl || DEFAULT_ENDPOINTS.openai;
    if (!config.apiKey) {
      throw new Error("OpenAI API key is required.");
    }
    const body = {
      model: config.model,
      messages,
    };
    if (typeof config.maxTokens === "number") {
      body.max_completion_tokens = config.maxTokens;
    }
    if (!openAIModelRequiresFixedTemperature(config.model)) {
      body.temperature = config.temperature;
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };
    if (config.organization) {
      headers["OpenAI-Organization"] = config.organization;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const choice = data.choices && data.choices[0];
    if (!choice || !choice.message) {
      throw new Error("OpenAI response did not contain a message.");
    }
    return {
      message: choice.message.content || "",
      raw: data,
    };
  }

  async function sendOpenRouter(config, messages, options = {}) {
    const endpoint = config.baseUrl || DEFAULT_ENDPOINTS.openrouter;
    if (!config.apiKey) {
      throw new Error("OpenRouter API key is required.");
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };
    if (config.organization) {
      headers["X-Title"] = config.organization;
    }
    if (typeof window !== "undefined" && window.location) {
      headers["HTTP-Referer"] = window.location.origin;
    }
    const body = {
      model: config.model,
      messages,
    };
    if (!openAIModelRequiresFixedTemperature(config.model)) {
      body.temperature = config.temperature;
    } else {
      body.temperature = 1;
    }
    if (typeof config.maxTokens === "number") {
      body.max_completion_tokens = config.maxTokens;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter request failed: ${response.status} ${errorText}`,
      );
    }
    const data = await response.json();
    const choice = data.choices && data.choices[0];
    if (!choice || !choice.message) {
      throw new Error("OpenRouter response did not contain a message.");
    }
    return {
      message: choice.message.content || "",
      raw: data,
    };
  }

  async function sendClaude(config, messages, options = {}) {
    const endpoint = config.baseUrl || DEFAULT_ENDPOINTS.claude;
    if (!config.apiKey) {
      throw new Error("Claude API key is required.");
    }
    const { systemText, conversation } = splitMessages(messages);
    const payload = {
      model: config.model,
      temperature: config.temperature,
      system: systemText,
      messages: conversation.map((message) => ({
        role: message.role,
        content: [{ type: "text", text: message.content }],
      })),
    };
    if (typeof config.maxTokens === "number") {
      payload.max_completion_tokens = config.maxTokens;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude request failed: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const content = data.content && data.content[0];
    if (!content || content.type !== "text") {
      throw new Error("Claude response did not contain text content.");
    }
    return {
      message: content.text,
      raw: data,
    };
  }

  async function sendGemini(config, messages, options = {}) {
    if (!config.apiKey) {
      throw new Error("Gemini API key is required.");
    }
    const endpoint =
      config.baseUrl ||
      `${DEFAULT_ENDPOINTS.gemini}/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const { systemText, conversation } = splitMessages(messages);
    const payload = {
      contents: conversation.map((message) => ({
        role: message.role,
        parts: [{ text: message.content }],
      })),
    };
    if (systemText) {
      payload.systemInstruction = { parts: [{ text: systemText }] };
    }
    payload.generationConfig = {
      temperature: config.temperature,
    };
    if (typeof config.maxTokens === "number") {
      payload.generationConfig.maxOutputTokens = config.maxTokens;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const candidates = data.candidates || [];
    const candidate = candidates[0];
    const part =
      candidate &&
      candidate.content &&
      candidate.content.parts &&
      candidate.content.parts[0];
    if (!part || !part.text) {
      throw new Error("Gemini response did not contain text content.");
    }
    return {
      message: part.text,
      raw: data,
    };
  }

  async function sendOllama(config, messages, options = {}) {
    const endpoint = config.baseUrl || DEFAULT_ENDPOINTS.ollama;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
      }),
      signal: options.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama request failed: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    if (!data || !data.message) {
      throw new Error("Ollama response did not contain a message.");
    }
    return {
      message: data.message.content || "",
      raw: data,
    };
  }

  async function* streamSSE(response, parseDelta) {
    if (!response.body || typeof response.body.getReader !== "function") {
      throw new Error("Streaming is not supported in this environment.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      const segments = buffer.split("\n\n");
      buffer = segments.pop() || "";

      for (const segment of segments) {
        const line = segment.trim();
        if (!line) {
          continue;
        }
        const dataLine = line.split('\n').find(entry => entry.startsWith('data:'));
        if (!dataLine) {
          continue;
        }
        const payload = dataLine.replace(/^data:\s*/, '');
        if (payload === "[DONE]") {
          return;
        }
        const delta = parseDelta(payload);
        if (delta) {
          yield delta;
        }
      }
    }

    if (buffer) {
      const delta = parseDelta(buffer);
      if (delta) {
        yield delta;
      }
    }
  }

  async function* streamOpenAI(config, messages, options = {}) {
    const endpoint = config.baseUrl || DEFAULT_ENDPOINTS.openai;
    if (!config.apiKey) {
      throw new Error("OpenAI API key is required.");
    }
    const body = {
      model: config.model,
      messages,
      stream: true,
    };
    if (typeof config.maxTokens === "number") {
      body.max_completion_tokens = config.maxTokens;
    }
    if (!openAIModelRequiresFixedTemperature(config.model)) {
      body.temperature = config.temperature;
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };
    if (config.organization) {
      headers["OpenAI-Organization"] = config.organization;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI stream failed: ${response.status} ${errorText}`);
    }
    yield* streamSSE(response, (payload) => {
      try {
        const json = JSON.parse(payload);
        return json.choices?.[0]?.delta?.content || "";
      } catch (error) {
        return "";
      }
    });
  }

  async function* streamOpenRouter(config, messages, options = {}) {
    const endpoint = config.baseUrl || DEFAULT_ENDPOINTS.openrouter;
    if (!config.apiKey) {
      throw new Error("OpenRouter API key is required.");
    }
    const body = {
      model: config.model,
      messages,
      stream: true,
    };
    if (!openAIModelRequiresFixedTemperature(config.model)) {
      body.temperature = config.temperature;
    } else {
      body.temperature = 1;
    }
    if (typeof config.maxTokens === "number") {
      body.max_completion_tokens = config.maxTokens;
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };
    if (config.organization) {
      headers["X-Title"] = config.organization;
    }
    if (typeof window !== "undefined" && window.location) {
      headers["HTTP-Referer"] = window.location.origin;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter stream failed: ${response.status} ${errorText}`);
    }
    yield* streamSSE(response, (payload) => {
      try {
        const json = JSON.parse(payload);
        return json.choices?.[0]?.delta?.content || "";
      } catch (error) {
        return "";
      }
    });
  }

  async function sendChat(configInput, messages, options) {
    const config = normalizeConfig(configInput);
    switch (config.provider) {
      case "openai":
        return sendOpenAI(config, messages, options);
      case "openrouter":
        return sendOpenRouter(config, messages, options);
      case "claude":
        return sendClaude(config, messages, options);
      case "gemini":
        return sendGemini(config, messages, options);
      case "ollama":
        return sendOllama(config, messages, options);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async function* streamChat(configInput, messages, options = {}) {
    const config = normalizeConfig(configInput);
    switch (config.provider) {
      case "openai":
        yield* streamOpenAI(config, messages, options);
        break;
      case "openrouter":
        yield* streamOpenRouter(config, messages, options);
        break;
      default:
        throw new Error(`Streaming is not supported for provider: ${config.provider}`);
    }
  }

  window.SmartActionsClient = {
    sendChat,
    streamChat,
  };
})();
