"""Uvicorn --loop app.runtime:selector_loop for Psycopg on Windows."""

import asyncio
import selectors


def selector_loop():
    return asyncio.SelectorEventLoop(selectors.SelectSelector())
