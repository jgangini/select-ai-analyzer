from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


_AVATAR_ALLOWED_TYPES: dict[str, str] = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
}
_AVATAR_MAX_BYTES = 2 * 1024 * 1024


@dataclass(frozen=True)
class AvatarFile:
    path: Path
    media_type: str
    filename: str


class AvatarValidationError(ValueError):
    pass


class AvatarStorage:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir

    def get_file(self) -> AvatarFile | None:
        avatar_path = self.resolve_file()
        if avatar_path is None:
            return None
        return AvatarFile(
            path=avatar_path,
            media_type=self.media_type(avatar_path),
            filename=avatar_path.name,
        )

    def upload(self, *, content_type: str, content: bytes) -> dict[str, object]:
        extension = _AVATAR_ALLOWED_TYPES.get(content_type.strip().lower())
        if not extension:
            allowed = ", ".join(sorted(_AVATAR_ALLOWED_TYPES.keys()))
            raise AvatarValidationError(f"Unsupported avatar type. Allowed: {allowed}")
        if not content:
            raise AvatarValidationError("Empty image file")
        if len(content) > _AVATAR_MAX_BYTES:
            raise AvatarValidationError("Image too large. Max size is 2 MB")
        for candidate in self.candidates():
            if candidate.exists():
                candidate.unlink()
        target = self.avatar_dir() / f"avatar{extension}"
        target.write_bytes(content)
        return {
            "success": True,
            "avatar_url": self.url(target),
        }

    def delete(self) -> dict[str, object]:
        removed = False
        for candidate in self.candidates():
            if candidate.exists():
                candidate.unlink()
                removed = True
        return {"success": True, "removed": removed}

    def avatar_dir(self) -> Path:
        path = self.data_dir / "runtime" / "agent"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def candidates(self) -> list[Path]:
        directory = self.avatar_dir()
        return [
            directory / "avatar.png",
            directory / "avatar.jpg",
            directory / "avatar.jpeg",
            directory / "avatar.gif",
        ]

    def resolve_file(self) -> Path | None:
        for candidate in self.candidates():
            if candidate.exists() and candidate.is_file():
                return candidate
        return None

    def url(self, path: Path | None = None) -> str:
        avatar_path = path or self.resolve_file()
        if avatar_path is None:
            return ""
        version = int(avatar_path.stat().st_mtime)
        return f"/api/settings/agent-avatar?v={version}"

    @staticmethod
    def media_type(path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix in {".jpg", ".jpeg"}:
            return "image/jpeg"
        if suffix == ".gif":
            return "image/gif"
        return "image/png"
