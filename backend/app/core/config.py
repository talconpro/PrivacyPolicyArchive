from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_URL = f"sqlite:///{(BACKEND_DIR / 'dev.db').as_posix()}"


class Settings(BaseSettings):
    app_name: str = 'privacy-policy-archive-api'
    app_env: str = 'development'

    # Support normal and BOM-prefixed DATABASE_URL keys.
    database_url: str = Field(
        default=DEFAULT_DATABASE_URL,
        validation_alias=AliasChoices(
            'DATABASE_URL',
            'database_url',
            '\ufeffDATABASE_URL',
            '\ufeffdatabase_url',
        ),
    )

    cors_origins: str = 'http://localhost:5173,http://localhost:3000'

    admin_username: str = 'admin'
    admin_password: str = 'admin@123'
    admin_token: str = 'change-me'

    jwt_secret: str = 'change-this-secret'
    jwt_expire_seconds: int = 43200

    deepseek_api_key: str = ''
    deepseek_base_url: str = 'https://api.deepseek.com'
    deepseek_model: str = 'deepseek-chat'

    turnstile_secret: str = ''
    apk_max_upload_mb: int = 1024

    # Appeal notification email (optional)
    smtp_host: str = ''
    smtp_port: int = 587
    smtp_username: str = ''
    smtp_password: str = ''
    smtp_sender: str = ''
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    @field_validator('database_url', mode='before')
    @classmethod
    def validate_db_url(cls, v: str):
        if not v:
            raise ValueError('DATABASE_URL 不能为空')
        if isinstance(v, str) and v.startswith('sqlite:///./'):
            relative_path = v.replace('sqlite:///./', '', 1)
            return f"sqlite:///{(BACKEND_DIR / relative_path).as_posix()}"
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(',') if x.strip()]

    @field_validator('apk_max_upload_mb')
    @classmethod
    def validate_apk_max_upload_mb(cls, v: int):
        value = int(v)
        if value < 10:
            return 10
        if value > 2048:
            return 2048
        return value

    @field_validator('smtp_port')
    @classmethod
    def validate_smtp_port(cls, v: int):
        value = int(v)
        if value < 1:
            return 1
        if value > 65535:
            return 65535
        return value

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / '.env'),
        env_file_encoding='utf-8',
        case_sensitive=False,
        extra='ignore',
    )


settings = Settings()
