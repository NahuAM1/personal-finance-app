// OpenRouter models
export enum OpenRouterModels {
  DEEPSEEK_R1_FREE = "deepseek/deepseek-r1:free",
  DEEPSEEK_R1_PRO = "deepseek/deepseek-r1:pro",
  GPT_3_5_TURBO = "openai/gpt-3.5-turbo",
  GPT_4 = "openai/gpt-4",
  GPT_5_2 = "openai/gpt-5.2",
  GEMMA_3 = "google/gemma-3-27b-it:free",
  QWEN_VL = "qwen/qwen3-vl-235b-a22b-thinking",
  NVIDIA = "nvidia/nemotron-3-nano-30b-a3b:free",
  ARCEE = "arcee-ai/trinity-large-preview:free",
  GEMINI_2_5_FLASH = "gemini-2.5-flash",
}

// Hugging Face Inference models
export enum HuggingFaceModels {
  QWEN_3_5_9B = "Qwen/Qwen3.5-9B",
  QWEN_3_5_27B = "Qwen/Qwen3.5-27B",
  QWEN_3_5_35B = "Qwen/Qwen3.5-35B-A3B",
  QWEN_3_5_122B = "Qwen/Qwen3.5-122B-A10B",
  QWEN_3_5_397B = "Qwen/Qwen3.5-397B-A17B",
  QWEN_3_CODER = "Qwen/Qwen3-Coder-Next",
  MINIMAX_M2_5 = "MiniMaxAI/MiniMax-M2.5",
  GLM_5 = "zai-org/GLM-5",
  KIMI_K2_5 = "moonshotai/Kimi-K2.5",
  LLAMA_3_1_8B = "meta-llama/Llama-3.1-8B-Instruct",
  GPT_OSS_20B = "openai/gpt-oss-20b",
  GPT_OSS_120B = "openai/gpt-oss-120b",
  DEEPSEEK_V3_2 = "deepseek-ai/DeepSeek-V3.2",
  STEP_3_5_FLASH = "stepfun-ai/Step-3.5-Flash",
}

// Google Gemini models
export enum GeminiModels {
  GEMINI_2_5_FLASH = "gemini-2.5-flash",
}

// Alias para compatibilidad con el código existente
export { HuggingFaceModels as OpenAIModels };

export enum TransactionsTypes {
  INCOME = "income",
  EXPENSE = "expense",
}
