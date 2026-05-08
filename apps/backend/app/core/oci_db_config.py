"""Read OCI-related configuration from config table."""

import logging
from typing import Optional, Dict

from .database import DatabaseManager

logger = logging.getLogger(__name__)


def get_oci_namespace(db_manager: DatabaseManager) -> Optional[str]:
    """Get OCI namespace from config table."""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT config_value
            FROM config
            WHERE config_key = 'oci.namespace'
        """)

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if row and row[0]:
            value = row[0]
            if hasattr(value, 'read'):
                value = value.read()
            return value
        return None

    except Exception as e:
        logger.error("Error loading OCI namespace: %s", e)
        return None


def get_oci_bucket_name(db_manager: DatabaseManager) -> Optional[str]:
    """Get single Object Storage bucket name from config table."""
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT config_key, config_value
            FROM config
            WHERE config_key = 'oci.bucket_name'
        """)

        values: Dict[str, str] = {}
        for row in cursor.fetchall():
            key = row[0]
            value = row[1]
            if hasattr(value, 'read'):
                value = value.read()
            values[key] = str(value or "").strip()

        cursor.close()
        conn.close()

        return values.get("oci.bucket_name", "") or None

    except Exception as e:
        logger.error("Error loading OCI bucket name: %s", e)
        return None
