from app.config import Settings
from app.llm.base import LLMAdapter
from app.llm.types import LLMConfig


def create_llm_adapter(settings: Settings) -> LLMAdapter:
    config = LLMConfig(
        provider=settings.llm_provider,
        model=settings.llm_model,
        base_url=settings.ollama_base_url if settings.llm_provider == "ollama" else None,
        api_key=(
            settings.anthropic_api_key
            if settings.llm_provider == "anthropic"
            else settings.openai_api_key
            if settings.llm_provider == "openai"
            else None
        ),
    )

    match config.provider:
        case "ollama":
            from app.llm.ollama_adapter import OllamaAdapter
            return OllamaAdapter(config)
        case "anthropic":
            from app.llm.anthropic_adapter import AnthropicAdapter
            return AnthropicAdapter(config)
        case "openai":
            from app.llm.openai_adapter import OpenAIAdapter
            return OpenAIAdapter(config)
        case _:
            raise ValueError(f"Unknown LLM provider: {config.provider}")
