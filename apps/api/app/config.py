import os
import re
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.security import DailyLimiter

ROOT = Path(__file__).resolve().parents[3]


def native_path(value: str) -> Path:
    # Git Bash exports /c/... paths, which native Windows Python cannot resolve.
    if os.name == "nt" and re.match(r"^/[a-zA-Z]/", value):
        value = value[1] + ":" + value[2:]
    return Path(value).expanduser().resolve()


def load_environment() -> None:
    load_dotenv(native_path(os.getenv("VILLAGE_ENV_FILE", str(ROOT / ".env"))), override=False)


def _fallback_key() -> str:
    """GPU_FALLBACK_KEY, else the gitignored key file written when the Modal secret was created."""
    key = os.getenv("GPU_FALLBACK_KEY", "")
    if key:
        return key
    path = native_path(
        os.getenv("GPU_FALLBACK_KEY_FILE", str(ROOT / "data" / "run" / "gpu_fallback.key"))
    )
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


@dataclass
class Settings:
    database_url: str = field(repr=False)
    cost_limiter: DailyLimiter = field(
        default_factory=DailyLimiter.from_env, repr=False, compare=False
    )
    tiger_database_url: str = field(default="", repr=False)
    demo_auth: bool = False
    demo_debug: bool = False
    service_key: str = field(default="", repr=False)
    auth0_domain: str = ""
    auth0_audience: str = "https://api.village.local"
    google_api_key: str = field(default="", repr=False)
    google_genai_use_vertexai: bool = True
    elevenlabs_api_key: str = field(default="", repr=False)
    gpu_worker_url: str = "http://localhost:8100/health"
    # MODAL-001: scale-to-zero cloud GPU used when the local worker is down (or GPU_PREFER=modal).
    gpu_fallback_url: str = ""
    gpu_fallback_key: str = field(default="", repr=False)
    gpu_prefer: str = "local"
    asset_dir: Path = ROOT / "data" / "assets"
    build: str = "API-004"
    solana_rpc_url: str = field(default="https://api.devnet.solana.com", repr=False)
    solana_program_id: str = ""
    solana_treasury: str = ""
    llm_provider: str = "openrouter"
    openrouter_api_key: str = field(default="", repr=False)
    openrouter_model: str = "deepseek/deepseek-v4-flash"
    mayor_scheduler: bool = False
    mayor_tick_seconds: int = 300
    mayor_voice: bool = False
    llm_max_calls_per_hour: int = 60

    @classmethod
    def from_env(cls):
        load_environment()
        database_url = os.getenv("DATABASE_URL", "")
        # Docker Desktop's published localhost port can black-hole IPv6 connections.
        if database_url and os.name == "nt":
            params = conninfo_to_dict(database_url)
            if params.get("host") == "localhost" and not params.get("hostaddr"):
                database_url = make_conninfo(database_url, hostaddr="127.0.0.1")
        return cls(
            database_url=database_url,
            solana_rpc_url=os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
            solana_program_id=os.getenv("SOLANA_PROGRAM_ID", ""),
            solana_treasury=os.getenv("SOLANA_TREASURY_ADDRESS", ""),
            tiger_database_url=os.getenv("TIGER_DATABASE_URL", ""),
            demo_debug=os.getenv("DEMO_DEBUG", "0") == "1",
            demo_auth=os.getenv("DEMO_AUTH", "0") == "1",
            service_key=os.getenv("SERVICE_KEY", ""),
            auth0_domain=os.getenv("AUTH0_DOMAIN", "").removeprefix("https://").rstrip("/"),
            auth0_audience=os.getenv("AUTH0_AUDIENCE", "https://api.village.local"),
            google_api_key=os.getenv("GOOGLE_API_KEY", ""),
            google_genai_use_vertexai=os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "true").lower()
            in {"true", "1"},
            elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY", ""),
            gpu_worker_url=os.getenv("GPU_WORKER_URL", "http://localhost:8100/health"),
            gpu_fallback_url=os.getenv("GPU_FALLBACK_URL", "").strip().rstrip("/"),
            gpu_fallback_key=_fallback_key(),
            gpu_prefer="modal" if os.getenv("GPU_PREFER", "local").strip().lower() == "modal" else "local",
            asset_dir=native_path(os.getenv("ASSET_DIR", str(ROOT / "data" / "assets"))),
            build=os.getenv("VILLAGE_BUILD", "API-004"),
            llm_provider=os.getenv("LLM_PROVIDER", "openrouter"),
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
            openrouter_model=os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-v4-flash"),
            mayor_scheduler=os.getenv(
                "MAYOR_SCHEDULER", "1" if os.getenv("DEMO_AUTH") == "1" else "0"
            )
            == "1",
            mayor_tick_seconds=max(1, int(os.getenv("MAYOR_TICK_SECONDS", "300"))),
            llm_max_calls_per_hour=max(0, int(os.getenv("LLM_MAX_CALLS_PER_HOUR", "60"))),
            mayor_voice=os.getenv("MAYOR_VOICE", "0") == "1",
        )
