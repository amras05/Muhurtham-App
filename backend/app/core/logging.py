"""
Muhurtham App — structured logging setup.

Replaces all print() calls with a proper logger.
Usage in any module:
    from app.core.logging import logger
    logger.info("message")
    logger.error("message", exc_info=True)
"""
import logging
import sys

def setup_logger(name: str = "muhurtham", level: int = logging.INFO) -> logging.Logger:
    """Create and configure the application logger."""
    log = logging.getLogger(name)
    if not log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(
            "[%(asctime)s] %(levelname)s %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        ))
        log.addHandler(handler)
    log.setLevel(level)
    return log

logger = setup_logger()
