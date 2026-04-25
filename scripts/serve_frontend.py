#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


class SpaHandler(SimpleHTTPRequestHandler):
    dist_root: Path = Path.cwd()

    def translate_path(self, path: str) -> str:
        parsed = urlsplit(path)
        clean_path = unquote(parsed.path.lstrip("/"))
        candidate = (self.dist_root / clean_path).resolve()
        if self._is_within_root(candidate) and candidate.exists():
            return str(candidate)
        return str((self.dist_root / "index.html").resolve())

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND, "API requests should go to the backend directly.")
            return
        super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802
        if self.path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND, "API requests should go to the backend directly.")
            return
        super().do_HEAD()

    def log_message(self, format: str, *args) -> None:
        print("[frontend]", format % args)

    def _is_within_root(self, candidate: Path) -> bool:
        try:
            candidate.relative_to(self.dist_root)
            return True
        except ValueError:
            return False


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--host", default="127.0.0.1")
  parser.add_argument("--port", type=int, default=5173)
  parser.add_argument("--root", default="frontend/dist")
  args = parser.parse_args()

  root = Path(args.root).resolve()
  if not root.exists():
      raise SystemExit(f"Frontend dist root does not exist: {root}")

  SpaHandler.dist_root = root
  os.chdir(root)
  httpd = ThreadingHTTPServer((args.host, args.port), SpaHandler)
  print(f"Serving Lineage frontend from {root} on http://{args.host}:{args.port}")
  httpd.serve_forever()


if __name__ == "__main__":
    main()
